#!/bin/bash

# Multi-Region Deployment Script for Video Chat Application
# This script deploys the application to multiple AWS regions with proper configuration

set -euo pipefail

# Configuration
REGIONS=("us-west-2" "eu-west-1" "ap-southeast-1")
PRIMARY_REGION="us-west-2"
ENVIRONMENT="${ENVIRONMENT:-production}"
PROJECT_NAME="video-chat"
DOMAIN_NAME="${DOMAIN_NAME:-video-chat.example.com}"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-ghcr.io/your-username}"
IMAGE_TAG="${IMAGE_TAG:-v2.0.0}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing_tools=()
    
    command -v terraform >/dev/null 2>&1 || missing_tools+=("terraform")
    command -v kubectl >/dev/null 2>&1 || missing_tools+=("kubectl")
    command -v aws >/dev/null 2>&1 || missing_tools+=("aws")
    command -v docker >/dev/null 2>&1 || missing_tools+=("docker")
    command -v jq >/dev/null 2>&1 || missing_tools+=("jq")
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS credentials not configured properly"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Deploy Terraform infrastructure
deploy_terraform() {
    log_info "Deploying Terraform infrastructure..."
    
    cd terraform
    
    # Initialize Terraform with backend configuration
    terraform init \
        -backend-config="bucket=${PROJECT_NAME}-terraform-state" \
        -backend-config="key=multi-region/terraform.tfstate" \
        -backend-config="region=${PRIMARY_REGION}"
    
    # Create terraform.tfvars if it doesn't exist
    if [ ! -f terraform.tfvars ]; then
        cat > terraform.tfvars <<EOF
environment = "${ENVIRONMENT}"
project_name = "${PROJECT_NAME}"
domain_name = "${DOMAIN_NAME}"
enable_rds = false
enable_monitoring = true
enable_waf = true
enable_spot_instances = true
spot_instance_percentage = 70
kubernetes_version = "1.28"

# Regional configuration
aws_region = "${PRIMARY_REGION}"

# Node group configuration
node_group_min_size = 3
node_group_max_size = 20
node_group_desired_size = 5

# Backend scaling
backend_min_replicas = 3
backend_max_replicas = 50

# Frontend scaling  
frontend_min_replicas = 2
frontend_max_replicas = 20
EOF
    fi
    
    # Plan and apply Terraform
    terraform plan -out=tfplan
    terraform apply -auto-approve tfplan
    
    # Output important values
    terraform output -json > ../terraform-outputs.json
    
    cd ..
    
    log_success "Terraform infrastructure deployed"
}

# Configure kubectl for each region
configure_kubectl() {
    local region=$1
    log_info "Configuring kubectl for region: ${region}"
    
    local cluster_name="${PROJECT_NAME}-${ENVIRONMENT}-${region//-/}"
    
    # Update kubeconfig
    aws eks update-kubeconfig \
        --region "${region}" \
        --name "${cluster_name}" \
        --alias "${region}"
    
    # Test connection
    if kubectl --context="${region}" get nodes >/dev/null 2>&1; then
        log_success "Successfully connected to EKS cluster in ${region}"
    else
        log_error "Failed to connect to EKS cluster in ${region}"
        return 1
    fi
}

# Deploy Kubernetes manifests to a region
deploy_k8s_region() {
    local region=$1
    local is_primary=$2
    
    log_info "Deploying Kubernetes manifests to region: ${region}"
    
    # Set kubectl context
    kubectl config use-context "${region}"
    
    # Create namespace
    kubectl create namespace video-chat --dry-run=client -o yaml | kubectl apply -f -
    
    # Generate region-specific configuration
    local temp_dir=$(mktemp -d)
    
    # Copy base manifests
    cp -r k8s/multi-region/* "${temp_dir}/"
    
    # Get region-specific values from Terraform output
    local redis_endpoint=$(jq -r ".multi_region_eks.value.${region}.redis_endpoint" terraform-outputs.json)
    local alb_dns=$(jq -r ".multi_region_eks.value.${region}.alb_dns_name" terraform-outputs.json)
    local global_accelerator=$(jq -r ".webrtc_signaling_accelerator.value.dns_name" terraform-outputs.json)
    
    # Replace placeholders in configuration files
    find "${temp_dir}" -name "*.yaml" -exec sed -i.bak \
        -e "s/REGION_PLACEHOLDER/${region}/g" \
        -e "s/IS_PRIMARY_PLACEHOLDER/${is_primary}/g" \
        -e "s/REDIS_ENDPOINT_PLACEHOLDER/${redis_endpoint}/g" \
        -e "s/GLOBAL_ACCELERATOR_PLACEHOLDER/${global_accelerator}/g" \
        -e "s/PRIMARY_REDIS_PLACEHOLDER/$(jq -r ".multi_region_eks.value.${PRIMARY_REGION}.redis_endpoint" terraform-outputs.json)/g" \
        -e "s/SECONDARY_REGIONS_PLACEHOLDER/$(echo "${REGIONS[@]}" | tr ' ' ',' | sed "s/${region},//;s/,${region}//")/g" \
        -e "s/YOUR_USERNAME/$(whoami)/g" \
        -e "s/ACCOUNT_ID/$(aws sts get-caller-identity --query Account --output text)/g" \
        {} \;
    
    # Deploy ConfigMaps first
    kubectl apply -f "${temp_dir}/configmap.yaml"
    
    # Create secrets
    create_secrets "${region}"
    
    # Deploy applications
    kubectl apply -f "${temp_dir}/backend-deployment.yaml"
    kubectl apply -f "${temp_dir}/hpa-enhanced.yaml"
    
    # Wait for deployments to be ready
    kubectl wait --for=condition=available --timeout=300s deployment/video-chat-backend
    
    # Clean up temp directory
    rm -rf "${temp_dir}"
    
    log_success "Successfully deployed to region: ${region}"
}

# Create Kubernetes secrets
create_secrets() {
    local region=$1
    
    log_info "Creating secrets for region: ${region}"
    
    # Generate JWT secret if not exists
    local jwt_secret
    if ! jwt_secret=$(kubectl get secret video-chat-secrets -o jsonpath='{.data.JWT_SECRET}' 2>/dev/null | base64 -d); then
        jwt_secret=$(openssl rand -base64 32)
    fi
    
    # Get Redis auth token from AWS Secrets Manager
    local redis_secret_name="${PROJECT_NAME}-${ENVIRONMENT}-${region//-/}-redis-auth"
    local redis_password
    if ! redis_password=$(aws secretsmanager get-secret-value --region "${region}" --secret-id "${redis_secret_name}" --query SecretString --output text | jq -r '.auth_token' 2>/dev/null); then
        log_warning "Could not retrieve Redis password from Secrets Manager, using placeholder"
        redis_password="placeholder-redis-password"
    fi
    
    # Create or update secret
    kubectl create secret generic video-chat-secrets \
        --from-literal=JWT_SECRET="${jwt_secret}" \
        --from-literal=REDIS_PASSWORD="${redis_password}" \
        --from-literal=REDIS_AUTH_TOKEN="${redis_password}" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log_success "Secrets created for region: ${region}"
}

# Build and push Docker images
build_and_push_images() {
    log_info "Building and pushing Docker images..."
    
    # Build backend image
    docker build -t "${DOCKER_REGISTRY}/decentralized-video-app-backend:${IMAGE_TAG}" \
        -f docker/Dockerfile.backend .
    
    # Build frontend image (if needed)
    docker build -t "${DOCKER_REGISTRY}/decentralized-video-app-frontend:${IMAGE_TAG}" \
        -f docker/Dockerfile.frontend .
    
    # Push images
    docker push "${DOCKER_REGISTRY}/decentralized-video-app-backend:${IMAGE_TAG}"
    docker push "${DOCKER_REGISTRY}/decentralized-video-app-frontend:${IMAGE_TAG}"
    
    log_success "Docker images built and pushed"
}

# Configure Route 53 DNS records
configure_dns() {
    log_info "Configuring Route 53 DNS records..."
    
    local hosted_zone_id
    if ! hosted_zone_id=$(aws route53 list-hosted-zones-by-name --dns-name "${DOMAIN_NAME}" --query "HostedZones[0].Id" --output text 2>/dev/null); then
        log_warning "Hosted zone for ${DOMAIN_NAME} not found, skipping DNS configuration"
        return 0
    fi
    
    # Remove the /hostedzone/ prefix if present
    hosted_zone_id=${hosted_zone_id#/hostedzone/}
    
    # Create DNS records for each region (handled by Terraform)
    log_success "DNS configuration completed via Terraform"
}

# Deploy monitoring stack
deploy_monitoring() {
    log_info "Deploying monitoring stack..."
    
    # Deploy Prometheus and Grafana via Helm
    for region in "${REGIONS[@]}"; do
        kubectl config use-context "${region}"
        
        # Add Prometheus Helm repo
        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts || true
        helm repo update
        
        # Deploy Prometheus
        helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
            --namespace monitoring \
            --create-namespace \
            --set prometheus.prometheusSpec.retention=30d \
            --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
            --set grafana.adminPassword=admin123 \
            --values monitoring/prometheus-values-${region}.yaml \
            --wait
    done
    
    log_success "Monitoring stack deployed"
}

# Run health checks
run_health_checks() {
    log_info "Running health checks..."
    
    local all_healthy=true
    
    for region in "${REGIONS[@]}"; do
        log_info "Checking health for region: ${region}"
        
        kubectl config use-context "${region}"
        
        # Check pod status
        if ! kubectl get pods -n video-chat | grep -q "Running"; then
            log_error "Not all pods are running in ${region}"
            all_healthy=false
        fi
        
        # Check service endpoints
        local service_endpoint
        if service_endpoint=$(kubectl get service video-chat-backend-service -n video-chat -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null); then
            if curl -f "http://${service_endpoint}/health" >/dev/null 2>&1; then
                log_success "Health check passed for ${region}"
            else
                log_error "Health check failed for ${region}"
                all_healthy=false
            fi
        else
            log_warning "Service endpoint not ready for ${region}"
        fi
    done
    
    if $all_healthy; then
        log_success "All health checks passed"
    else
        log_error "Some health checks failed"
        return 1
    fi
}

# Generate deployment summary
generate_summary() {
    log_info "Generating deployment summary..."
    
    cat > deployment-summary.md <<EOF
# Multi-Region Deployment Summary

## Deployment Details
- **Environment**: ${ENVIRONMENT}
- **Regions**: $(printf '%s, ' "${REGIONS[@]}" | sed 's/, $//')
- **Primary Region**: ${PRIMARY_REGION}
- **Timestamp**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
- **Docker Image**: ${DOCKER_REGISTRY}/decentralized-video-app-backend:${IMAGE_TAG}

## Regional Endpoints
EOF
    
    for region in "${REGIONS[@]}"; do
        echo "- **${region}**: https://api-${region}.${DOMAIN_NAME}" >> deployment-summary.md
    done
    
    cat >> deployment-summary.md <<EOF

## Global Services
- **Frontend CDN**: https://${DOMAIN_NAME}
- **Global Accelerator**: $(jq -r ".webrtc_signaling_accelerator.value.dns_name" terraform-outputs.json 2>/dev/null || echo "N/A")
- **Monitoring**: https://grafana.${DOMAIN_NAME}

## Next Steps
1. Configure DNS records if not automated
2. Set up SSL certificates
3. Configure monitoring alerts
4. Run load testing
5. Update CI/CD pipelines

## Troubleshooting
- Check pod status: \`kubectl get pods -n video-chat --context=<region>\`
- View logs: \`kubectl logs -f deployment/video-chat-backend -n video-chat --context=<region>\`
- Monitor health: \`curl https://api-<region>.${DOMAIN_NAME}/health\`
EOF
    
    log_success "Deployment summary generated: deployment-summary.md"
}

# Cleanup function for failures
cleanup() {
    log_warning "Deployment interrupted, cleaning up..."
    # Add cleanup logic if needed
}

# Main deployment function
main() {
    local start_time=$(date +%s)
    
    log_info "Starting multi-region deployment for ${PROJECT_NAME}"
    log_info "Environment: ${ENVIRONMENT}"
    log_info "Regions: $(printf '%s ' "${REGIONS[@]}")"
    
    # Set up error handling
    trap cleanup EXIT
    
    # Run deployment steps
    check_prerequisites
    
    if [[ "${1:-all}" == "all" || "${1:-all}" == "infrastructure" ]]; then
        deploy_terraform
    fi
    
    if [[ "${1:-all}" == "all" || "${1:-all}" == "images" ]]; then
        build_and_push_images
    fi
    
    if [[ "${1:-all}" == "all" || "${1:-all}" == "kubernetes" ]]; then
        # Configure kubectl for all regions
        for region in "${REGIONS[@]}"; do
            configure_kubectl "${region}"
        done
        
        # Deploy to each region
        for i in "${!REGIONS[@]}"; do
            local region="${REGIONS[$i]}"
            local is_primary="false"
            [[ "${region}" == "${PRIMARY_REGION}" ]] && is_primary="true"
            
            deploy_k8s_region "${region}" "${is_primary}"
        done
    fi
    
    if [[ "${1:-all}" == "all" || "${1:-all}" == "monitoring" ]]; then
        deploy_monitoring
    fi
    
    if [[ "${1:-all}" == "all" || "${1:-all}" == "dns" ]]; then
        configure_dns
    fi
    
    # Run final checks
    run_health_checks
    generate_summary
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "Multi-region deployment completed successfully in ${duration} seconds"
    log_info "Summary available in: deployment-summary.md"
    log_info "Terraform outputs available in: terraform-outputs.json"
}

# Handle script arguments
case "${1:-all}" in
    "infrastructure"|"images"|"kubernetes"|"monitoring"|"dns"|"all")
        main "$1"
        ;;
    "health")
        run_health_checks
        ;;
    "summary")
        generate_summary
        ;;
    *)
        echo "Usage: $0 {infrastructure|images|kubernetes|monitoring|dns|all|health|summary}"
        echo ""
        echo "  infrastructure - Deploy Terraform infrastructure only"
        echo "  images        - Build and push Docker images only" 
        echo "  kubernetes    - Deploy Kubernetes manifests only"
        echo "  monitoring    - Deploy monitoring stack only"
        echo "  dns          - Configure DNS records only"
        echo "  all          - Run complete deployment (default)"
        echo "  health       - Run health checks only"
        echo "  summary      - Generate deployment summary only"
        exit 1
        ;;
esac
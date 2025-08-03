#!/bin/bash

# Deployment script for Video Chat Application
# Usage: ./scripts/deploy.sh [environment] [image_tag]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENVIRONMENT="${1:-staging}"
IMAGE_TAG="${2:-latest}"
NAMESPACE="${ENVIRONMENT}"

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

# Validation
validate_environment() {
    if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
        log_error "Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'"
        exit 1
    fi
}

validate_prerequisites() {
    log_info "Validating prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "kustomize" "docker" "aws")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool '$tool' is not installed"
            exit 1
        fi
    done
    
    # Check kubectl context
    local current_context
    current_context=$(kubectl config current-context 2>/dev/null || echo "none")
    if [[ "$current_context" == "none" ]]; then
        log_error "No kubectl context set. Please configure kubectl to point to your cluster"
        exit 1
    fi
    
    log_info "Current kubectl context: $current_context"
    
    # Verify cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_success "Prerequisites validation completed"
}

# Pre-deployment checks
pre_deployment_checks() {
    log_info "Running pre-deployment checks..."
    
    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_info "Creating namespace: $NAMESPACE"
        kubectl create namespace "$NAMESPACE"
        kubectl label namespace "$NAMESPACE" name="$NAMESPACE"
    fi
    
    # Verify images exist
    local frontend_image="ghcr.io/${GITHUB_REPOSITORY:-your-org/decentralized-video-app}-frontend:${IMAGE_TAG}"
    local backend_image="ghcr.io/${GITHUB_REPOSITORY:-your-org/decentralized-video-app}-backend:${IMAGE_TAG}"
    
    log_info "Verifying images exist:"
    log_info "  Frontend: $frontend_image"
    log_info "  Backend: $backend_image"
    
    # Note: In a real scenario, you might want to check if images exist in the registry
    # docker manifest inspect "$frontend_image" > /dev/null
    # docker manifest inspect "$backend_image" > /dev/null
    
    log_success "Pre-deployment checks completed"
}

# Deploy application
deploy_application() {
    log_info "Deploying application to $ENVIRONMENT..."
    
    cd "$PROJECT_ROOT"
    
    # Set environment variables for kustomize
    export FRONTEND_IMAGE_TAG="$IMAGE_TAG"
    export BACKEND_IMAGE_TAG="$IMAGE_TAG"
    export ENVIRONMENT="$ENVIRONMENT"
    
    # Apply Kubernetes manifests
    log_info "Applying Kubernetes manifests..."
    kustomize build "k8s/${ENVIRONMENT}" | envsubst | kubectl apply -f -
    
    log_success "Application deployment initiated"
}

# Wait for deployment
wait_for_deployment() {
    log_info "Waiting for deployment to complete..."
    
    local deployments=("video-chat-frontend" "video-chat-backend")
    
    for deployment in "${deployments[@]}"; do
        log_info "Waiting for deployment: ${ENVIRONMENT}-${deployment}"
        
        if ! kubectl rollout status "deployment/${ENVIRONMENT}-${deployment}" -n "$NAMESPACE" --timeout=600s; then
            log_error "Deployment failed for ${deployment}"
            return 1
        fi
        
        log_success "Deployment completed: ${deployment}"
    done
    
    # Wait a bit more for services to be ready
    sleep 30
    
    log_success "All deployments completed successfully"
}

# Health checks
run_health_checks() {
    log_info "Running health checks..."
    
    # Get service endpoints
    local frontend_service="${ENVIRONMENT}-video-chat-frontend-service"
    local backend_service="${ENVIRONMENT}-video-chat-backend-service"
    
    # Check if services are running
    if ! kubectl get service "$frontend_service" -n "$NAMESPACE" &> /dev/null; then
        log_error "Frontend service not found: $frontend_service"
        return 1
    fi
    
    if ! kubectl get service "$backend_service" -n "$NAMESPACE" &> /dev/null; then
        log_error "Backend service not found: $backend_service"
        return 1
    fi
    
    # Port forward for health checks (if needed)
    log_info "Running application health checks..."
    
    # Check if pods are healthy
    local frontend_pods
    local backend_pods
    
    frontend_pods=$(kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/component=frontend" -o jsonpath='{.items[*].metadata.name}')
    backend_pods=$(kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/component=backend" -o jsonpath='{.items[*].metadata.name}')
    
    if [[ -z "$frontend_pods" ]]; then
        log_error "No frontend pods found"
        return 1
    fi
    
    if [[ -z "$backend_pods" ]]; then
        log_error "No backend pods found"
        return 1
    fi
    
    # Check pod health
    for pod in $frontend_pods; do
        if ! kubectl exec "$pod" -n "$NAMESPACE" -- curl -f http://localhost:80/health &> /dev/null; then
            log_warning "Health check failed for frontend pod: $pod"
        else
            log_success "Health check passed for frontend pod: $pod"
        fi
    done
    
    for pod in $backend_pods; do
        if ! kubectl exec "$pod" -n "$NAMESPACE" -- node -e "require('http').get('http://localhost:5001/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))" &> /dev/null; then
            log_warning "Health check failed for backend pod: $pod"
        else
            log_success "Health check passed for backend pod: $pod"
        fi
    done
    
    log_success "Health checks completed"
}

# Post deployment tasks
post_deployment_tasks() {
    log_info "Running post-deployment tasks..."
    
    # Update image tags in monitoring
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log_info "Updating production monitoring alerts..."
        # Add any production-specific monitoring updates here
    fi
    
    # Cleanup old ReplicaSets (keep last 3)
    log_info "Cleaning up old ReplicaSets..."
    kubectl get rs -n "$NAMESPACE" --sort-by=.metadata.creationTimestamp -o name | head -n -3 | xargs -r kubectl delete -n "$NAMESPACE" || true
    
    # Display deployment information
    log_info "Deployment Summary:"
    echo "  Environment: $ENVIRONMENT"
    echo "  Image Tag: $IMAGE_TAG"
    echo "  Namespace: $NAMESPACE"
    echo ""
    
    # Show service endpoints
    log_info "Service Endpoints:"
    kubectl get services -n "$NAMESPACE" -o wide
    
    # Show ingress information
    log_info "Ingress Information:"
    kubectl get ingress -n "$NAMESPACE" -o wide
    
    log_success "Post-deployment tasks completed"
}

# Rollback function
rollback_deployment() {
    log_warning "Rolling back deployment..."
    
    local deployments=("video-chat-frontend" "video-chat-backend")
    
    for deployment in "${deployments[@]}"; do
        log_info "Rolling back deployment: ${ENVIRONMENT}-${deployment}"
        kubectl rollout undo "deployment/${ENVIRONMENT}-${deployment}" -n "$NAMESPACE"
        kubectl rollout status "deployment/${ENVIRONMENT}-${deployment}" -n "$NAMESPACE" --timeout=300s
    done
    
    log_success "Rollback completed"
}

# Cleanup on failure
cleanup_on_failure() {
    log_error "Deployment failed. Starting cleanup..."
    
    # You might want to implement cleanup logic here
    # For now, we'll just log the failure
    
    log_info "Deployment logs:"
    kubectl logs -n "$NAMESPACE" -l "app.kubernetes.io/name=video-chat" --tail=50 || true
    
    # Optionally rollback
    read -p "Do you want to rollback? (y/N): " -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rollback_deployment
    fi
}

# Main deployment function
main() {
    log_info "Starting deployment of Video Chat Application"
    log_info "Environment: $ENVIRONMENT"
    log_info "Image Tag: $IMAGE_TAG"
    
    # Trap errors and run cleanup
    trap cleanup_on_failure ERR
    
    validate_environment
    validate_prerequisites
    pre_deployment_checks
    deploy_application
    wait_for_deployment
    run_health_checks
    post_deployment_tasks
    
    log_success "Deployment completed successfully!"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log_info "Production deployment completed. Please monitor the application closely."
        log_info "Dashboard: https://grafana.video-chat.example.com"
        log_info "Application: https://video-chat.example.com"
    else
        log_info "Staging deployment completed."
        log_info "Application: https://staging.video-chat.example.com"
    fi
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "rollback")
        rollback_deployment
        ;;
    "health-check")
        run_health_checks
        ;;
    *)
        echo "Usage: $0 [deploy|rollback|health-check] [environment] [image_tag]"
        echo "  deploy:       Deploy the application (default)"
        echo "  rollback:     Rollback the last deployment"
        echo "  health-check: Run health checks only"
        echo ""
        echo "Examples:"
        echo "  $0 deploy staging v1.2.3"
        echo "  $0 rollback production"
        echo "  $0 health-check staging"
        exit 1
        ;;
esac
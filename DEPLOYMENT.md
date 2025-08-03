# Deployment Guide - Video Chat Application

This guide provides comprehensive instructions for deploying the Video Chat application to production and staging environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Environment Configuration](#environment-configuration)
4. [Deployment Process](#deployment-process)
5. [Monitoring and Observability](#monitoring-and-observability)
6. [Security Considerations](#security-considerations)
7. [Scaling and Performance](#scaling-and-performance)
8. [Troubleshooting](#troubleshooting)
9. [Rollback Procedures](#rollback-procedures)

## Prerequisites

### Required Tools

- **Docker** (v20.10+)
- **kubectl** (v1.28+)
- **AWS CLI** (v2.0+)
- **Terraform** (v1.0+)
- **Kustomize** (v5.0+)
- **GitHub CLI** (optional, for GitHub operations)

### Required Access

- AWS Account with appropriate permissions
- Kubernetes cluster access (EKS recommended)
- Docker registry access (GitHub Container Registry)
- Domain name and DNS management access

### GitHub Secrets Configuration

Configure the following secrets in your GitHub repository:

```bash
# AWS Configuration
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION

# Kubernetes Configuration  
EKS_CLUSTER_NAME
KUBE_CONFIG_DATA

# Application Secrets
JWT_SECRET
REDIS_PASSWORD
DATABASE_URL

# Monitoring
SLACK_WEBHOOK_URL
GRAFANA_PASSWORD

# SSL/TLS
SSL_CERTIFICATE
SSL_PRIVATE_KEY
```

## Infrastructure Setup

### 1. Terraform Infrastructure Deployment

```bash
# Navigate to terraform directory
cd terraform

# Initialize Terraform
terraform init

# Plan infrastructure changes
terraform plan -var="environment=production"

# Apply infrastructure
terraform apply -var="environment=production"

# Get outputs
terraform output
```

### 2. EKS Cluster Configuration

```bash
# Update kubeconfig
aws eks update-kubeconfig --region us-west-2 --name video-chat-production

# Verify cluster access
kubectl cluster-info

# Install metrics server (if not already installed)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

### 3. Install Required Operators

```bash
# Install AWS Load Balancer Controller
kubectl apply -k "github.com/aws/eks-charts/stable/aws-load-balancer-controller/crds?ref=master"

# Install Prometheus Operator
kubectl apply -f https://raw.githubusercontent.com/prometheus-operator/prometheus-operator/main/bundle.yaml
```

## Environment Configuration

### Production Environment

1. **Copy environment template:**
   ```bash
   cp .env.production.example .env.production
   ```

2. **Update critical values:**
   - `JWT_SECRET`: Generate a secure random string
   - `REDIS_PASSWORD`: Set a strong password
   - `DATABASE_URL`: Configure production database connection
   - `FRONTEND_URL`: Set to your production domain

3. **Create Kubernetes secrets:**
   ```bash
   kubectl create secret generic video-chat-secrets \
     --from-env-file=.env.production \
     -n production
   ```

### Staging Environment

1. **Copy staging template:**
   ```bash
   cp .env.staging.example .env.staging
   ```

2. **Create staging secrets:**
   ```bash
   kubectl create secret generic video-chat-secrets \
     --from-env-file=.env.staging \
     -n staging
   ```

## Deployment Process

### Automated Deployment (Recommended)

The CI/CD pipeline automatically deploys when changes are pushed to the main branch:

1. **Trigger deployment:**
   ```bash
   git push origin main
   ```

2. **Monitor deployment:**
   - Check GitHub Actions workflow
   - Monitor deployment status in Kubernetes

### Manual Deployment

For manual deployments or emergency fixes:

```bash
# Build and push images
docker build -f docker/Dockerfile.frontend -t ghcr.io/your-org/video-chat-frontend:v1.0.0 .
docker build -f docker/Dockerfile.backend -t ghcr.io/your-org/video-chat-backend:v1.0.0 .

docker push ghcr.io/your-org/video-chat-frontend:v1.0.0
docker push ghcr.io/your-org/video-chat-backend:v1.0.0

# Deploy to staging
./scripts/deploy.sh staging v1.0.0

# Deploy to production (after staging validation)
./scripts/deploy.sh production v1.0.0
```

### Deployment Verification

```bash
# Run health checks
./scripts/health-check.sh production

# Verify pod status
kubectl get pods -n production

# Check ingress
kubectl get ingress -n production

# Test application endpoints
curl -f https://video-chat.example.com/health
```

## Monitoring and Observability

### Prometheus Metrics

Access Prometheus at: `https://prometheus.video-chat.example.com`

Key metrics to monitor:
- `http_requests_total`: Request count and rate
- `http_request_duration_seconds`: Response time
- `socket_io_connections`: Active WebRTC connections
- `nodejs_memory_usage_bytes`: Memory usage
- `nodejs_cpu_usage_percent`: CPU usage

### Grafana Dashboards

Access Grafana at: `https://grafana.video-chat.example.com`

Default credentials:
- Username: `admin`
- Password: Set via `GRAFANA_PASSWORD` secret

### Log Aggregation

Logs are collected and can be viewed via:
```bash
# Application logs
kubectl logs -n production -l app.kubernetes.io/name=video-chat --tail=100

# Follow logs in real-time
kubectl logs -n production -l app.kubernetes.io/component=backend -f
```

### Alerting

Alerts are configured for:
- High error rates (>5%)
- High response times (>1s)
- Pod crashes and restarts
- High resource usage (>80% CPU/Memory)
- SSL certificate expiration

## Security Considerations

### SSL/TLS Configuration

1. **Certificate Management:**
   - Certificates are managed via AWS Certificate Manager
   - Automatic renewal is enabled
   - HTTPS is enforced via CloudFront and ALB

2. **Security Headers:**
   - CSP (Content Security Policy)
   - HSTS (HTTP Strict Transport Security)
   - X-Frame-Options
   - X-Content-Type-Options

### Network Security

1. **VPC Configuration:**
   - Private subnets for application pods
   - Public subnets for load balancers
   - Network ACLs and Security Groups

2. **Kubernetes Network Policies:**
   - Pod-to-pod communication restrictions
   - Ingress/egress traffic control

### Secrets Management

1. **Kubernetes Secrets:**
   - All sensitive data stored as Kubernetes secrets
   - Encrypted at rest
   - Access controlled via RBAC

2. **AWS Secrets Manager (Optional):**
   ```bash
   # For enhanced secret management
   kubectl apply -f k8s/secrets-manager-csi.yaml
   ```

## Scaling and Performance

### Horizontal Pod Autoscaling

HPA is configured for both frontend and backend:

```yaml
# Frontend: 3-20 replicas based on CPU/Memory
# Backend: 3-50 replicas based on CPU/Memory/Connections
```

### Cluster Autoscaling

```bash
# Enable cluster autoscaler
kubectl apply -f k8s/cluster-autoscaler.yaml
```

### Performance Optimization

1. **CDN Configuration:**
   - CloudFront for static assets
   - Gzip compression enabled
   - Optimized cache policies

2. **Database Optimization:**
   - Connection pooling
   - Read replicas for read-heavy workloads
   - Regular performance monitoring

3. **WebRTC Optimization:**
   - TURN server for NAT traversal
   - Adaptive bitrate streaming
   - Connection quality monitoring

## Troubleshooting

### Common Issues

1. **Pod Crash Loop:**
   ```bash
   # Check pod logs
   kubectl logs <pod-name> -n <namespace> --previous
   
   # Check events
   kubectl describe pod <pod-name> -n <namespace>
   ```

2. **Service Connectivity Issues:**
   ```bash
   # Test service endpoints
   kubectl run test-pod --image=curlimages/curl -it --rm -- \
     curl -f http://service-name.namespace.svc.cluster.local/health
   ```

3. **High Resource Usage:**
   ```bash
   # Check resource usage
   kubectl top pods -n <namespace>
   kubectl top nodes
   ```

4. **Database Connection Issues:**
   ```bash
   # Check database connectivity
   kubectl exec -it <backend-pod> -n <namespace> -- \
     node -e "console.log('DB connection test')"
   ```

### Debug Mode

Enable debug logging:

```bash
# Update environment variable
kubectl patch deployment backend -n production -p \
  '{"spec":{"template":{"spec":{"containers":[{"name":"backend","env":[{"name":"LOG_LEVEL","value":"debug"}]}]}}}}'
```

### Performance Debugging

```bash
# CPU profiling
kubectl exec -it <pod> -- node --prof app.js

# Memory analysis
kubectl exec -it <pod> -- node --inspect app.js
```

## Rollback Procedures

### Automated Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/frontend -n production
kubectl rollout undo deployment/backend -n production

# Rollback to specific revision
kubectl rollout undo deployment/backend --to-revision=2 -n production
```

### Emergency Rollback

```bash
# Use deployment script
./scripts/deploy.sh rollback production

# Or manual rollback
kubectl patch deployment backend -n production -p \
  '{"spec":{"template":{"spec":{"containers":[{"name":"backend","image":"ghcr.io/your-org/video-chat-backend:v1.0.0"}]}}}}'
```

### Database Rollback

```bash
# If database changes are involved
kubectl exec -it postgres-pod -- psql -U username -d database -f rollback.sql
```

## Maintenance Procedures

### Regular Maintenance

1. **Weekly:**
   - Review monitoring alerts
   - Check resource usage trends
   - Update security patches

2. **Monthly:**
   - Review and rotate secrets
   - Update dependencies
   - Performance analysis

3. **Quarterly:**
   - Security audit
   - Disaster recovery testing
   - Capacity planning review

### Backup Procedures

```bash
# Database backup
kubectl exec postgres-pod -- pg_dump -U username database > backup.sql

# Configuration backup
kubectl get all,secrets,configmaps -n production -o yaml > production-backup.yaml
```

### Disaster Recovery

1. **RTO (Recovery Time Objective):** 15 minutes
2. **RPO (Recovery Point Objective):** 1 hour

Recovery procedure:
```bash
# 1. Restore infrastructure via Terraform
terraform apply

# 2. Restore application
kubectl apply -f production-backup.yaml

# 3. Restore database
kubectl exec postgres-pod -- psql -U username -d database -f backup.sql

# 4. Verify functionality
./scripts/health-check.sh production
```

## Support and Contacts

- **Platform Team:** platform-team@company.com
- **On-call:** +1-555-0123
- **Slack:** #video-chat-alerts
- **Runbook:** https://docs.company.com/video-chat

---

**Note:** Always test deployments in staging before deploying to production. This document should be reviewed and updated regularly as the infrastructure evolves.
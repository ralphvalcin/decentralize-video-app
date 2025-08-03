#!/bin/bash

# Health check script for Video Chat Application
# Usage: ./scripts/health-check.sh [environment]

set -euo pipefail

# Configuration
ENVIRONMENT="${1:-staging}"
NAMESPACE="${ENVIRONMENT}"
TIMEOUT=30

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Health check functions
check_pod_health() {
    local component="$1"
    local health_path="$2"
    local port="$3"
    
    log_info "Checking $component health..."
    
    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/component=$component" -o jsonpath='{.items[*].metadata.name}')
    
    if [[ -z "$pods" ]]; then
        log_error "No $component pods found"
        return 1
    fi
    
    local healthy=0
    local total=0
    
    for pod in $pods; do
        total=$((total + 1))
        
        # Check if pod is ready
        local ready
        ready=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
        
        if [[ "$ready" != "True" ]]; then
            log_warning "Pod $pod is not ready"
            continue
        fi
        
        # Check health endpoint
        if kubectl exec "$pod" -n "$NAMESPACE" -- timeout "$TIMEOUT" curl -f "http://localhost:$port$health_path" &> /dev/null; then
            log_success "✓ $pod is healthy"
            healthy=$((healthy + 1))
        else
            log_error "✗ $pod health check failed"
        fi
    done
    
    log_info "$component health: $healthy/$total pods healthy"
    
    if [[ $healthy -eq 0 ]]; then
        return 1
    fi
    
    return 0
}

check_service_connectivity() {
    local service="$1"
    local port="$2"
    
    log_info "Checking service connectivity: $service"
    
    # Check if service exists
    if ! kubectl get service "$service" -n "$NAMESPACE" &> /dev/null; then
        log_error "Service $service not found"
        return 1
    fi
    
    # Get service endpoint
    local endpoint
    endpoint=$(kubectl get service "$service" -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}')
    
    if [[ -z "$endpoint" ]]; then
        log_error "No endpoint found for service $service"
        return 1
    fi
    
    # Test connectivity using a test pod
    local test_pod="health-check-test-$(date +%s)"
    
    kubectl run "$test_pod" -n "$NAMESPACE" --image=curlimages/curl:latest --rm -i --restart=Never -- \
        timeout "$TIMEOUT" curl -f "http://$endpoint:$port/health" &> /dev/null
    
    local result=$?
    
    if [[ $result -eq 0 ]]; then
        log_success "✓ Service $service is reachable"
        return 0
    else
        log_error "✗ Service $service connectivity failed"
        return 1
    fi
}

check_ingress_health() {
    log_info "Checking ingress health..."
    
    local ingress_name="${ENVIRONMENT}-video-chat-ingress"
    
    if ! kubectl get ingress "$ingress_name" -n "$NAMESPACE" &> /dev/null; then
        log_error "Ingress $ingress_name not found"
        return 1
    fi
    
    # Get ingress hosts
    local hosts
    hosts=$(kubectl get ingress "$ingress_name" -n "$NAMESPACE" -o jsonpath='{.spec.rules[*].host}')
    
    if [[ -z "$hosts" ]]; then
        log_error "No hosts found in ingress"
        return 1
    fi
    
    local healthy=0
    local total=0
    
    for host in $hosts; do
        total=$((total + 1))
        
        log_info "Testing host: $host"
        
        # Test external connectivity (if accessible)
        if curl -f -k --max-time "$TIMEOUT" "https://$host/health" &> /dev/null; then
            log_success "✓ Host $host is accessible"
            healthy=$((healthy + 1))
        else
            log_warning "✗ Host $host is not accessible externally (this may be expected in staging)"
        fi
    done
    
    log_info "Ingress health: $healthy/$total hosts accessible"
    return 0
}

check_redis_health() {
    log_info "Checking Redis health..."
    
    local redis_pods
    redis_pods=$(kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/component=redis" -o jsonpath='{.items[*].metadata.name}')
    
    if [[ -z "$redis_pods" ]]; then
        log_warning "No Redis pods found (this may be expected if using external Redis)"
        return 0
    fi
    
    for pod in $redis_pods; do
        if kubectl exec "$pod" -n "$NAMESPACE" -- redis-cli ping &> /dev/null; then
            log_success "✓ Redis pod $pod is healthy"
        else
            log_error "✗ Redis pod $pod health check failed"
            return 1
        fi
    done
    
    return 0
}

check_resource_usage() {
    log_info "Checking resource usage..."
    
    # Check node resources
    log_info "Node resource usage:"
    kubectl top nodes 2>/dev/null || log_warning "Unable to get node metrics (metrics-server may not be installed)"
    
    # Check pod resources
    log_info "Pod resource usage in namespace $NAMESPACE:"
    kubectl top pods -n "$NAMESPACE" 2>/dev/null || log_warning "Unable to get pod metrics"
    
    # Check for resource-constrained pods
    local constrained_pods
    constrained_pods=$(kubectl get pods -n "$NAMESPACE" -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.status.containerStatuses[0].restartCount}{"\n"}{end}' | awk '$2 > 5 {print $1}')
    
    if [[ -n "$constrained_pods" ]]; then
        log_warning "Pods with high restart count (>5):"
        echo "$constrained_pods"
    fi
}

check_logs_for_errors() {
    log_info "Checking recent logs for errors..."
    
    # Check for error patterns in recent logs
    local error_patterns=("ERROR" "FATAL" "Exception" "failed" "timeout")
    
    for pattern in "${error_patterns[@]}"; do
        local error_count
        error_count=$(kubectl logs -n "$NAMESPACE" -l "app.kubernetes.io/name=video-chat" --since=10m --tail=1000 2>/dev/null | grep -i "$pattern" | wc -l || echo "0")
        
        if [[ $error_count -gt 0 ]]; then
            log_warning "Found $error_count occurrences of '$pattern' in recent logs"
        fi
    done
}

generate_health_report() {
    log_info "Generating health report..."
    
    local report_file="/tmp/health-report-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "Video Chat Application Health Report"
        echo "Environment: $ENVIRONMENT"
        echo "Timestamp: $(date)"
        echo "Namespace: $NAMESPACE"
        echo ""
        
        echo "=== Pod Status ==="
        kubectl get pods -n "$NAMESPACE" -o wide
        echo ""
        
        echo "=== Service Status ==="
        kubectl get services -n "$NAMESPACE" -o wide
        echo ""
        
        echo "=== Ingress Status ==="
        kubectl get ingress -n "$NAMESPACE" -o wide
        echo ""
        
        echo "=== Recent Events ==="
        kubectl get events -n "$NAMESPACE" --sort-by='.firstTimestamp' | tail -20
        echo ""
        
        echo "=== Resource Usage ==="
        kubectl top pods -n "$NAMESPACE" 2>/dev/null || echo "Metrics not available"
        
    } > "$report_file"
    
    log_success "Health report generated: $report_file"
}

main() {
    log_info "Starting health checks for Video Chat Application ($ENVIRONMENT)"
    
    local overall_health=0
    
    # Check individual components
    if ! check_pod_health "frontend" "/health" "80"; then
        overall_health=1
    fi
    
    if ! check_pod_health "backend" "/health" "5001"; then
        overall_health=1
    fi
    
    # Check service connectivity
    if ! check_service_connectivity "${ENVIRONMENT}-video-chat-frontend-service" "80"; then
        overall_health=1
    fi
    
    if ! check_service_connectivity "${ENVIRONMENT}-video-chat-backend-service" "5001"; then
        overall_health=1
    fi
    
    # Check Redis
    check_redis_health
    
    # Check ingress
    check_ingress_health
    
    # Check resources
    check_resource_usage
    
    # Check logs
    check_logs_for_errors
    
    # Generate report
    generate_health_report
    
    echo ""
    if [[ $overall_health -eq 0 ]]; then
        log_success "✅ Overall health: HEALTHY"
        log_info "All critical components are functioning normally"
    else
        log_error "❌ Overall health: UNHEALTHY"
        log_error "Some critical components have issues"
        exit 1
    fi
}

# Run main function
main "$@"
#!/bin/bash
# GKE Deployment Helper Script
# This script helps with common GKE deployment tasks

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-}"
CLUSTER_NAME="${GKE_CLUSTER_NAME:-pixelcluster}"
ZONE="${GKE_ZONE:-us-east1-b}"
NAMESPACE="${GKE_NAMESPACE:-pixelated}"
DEPLOYMENT_NAME="${GKE_DEPLOYMENT_NAME:-pixelated}"
SERVICE_NAME="${GKE_SERVICE_NAME:-pixelated-service}"

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI is not installed"
        exit 1
    fi
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed"
        exit 1
    fi
    
    # Check if project ID is set
    if [ -z "$PROJECT_ID" ]; then
        log_error "GCP_PROJECT_ID environment variable is not set"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Setup GCP authentication
setup_auth() {
    log_info "Setting up GCP authentication..."
    
    if [ -n "${GCP_SERVICE_ACCOUNT_KEY:-}" ]; then
        echo "$GCP_SERVICE_ACCOUNT_KEY" > /tmp/gcp-key.json
        gcloud auth activate-service-account --key-file=/tmp/gcp-key.json
        gcloud config set project "$PROJECT_ID"
        log_success "GCP authentication configured"
    else
        log_warning "GCP_SERVICE_ACCOUNT_KEY not set, using default authentication"
    fi
}

# Get cluster credentials
get_credentials() {
    log_info "Getting cluster credentials..."
    
    if gcloud container clusters get-credentials "$CLUSTER_NAME" --zone "$ZONE" --project "$PROJECT_ID"; then
        log_success "Cluster credentials obtained"
    else
        log_error "Failed to get cluster credentials"
        exit 1
    fi
}

# Create namespace
create_namespace() {
    log_info "Creating namespace: $NAMESPACE"
    
    if kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -; then
        log_success "Namespace $NAMESPACE ready"
    else
        log_error "Failed to create namespace"
        exit 1
    fi
}

# Deploy application
deploy() {
    log_info "Deploying application..."
    
    # Apply manifests
    if kubectl apply -f k8s/manifests.yaml; then
        log_success "Manifests applied successfully"
    else
        log_error "Failed to apply manifests"
        exit 1
    fi
    
    # Wait for deployment to be ready
    log_info "Waiting for deployment to be ready..."
    if kubectl rollout status deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE" --timeout=600s; then
        log_success "Deployment is ready"
    else
        log_error "Deployment failed to become ready"
        exit 1
    fi
}

# Check deployment status
status() {
    log_info "Checking deployment status..."
    
    echo "Deployment:"
    kubectl get deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" -o wide
    
    echo -e "\nPods:"
    kubectl get pods -l app=pixelated -n "$NAMESPACE" -o wide
    
    echo -e "\nServices:"
    kubectl get service "$SERVICE_NAME" -n "$NAMESPACE"
    
    echo -e "\nIngress:"
    kubectl get ingress -n "$NAMESPACE" || echo "No ingress found"
    
    echo -e "\nHPA:"
    kubectl get hpa -n "$NAMESPACE" || echo "No HPA found"
    
    # Check pod health
    READY_PODS=$(kubectl get pods -l app=pixelated -n "$NAMESPACE" -o json | jq '[.items[] | select(.status.phase == "Running" and (.status.containerStatuses[]?.ready // false))] | length')
    TOTAL_PODS=$(kubectl get pods -l app=pixelated -n "$NAMESPACE" -o json | jq '.items | length')
    
    echo -e "\nHealth Summary: $READY_PODS/$TOTAL_PODS pods ready"
    
    if [ "$READY_PODS" -eq "$TOTAL_PODS" ] && [ "$TOTAL_PODS" -gt 0 ]; then
        log_success "All pods are healthy"
    elif [ "$READY_PODS" -gt 0 ]; then
        log_warning "Some pods are not ready"
    else
        log_error "No healthy pods found"
    fi
}

# Show logs
logs() {
    local follow="${1:-false}"
    
    log_info "Showing application logs..."
    
    if [ "$follow" = "true" ]; then
        kubectl logs -f deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE"
    else
        kubectl logs deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE" --tail=100
    fi
}

# Scale deployment
scale() {
    local replicas="${1:-3}"
    
    log_info "Scaling deployment to $replicas replicas..."
    
    if kubectl scale deployment "$DEPLOYMENT_NAME" --replicas="$replicas" -n "$NAMESPACE"; then
        log_success "Deployment scaled to $replicas replicas"
        
        # Wait for scaling to complete
        kubectl rollout status deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE" --timeout=300s
    else
        log_error "Failed to scale deployment"
        exit 1
    fi
}

# Rollback deployment
rollback() {
    log_info "Rolling back deployment..."
    
    # Show rollout history
    echo "Rollout history:"
    kubectl rollout history deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE"
    
    # Rollback to previous revision
    if kubectl rollout undo deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE"; then
        log_success "Rollback initiated"
        
        # Wait for rollback to complete
        kubectl rollout status deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE" --timeout=300s
        log_success "Rollback completed"
    else
        log_error "Rollback failed"
        exit 1
    fi
}

# Port forward for local testing
port_forward() {
    local local_port="${1:-8080}"
    
    log_info "Setting up port forward to localhost:$local_port"
    log_info "Access the application at http://localhost:$local_port"
    log_info "Press Ctrl+C to stop port forwarding"
    
    kubectl port-forward service/"$SERVICE_NAME" "$local_port":80 -n "$NAMESPACE"
}

# Health check
health_check() {
    log_info "Running health check..."
    
    # Check if service is accessible
    SERVICE_IP=$(kubectl get service "$SERVICE_NAME" -n "$NAMESPACE" -o json | jq -r '.spec.clusterIP')
    
    if [ "$SERVICE_IP" != "null" ] && [ -n "$SERVICE_IP" ]; then
        log_success "Service IP: $SERVICE_IP"
        
        # Try to access health endpoint via port forward
        log_info "Testing health endpoint..."
        kubectl port-forward service/"$SERVICE_NAME" 8080:80 -n "$NAMESPACE" &
        PF_PID=$!
        
        sleep 5
        
        if curl -f http://localhost:8080/api/health >/dev/null 2>&1; then
            log_success "Health check passed"
        else
            log_warning "Health check failed (may be expected in some environments)"
        fi
        
        kill $PF_PID 2>/dev/null || true
    else
        log_error "Service not found or not accessible"
    fi
}

# Cleanup resources
cleanup() {
    log_warning "This will delete all resources in namespace $NAMESPACE"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleaning up resources..."
        
        if kubectl delete namespace "$NAMESPACE"; then
            log_success "Namespace $NAMESPACE deleted"
        else
            log_error "Failed to delete namespace"
            exit 1
        fi
    else
        log_info "Cleanup cancelled"
    fi
}

# Show help
show_help() {
    cat << EOF
GKE Deployment Helper Script

Usage: $0 <command> [options]

Commands:
    deploy          Deploy the application to GKE
    status          Show deployment status
    logs [follow]   Show application logs (add 'follow' to tail logs)
    scale <n>       Scale deployment to n replicas
    rollback        Rollback to previous deployment
    port-forward [port] Port forward to localhost (default: 8080)
    health-check    Run health check
    cleanup         Delete all resources (destructive!)
    help            Show this help message

Environment Variables:
    GCP_PROJECT_ID          GCP project ID (required)
    GCP_SERVICE_ACCOUNT_KEY Service account key JSON (optional)
    GKE_CLUSTER_NAME        Cluster name (default: pixelcluster)
    GKE_ZONE                GCP zone (default: us-east1-b)
    GKE_NAMESPACE           Kubernetes namespace (default: pixelated)

Examples:
    $0 deploy                    # Deploy application
    $0 status                    # Check status
    $0 logs follow               # Follow logs
    $0 scale 5                   # Scale to 5 replicas
    $0 port-forward 3000         # Port forward to localhost:3000
    $0 health-check              # Run health check
    $0 cleanup                   # Delete all resources

EOF
}

# Main script logic
main() {
    case "${1:-help}" in
        deploy)
            check_prerequisites
            setup_auth
            get_credentials
            create_namespace
            deploy
            status
            ;;
        status)
            check_prerequisites
            setup_auth
            get_credentials
            status
            ;;
        logs)
            check_prerequisites
            setup_auth
            get_credentials
            logs "${2:-false}"
            ;;
        scale)
            if [ -z "${2:-}" ]; then
                log_error "Please specify number of replicas"
                exit 1
            fi
            check_prerequisites
            setup_auth
            get_credentials
            scale "$2"
            ;;
        rollback)
            check_prerequisites
            setup_auth
            get_credentials
            rollback
            ;;
        port-forward)
            check_prerequisites
            setup_auth
            get_credentials
            port_forward "${2:-8080}"
            ;;
        health-check)
            check_prerequisites
            setup_auth
            get_credentials
            health_check
            ;;
        cleanup)
            check_prerequisites
            setup_auth
            get_credentials
            cleanup
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: ${1:-}"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
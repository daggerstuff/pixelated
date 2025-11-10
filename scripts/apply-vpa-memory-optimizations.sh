#!/bin/bash
# Apply VPA Memory Optimization Recommendations
# Increases Cert-Manager memory requests from 64Mi to 100Mi

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Check kubectl access
check_kubectl() {
    if ! kubectl cluster-info &>/dev/null; then
        error "Cannot connect to Kubernetes cluster"
    fi
    log "Connected to cluster: $(kubectl config current-context)"
}

# Update Cert-Manager Controller memory
update_cert_manager_controller() {
    log "Updating cert-manager controller memory request to 100Mi..."
    
    kubectl patch deployment cert-manager -n cert-manager --type='json' -p='[
        {
            "op": "replace",
            "path": "/spec/template/spec/containers/0/resources/requests/memory",
            "value": "100Mi"
        }
    ]' || error "Failed to update cert-manager controller"
    
    success "Cert-Manager controller memory updated to 100Mi"
}

# Update Cert-Manager CA Injector memory
update_cert_manager_cainjector() {
    log "Updating cert-manager cainjector memory request to 100Mi..."
    
    kubectl patch deployment cert-manager-cainjector -n cert-manager --type='json' -p='[
        {
            "op": "replace",
            "path": "/spec/template/spec/containers/0/resources/requests/memory",
            "value": "100Mi"
        }
    ]' || error "Failed to update cert-manager cainjector"
    
    success "Cert-Manager cainjector memory updated to 100Mi"
}

# Update Cert-Manager Webhook memory
update_cert_manager_webhook() {
    log "Updating cert-manager webhook memory request to 100Mi..."
    
    kubectl patch deployment cert-manager-webhook -n cert-manager --type='json' -p='[
        {
            "op": "replace",
            "path": "/spec/template/spec/containers/0/resources/requests/memory",
            "value": "100Mi"
        }
    ]' || error "Failed to update cert-manager webhook"
    
    success "Cert-Manager webhook memory updated to 100Mi"
}

# Wait for rollouts
wait_for_rollouts() {
    log "Waiting for deployments to roll out..."
    
    for deployment in cert-manager cert-manager-cainjector cert-manager-webhook; do
        log "Waiting for $deployment..."
        kubectl rollout status deployment/"$deployment" -n cert-manager --timeout=300s || warning "$deployment rollout may have issues"
    done
    
    success "All rollouts completed"
}

# Verify updates
verify_updates() {
    log "Verifying memory requests..."
    
    for deployment in cert-manager cert-manager-cainjector cert-manager-webhook; do
        local memory=$(kubectl get deployment "$deployment" -n cert-manager -o jsonpath='{.spec.template.spec.containers[0].resources.requests.memory}' 2>/dev/null)
        if [ "$memory" = "100Mi" ]; then
            success "$deployment: Memory request is 100Mi"
        else
            warning "$deployment: Memory request is $memory (expected 100Mi)"
        fi
    done
}

# Show resource summary
show_summary() {
    log "Resource optimization summary:"
    echo ""
    
    info "Cert-Manager Resources:"
    for deployment in cert-manager cert-manager-cainjector cert-manager-webhook; do
        echo "  $deployment:"
        kubectl get deployment "$deployment" -n cert-manager -o jsonpath='{.spec.template.spec.containers[0].resources}' | jq '.' 2>/dev/null || echo "    Resources configured"
    done
}

# Main function
main() {
    log "🚀 Applying VPA Memory Optimization Recommendations"
    echo ""
    
    check_kubectl
    
    # Update memory requests
    update_cert_manager_controller
    update_cert_manager_cainjector
    update_cert_manager_webhook
    
    # Wait for rollouts
    wait_for_rollouts
    
    # Verify updates
    verify_updates
    
    # Show summary
    show_summary
    
    echo ""
    success "Memory optimization completed!"
    log "Changes applied:"
    echo "  - Cert-Manager Controller: 64Mi → 100Mi"
    echo "  - Cert-Manager CA Injector: 64Mi → 100Mi"
    echo "  - Cert-Manager Webhook: 64Mi → 100Mi"
    echo ""
    log "Next steps:"
    echo "  1. Monitor pods for 24-48 hours"
    echo "  2. Verify no OOM kills occur"
    echo "  3. Check memory usage: kubectl top pods -n cert-manager"
    echo "  4. Review VPA recommendations: kubectl describe vpa -n cert-manager"
}

# Run main
main "$@"


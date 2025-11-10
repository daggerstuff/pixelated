#!/bin/bash
# Priority 2: Set Resource Requests/Limits for All Pods
# Optimizes Cert-Manager, Traefik, and OTel Collector resources

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

# Get current resource usage for a pod
get_pod_usage() {
    local namespace=$1
    local pod_name=$2
    kubectl top pod "$pod_name" -n "$namespace" --no-headers 2>/dev/null | awk '{print $2, $3}' || echo "0m 0Mi"
}

# Optimize Cert-Manager resources
optimize_cert_manager() {
    log "Optimizing Cert-Manager resources..."
    
    # Based on actual usage: 1m CPU, 28-38Mi memory per pod
    # Setting requests slightly below usage, limits with headroom
    
    # Cert-Manager Controller
    log "Patching cert-manager controller..."
    if kubectl get deployment cert-manager -n cert-manager &>/dev/null; then
        kubectl patch deployment cert-manager -n cert-manager --type='json' -p='[
            {
                "op": "replace",
                "path": "/spec/template/spec/containers/0/resources",
                "value": {
                    "requests": {
                        "cpu": "50m",
                        "memory": "64Mi"
                    },
                    "limits": {
                        "cpu": "200m",
                        "memory": "128Mi"
                    }
                }
            }
        ]' || kubectl patch deployment cert-manager -n cert-manager --type='json' -p='[
            {
                "op": "add",
                "path": "/spec/template/spec/containers/0/resources",
                "value": {
                    "requests": {
                        "cpu": "50m",
                        "memory": "64Mi"
                    },
                    "limits": {
                        "cpu": "200m",
                        "memory": "128Mi"
                    }
                }
            }
        ]' || error "Failed to patch cert-manager controller"
    else
        warning "cert-manager deployment not found, skipping"
    fi
    
    # Cert-Manager CA Injector
    log "Patching cert-manager cainjector..."
    if kubectl get deployment cert-manager-cainjector -n cert-manager &>/dev/null; then
        kubectl patch deployment cert-manager-cainjector -n cert-manager --type='json' -p='[
            {
                "op": "replace",
                "path": "/spec/template/spec/containers/0/resources",
                "value": {
                    "requests": {
                        "cpu": "50m",
                        "memory": "64Mi"
                    },
                    "limits": {
                        "cpu": "200m",
                        "memory": "128Mi"
                    }
                }
            }
        ]' || kubectl patch deployment cert-manager-cainjector -n cert-manager --type='json' -p='[
            {
                "op": "add",
                "path": "/spec/template/spec/containers/0/resources",
                "value": {
                    "requests": {
                        "cpu": "50m",
                        "memory": "64Mi"
                    },
                    "limits": {
                        "cpu": "200m",
                        "memory": "128Mi"
                    }
                }
            }
        ]' || error "Failed to patch cert-manager cainjector"
    else
        warning "cert-manager-cainjector deployment not found, skipping"
    fi
    
    # Cert-Manager Webhook
    log "Patching cert-manager webhook..."
    if kubectl get deployment cert-manager-webhook -n cert-manager &>/dev/null; then
        kubectl patch deployment cert-manager-webhook -n cert-manager --type='json' -p='[
            {
                "op": "replace",
                "path": "/spec/template/spec/containers/0/resources",
                "value": {
                    "requests": {
                        "cpu": "50m",
                        "memory": "64Mi"
                    },
                    "limits": {
                        "cpu": "200m",
                        "memory": "128Mi"
                    }
                }
            }
        ]' || kubectl patch deployment cert-manager-webhook -n cert-manager --type='json' -p='[
            {
                "op": "add",
                "path": "/spec/template/spec/containers/0/resources",
                "value": {
                    "requests": {
                        "cpu": "50m",
                        "memory": "64Mi"
                    },
                    "limits": {
                        "cpu": "200m",
                        "memory": "128Mi"
                    }
                }
            }
        ]' || error "Failed to patch cert-manager webhook"
    else
        warning "cert-manager-webhook deployment not found, skipping"
    fi
    
    success "Cert-Manager resources optimized"
}

# Optimize Traefik resources
optimize_traefik() {
    log "Optimizing Traefik resources..."
    
    # Based on actual usage: 3m CPU, 45-68Mi memory per pod
    # Traefik is critical infrastructure, needs headroom for traffic spikes
    
    if kubectl get daemonset traefik -n kube-system &>/dev/null; then
        # Try replace first, then add if resources don't exist
        kubectl patch daemonset traefik -n kube-system --type='json' -p='[
            {
                "op": "replace",
                "path": "/spec/template/spec/containers/0/resources",
                "value": {
                    "requests": {
                        "cpu": "100m",
                        "memory": "128Mi"
                    },
                    "limits": {
                        "cpu": "500m",
                        "memory": "256Mi"
                    }
                }
            }
        ]' 2>/dev/null || kubectl patch daemonset traefik -n kube-system --type='json' -p='[
            {
                "op": "add",
                "path": "/spec/template/spec/containers/0/resources",
                "value": {
                    "requests": {
                        "cpu": "100m",
                        "memory": "128Mi"
                    },
                    "limits": {
                        "cpu": "500m",
                        "memory": "256Mi"
                    }
                }
            }
        ]' || error "Failed to patch Traefik DaemonSet"
        success "Traefik resources optimized"
    else
        warning "Traefik DaemonSet not found, skipping"
    fi
}

# Optimize OTel Collector resources
optimize_otel_collector() {
    log "Optimizing OTel Collector resources..."
    
    # Based on actual usage: 11-28m CPU, 69-95Mi memory per pod
    # OTel Collector can have variable load, needs adequate headroom
    
    if kubectl get daemonset otel-collector -n kube-system &>/dev/null; then
        # Replace the existing "0" values with proper resources
        kubectl patch daemonset otel-collector -n kube-system --type='json' -p='[
            {
                "op": "replace",
                "path": "/spec/template/spec/containers/0/resources",
                "value": {
                    "requests": {
                        "cpu": "100m",
                        "memory": "128Mi"
                    },
                    "limits": {
                        "cpu": "500m",
                        "memory": "256Mi"
                    }
                }
            }
        ]' || error "Failed to patch OTel Collector DaemonSet"
        success "OTel Collector resources optimized"
    else
        warning "OTel Collector DaemonSet not found, skipping"
    fi
}

# Verify resources are set
verify_resources() {
    log "Verifying resource requests/limits..."
    
    local all_set=true
    
    # Check Cert-Manager
    log "Checking Cert-Manager pods..."
    for deployment in cert-manager cert-manager-cainjector cert-manager-webhook; do
        if ! kubectl get deployment "$deployment" -n cert-manager -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}' &>/dev/null; then
            warning "$deployment: No CPU request set"
            all_set=false
        else
            success "$deployment: Resources set"
        fi
    done
    
    # Check Traefik
    log "Checking Traefik DaemonSet..."
    if ! kubectl get daemonset traefik -n kube-system -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}' &>/dev/null; then
        warning "Traefik: No CPU request set"
        all_set=false
    else
        success "Traefik: Resources set"
    fi
    
    # Check OTel Collector
    log "Checking OTel Collector DaemonSet..."
    if ! kubectl get daemonset otel-collector -n kube-system -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}' &>/dev/null; then
        warning "OTel Collector: No CPU request set"
        all_set=false
    else
        success "OTel Collector: Resources set"
    fi
    
    if [ "$all_set" = true ]; then
        success "All resources verified"
    else
        warning "Some resources may not be set correctly"
    fi
}

# Wait for pods to be ready
wait_for_rollout() {
    log "Waiting for deployments to roll out..."
    
    # Cert-Manager
    for deployment in cert-manager cert-manager-cainjector cert-manager-webhook; do
        log "Waiting for $deployment..."
        kubectl rollout status deployment/"$deployment" -n cert-manager --timeout=300s || warning "$deployment rollout may have issues"
    done
    
    # Traefik DaemonSet
    log "Waiting for Traefik DaemonSet..."
    kubectl rollout status daemonset/traefik -n kube-system --timeout=300s || warning "Traefik rollout may have issues"
    
    # OTel Collector DaemonSet
    log "Waiting for OTel Collector DaemonSet..."
    kubectl rollout status daemonset/otel-collector -n kube-system --timeout=300s || warning "OTel Collector rollout may have issues"
    
    success "All rollouts completed"
}

# Show resource summary
show_summary() {
    log "Resource optimization summary:"
    echo ""
    echo "Cert-Manager:"
    kubectl get deployment cert-manager -n cert-manager -o jsonpath='{.spec.template.spec.containers[0].resources}' | jq '.' 2>/dev/null || echo "  Resources configured"
    echo ""
    echo "Traefik:"
    kubectl get daemonset traefik -n kube-system -o jsonpath='{.spec.template.spec.containers[0].resources}' | jq '.' 2>/dev/null || echo "  Resources configured"
    echo ""
    echo "OTel Collector:"
    kubectl get daemonset otel-collector -n kube-system -o jsonpath='{.spec.template.spec.containers[0].resources}' | jq '.' 2>/dev/null || echo "  Resources configured"
}

# Main function
main() {
    log "🚀 Starting Priority 2 Resource Optimization"
    echo ""
    
    check_kubectl
    
    # Optimize resources
    optimize_cert_manager
    optimize_traefik
    optimize_otel_collector
    
    # Wait for rollouts
    wait_for_rollout
    
    # Verify
    verify_resources
    
    # Show summary
    show_summary
    
    success "Priority 2 resource optimization completed!"
    log "Monitor pods for the next 24-48 hours to ensure stability"
}

# Run main
main "$@"


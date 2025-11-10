#!/bin/bash

# Cluster Resource Optimization Script
# This script implements cost-saving optimizations for the Kubernetes cluster
# Based on actual resource usage analysis

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
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

# Check if required tools are installed
check_dependencies() {
    log "Checking dependencies..."
    
    local required_tools=("kubectl" "helm")
    for tool in "${required_tools[@]}"; do
        if ! command -v "${tool}" &> /dev/null; then
            error "Required tool not found: ${tool}"
        fi
    done
    
    success "All dependencies found"
}

# Verify cluster access
verify_cluster_access() {
    log "Verifying Kubernetes cluster access..."
    
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot access Kubernetes cluster"
    fi
    
    success "Successfully connected to cluster"
}

# Optimize Metoro exporter resources
optimize_metoro_exporter() {
    log "Optimizing Metoro exporter resources..."
    
    # Load JWT token from environment or use default
    local jwt_token="${METORO_JWT_TOKEN:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoib3JnXzM0WkVQYXdPSngzRk5VNDlsM2pJdW00dVBndiIsImVudmlyb25tZW50IjoicGl4ZWxjbHVzdGVyIiwiZXhwIjoyMDc2NzcyODQ5fQ.4r_2a41BsoOY31e2q6YFhm-hhytObYngAyaR1bTE0O0}"
    
    log "Updating Metoro exporter with optimized resources..."
    log "  CPU: 50m (was 1000m) - saves 950m CPU"
    log "  Memory: 128Mi (was 2Gi) - saves ~1.9GB memory"
    
    if ! helm upgrade --install --namespace metoro metoro-exporter metoro-exporter/metoro-exporter \
        --set exporter.secret.bearerToken="${jwt_token}" \
        --set exporter.replicas=1 \
        --set exporter.autoscaling.horizontalPodAutoscaler.enabled=false \
        --set exporter.resources.requests.cpu=50m \
        --set exporter.resources.requests.memory=128Mi \
        --set exporter.resources.limits.cpu=200m \
        --set exporter.resources.limits.memory=512Mi; then
        error "Failed to update Metoro exporter"
    fi
    
    success "Metoro exporter resources optimized"
}

# Optimize Metoro node agent resources
optimize_metoro_node_agent() {
    log "Optimizing Metoro node agent resources..."
    
    # Node agents are using 809-935Mi but only requesting 300Mi
    # This causes memory pressure and potential throttling
    log "Updating node agent memory requests..."
    log "  Memory: 1024Mi (was 300Mi) - fixes under-provisioning"
    log "  Note: Node agents are DaemonSets, so this affects all 3 nodes"
    
    local jwt_token="${METORO_JWT_TOKEN:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoib3JnXzM0WkVQYXdPSngzRk5VNDlsM2pJdW00dVBndiIsImVudmlyb25tZW50IjoicGl4ZWxjbHVzdGVyIiwiZXhwIjoyMDc2NzcyODQ5fQ.4r_2a41BsoOY31e2q6YFhm-hhytObYngAyaR1bTE0O0}"
    
    # Get current exporter settings to preserve them
    if ! helm upgrade --install --namespace metoro metoro-exporter metoro-exporter/metoro-exporter \
        --set exporter.secret.bearerToken="${jwt_token}" \
        --set exporter.replicas=1 \
        --set exporter.autoscaling.horizontalPodAutoscaler.enabled=false \
        --set exporter.resources.requests.cpu=50m \
        --set exporter.resources.requests.memory=128Mi \
        --set exporter.resources.limits.cpu=200m \
        --set exporter.resources.limits.memory=512Mi \
        --set nodeAgent.resources.requests.cpu=300m \
        --set nodeAgent.resources.requests.memory=1024Mi \
        --set nodeAgent.resources.limits.cpu=1000m \
        --set nodeAgent.resources.limits.memory=2048Mi; then
        error "Failed to update Metoro node agent"
    fi
    
    success "Metoro node agent resources optimized"
    warning "Node agents will restart to apply new resource limits"
}

# Optimize Pixelated service
optimize_pixelated_service() {
    log "Optimizing Pixelated service..."
    
    local current_replicas
    current_replicas=$(kubectl get deployment pixelated -n pixelated -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "3")
    
    log "Current replicas: ${current_replicas}"
    
    if [ "${current_replicas}" -gt 2 ]; then
        log "Reducing replicas from ${current_replicas} to 2..."
        
        if ! kubectl scale deployment pixelated -n pixelated --replicas=2; then
            error "Failed to scale Pixelated deployment"
        fi
        
        success "Pixelated replicas reduced to 2"
        
        # Enable HPA for auto-scaling
        log "Enabling Horizontal Pod Autoscaler (HPA)..."
        
        if kubectl get hpa pixelated -n pixelated &>/dev/null; then
            log "HPA already exists, updating..."
            if ! kubectl autoscale deployment pixelated -n pixelated \
                --min=2 --max=5 --cpu-percent=70 --dry-run=client -o yaml | kubectl apply -f -; then
                warning "Failed to update HPA, but deployment scaled successfully"
            fi
        else
            log "Creating HPA..."
            if ! kubectl autoscale deployment pixelated -n pixelated \
                --min=2 --max=5 --cpu-percent=70; then
                warning "Failed to create HPA, but deployment scaled successfully"
            fi
        fi
        
        success "HPA configured for Pixelated service (min: 2, max: 5, CPU: 70%)"
    else
        log "Pixelated already has ${current_replicas} replicas, skipping optimization"
    fi
}

# Show resource usage summary
show_resource_summary() {
    log "Current resource usage summary:"
    echo ""
    
    echo "=== CPU Usage ==="
    kubectl top nodes --no-headers 2>/dev/null | awk '{sum+=$3; count++} END {if(count>0) print "  Total: " sum "m (" (sum/(count*2000)*100) "% of cluster)"}'
    
    echo ""
    echo "=== Memory Usage ==="
    kubectl top nodes --no-headers 2>/dev/null | awk '{sum+=$5; count++} END {if(count>0) print "  Total: " sum " (" (sum/(count*3834)*100) "% of cluster)"}'
    
    echo ""
    echo "=== Pod Count ==="
    kubectl get pods --all-namespaces --no-headers 2>/dev/null | wc -l | awk '{print "  Total pods: " $1}'
    
    echo ""
    echo "=== Metoro Exporter ==="
    kubectl get pods -n metoro -l app.kubernetes.io/name=metoro-exporter -o jsonpath='{.items[0].spec.containers[0].resources.requests.cpu}{" CPU, "}{.items[0].spec.containers[0].resources.requests.memory}{" memory requested"}' 2>/dev/null || echo "  Not found"
    
    echo ""
    echo "=== Pixelated Service ==="
    kubectl get deployment pixelated -n pixelated -o jsonpath='{.spec.replicas}{" replicas"}' 2>/dev/null || echo "  Not found"
}

# Main function
main() {
    local action="${1:-all}"
    
    log "🚀 Starting cluster resource optimization"
    
    check_dependencies
    verify_cluster_access
    
    case "${action}" in
        "exporter")
            optimize_metoro_exporter
            ;;
        "node-agent")
            optimize_metoro_node_agent
            ;;
        "pixelated")
            optimize_pixelated_service
            ;;
        "all")
            optimize_metoro_exporter
            optimize_metoro_node_agent
            optimize_pixelated_service
            ;;
        "summary")
            show_resource_summary
            exit 0
            ;;
        *)
            echo "Usage: $0 [exporter|node-agent|pixelated|all|summary]"
            echo ""
            echo "Actions:"
            echo "  exporter    - Optimize Metoro exporter resources"
            echo "  node-agent  - Optimize Metoro node agent resources"
            echo "  pixelated   - Optimize Pixelated service (reduce replicas, enable HPA)"
            echo "  all         - Apply all optimizations (default)"
            echo "  summary     - Show current resource usage summary"
            exit 1
            ;;
    esac
    
    log "⏳ Waiting for changes to take effect..."
    sleep 5
    
    show_resource_summary
    
    log "🎉 Cluster optimization completed!"
    log "Monitor the cluster for the next 24-48 hours to validate changes"
}

# Run main function
main "$@"


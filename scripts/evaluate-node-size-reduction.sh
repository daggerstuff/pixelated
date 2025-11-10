#!/bin/bash
# Priority 2.1: Evaluate Node Size Reduction Options
# Checks if smaller node sizes are available and evaluates feasibility

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

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check kubectl access
check_kubectl() {
    if ! kubectl cluster-info &>/dev/null; then
        error "Cannot connect to Kubernetes cluster"
    fi
    log "Connected to cluster: $(kubectl config current-context)"
}

# Get current node information
get_node_info() {
    log "Analyzing current node configuration..."
    
    echo ""
    info "Current Nodes:"
    kubectl get nodes -o custom-columns=NAME:.metadata.name,INSTANCE-TYPE:.metadata.labels.node\\.kubernetes\\.io/instance-type,CPU:.status.capacity.cpu,MEMORY:.status.capacity.memory 2>/dev/null || kubectl get nodes
    
    echo ""
    info "Node Capacity:"
    kubectl top nodes 2>/dev/null || warning "Metrics server not available, cannot get node usage"
}

# Calculate resource requirements
calculate_requirements() {
    log "Calculating total resource requirements..."
    
    echo ""
    info "Total Resource Requests:"
    kubectl describe nodes | grep -A 5 "Allocated resources:" || warning "Could not get allocated resources"
    
    echo ""
    info "Pod Resource Requests by Namespace:"
    for ns in $(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}'); do
        cpu=$(kubectl get pods -n "$ns" -o jsonpath='{.items[*].spec.containers[*].resources.requests.cpu}' 2>/dev/null | tr -s ' ' '\n' | sed 's/m$//' | awk '{sum+=$1} END {print sum/1000 " cores"}' || echo "N/A")
        mem=$(kubectl get pods -n "$ns" -o jsonpath='{.items[*].spec.containers[*].resources.requests.memory}' 2>/dev/null | tr -s ' ' '\n' | sed 's/Mi$//' | awk '{sum+=$1} END {print sum/1024 " GB"}' || echo "N/A")
        if [ "$cpu" != "N/A" ] && [ "$cpu" != " cores" ]; then
            echo "  $ns: CPU=$cpu, Memory=$mem"
        fi
    done
}

# Check Civo instance types (if using Civo CLI)
check_civo_instance_types() {
    log "Checking available Civo instance types..."
    
    if command -v civo &>/dev/null; then
        info "Available Civo instance types:"
        civo instance size list 2>/dev/null | grep -E "(g4s\.kube\.|NAME)" || warning "Could not list Civo instance types"
        
        echo ""
        info "Current cluster node pool:"
        civo kubernetes show pixelated-empathy-civo 2>/dev/null | grep -i "node.*pool\|instance" || warning "Could not get cluster node pool info"
    else
        warning "Civo CLI not installed. Install it to check available instance types:"
        echo "  curl -sSL https://civo.com/get | sh"
    fi
}

# Analyze feasibility
analyze_feasibility() {
    log "Analyzing feasibility of node size reduction..."
    
    echo ""
    info "Current Cluster State:"
    local node_count=$(kubectl get nodes --no-headers | wc -l)
    echo "  Nodes: $node_count"
    
    # Get total allocatable resources
    local total_cpu=$(kubectl get nodes -o jsonpath='{.items[*].status.allocatable.cpu}' | tr -s ' ' '\n' | sed 's/m$//' | awk '{sum+=$1} END {print sum "m (" sum/1000 " cores)"}')
    local total_mem=$(kubectl get nodes -o jsonpath='{.items[*].status.allocatable.memory}' | tr -s ' ' '\n' | sed 's/Ki$//' | awk '{sum+=$1} END {print sum/1024/1024 " GB"}' || echo "N/A")
    
    echo "  Total Allocatable CPU: $total_cpu"
    echo "  Total Allocatable Memory: $total_mem"
    
    echo ""
    info "Recommendations:"
    echo "  1. Check if g4s.kube.small instance type is available in Civo"
    echo "  2. Verify workload fits on smaller nodes (considering DaemonSets)"
    echo "  3. Ensure sufficient headroom for traffic spikes"
    echo "  4. Test node size reduction in staging first"
    
    echo ""
    warning "Note: Node size reduction requires:"
    echo "  - Cluster downtime or node replacement"
    echo "  - Careful planning to avoid pod eviction issues"
    echo "  - Verification that workloads fit on smaller nodes"
}

# Main function
main() {
    log "🔍 Evaluating Node Size Reduction Options"
    echo ""
    
    check_kubectl
    get_node_info
    calculate_requirements
    check_civo_instance_types
    analyze_feasibility
    
    echo ""
    success "Evaluation completed!"
    log "Review the output above to determine if node size reduction is feasible"
    log "Next steps:"
    echo "  1. Verify g4s.kube.small is available in your Civo region"
    echo "  2. Calculate if workload fits on smaller nodes"
    echo "  3. Plan node replacement strategy"
    echo "  4. Test in staging environment first"
}

# Run main
main "$@"


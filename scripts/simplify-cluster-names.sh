#!/bin/bash
set -euo pipefail

# Script to simplify cluster naming and add friendly labels
# This makes nodes and resources easier to identify

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*"
}

success() {
    echo -e "${GREEN}✅ $*${NC}"
}

error() {
    echo -e "${RED}❌ $*${NC}" >&2
    exit 1
}

warning() {
    echo -e "${YELLOW}⚠️  $*${NC}"
}

# Check dependencies
check_dependencies() {
    log "Checking dependencies..."
    
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed"
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
    fi
    
    success "All dependencies found"
}

# Add friendly labels to nodes
label_nodes() {
    log "Adding friendly labels to nodes..."
    
    local nodes=($(kubectl get nodes -o jsonpath='{.items[*].metadata.name}'))
    local node_names=("node-1" "node-2" "node-3")
    
    for i in "${!nodes[@]}"; do
        local node="${nodes[$i]}"
        local friendly_name="${node_names[$i]}"
        
        # Extract last 5 characters as short ID
        local short_id="${node: -5}"
        
        log "Labeling node: ${node} → ${friendly_name} (${short_id})"
        
        # Add friendly labels
        kubectl label node "${node}" \
            "cluster.pixelated.io/friendly-name=${friendly_name}" \
            "cluster.pixelated.io/short-id=${short_id}" \
            --overwrite &> /dev/null || warning "Failed to label ${node}"
    done
    
    success "Nodes labeled with friendly names"
}

# Create kubectl aliases for prettier names
create_kubectl_aliases() {
    log "Creating kubectl helper functions..."
    
    local alias_file="${PROJECT_ROOT}/.kubectl-aliases.sh"
    
    cat > "${alias_file}" << 'EOF'
#!/bin/bash
# kubectl aliases for prettier cluster names

# Get nodes with friendly names
kubectl-get-nodes() {
    kubectl get nodes -o custom-columns=NAME:.metadata.name,FRIENDLY:.metadata.labels.cluster\.pixelated\.io/friendly-name,SHORT-ID:.metadata.labels.cluster\.pixelated\.io/short-id,STATUS:.status.conditions[-1].type,CPU:.status.allocatable.cpu,MEMORY:.status.allocatable.memory
}

# Get pods with shorter names
kubectl-get-pods() {
    local namespace="${1:-}"
    if [ -z "${namespace}" ]; then
        kubectl get pods --all-namespaces -o custom-columns=NAMESPACE:.metadata.namespace,NAME:.metadata.name,STATUS:.status.phase,NODE:.spec.nodeName | sed 's/k3s-pixelated-empathy-civo-cefd-5cd7ce-node-pool-5582-//g'
    else
        kubectl get pods -n "${namespace}" -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,NODE:.spec.nodeName | sed 's/k3s-pixelated-empathy-civo-cefd-5cd7ce-node-pool-5582-//g'
    fi
}

# Get services with friendly names
kubectl-get-services() {
    local namespace="${1:-}"
    if [ -z "${namespace}" ]; then
        kubectl get services --all-namespaces -o custom-columns=NAMESPACE:.metadata.namespace,NAME:.metadata.name,TYPE:.spec.type,CLUSTER-IP:.spec.clusterIP
    else
        kubectl get services -n "${namespace}" -o custom-columns=NAME:.metadata.name,TYPE:.spec.type,CLUSTER-IP:.spec.clusterIP
    fi
}

# Alias for common commands
alias kgn='kubectl-get-nodes'
alias kgp='kubectl-get-pods'
alias kgs='kubectl-get-services'
EOF
    
    chmod +x "${alias_file}"
    success "kubectl aliases created: ${alias_file}"
    warning "Add to your shell: source ${alias_file}"
}

# Display current node labels
show_node_labels() {
    log "Current node labels:"
    echo ""
    kubectl get nodes -o custom-columns=NAME:.metadata.name,FRIENDLY:.metadata.labels.cluster\.pixelated\.io/friendly-name,SHORT-ID:.metadata.labels.cluster\.pixelated\.io/short-id,STATUS:.status.conditions[-1].type
}

# Main function
main() {
    log "🚀 Starting cluster name simplification"
    
    check_dependencies
    label_nodes
    create_kubectl_aliases
    show_node_labels
    
    echo ""
    success "Cluster naming simplified!"
    echo ""
    log "Next steps:"
    echo "  1. Source the aliases: source .kubectl-aliases.sh"
    echo "  2. Use: kgn (get nodes), kgp (get pods), kgs (get services)"
    echo "  3. Nodes now have friendly labels for easier identification"
}

main "$@"


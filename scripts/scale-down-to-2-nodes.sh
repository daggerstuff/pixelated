#!/bin/bash
set -euo pipefail

# Script to scale down cluster from 3 nodes to 2 nodes
# This will drain one node and remove it from the cluster

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*" >&2
}

success() {
    echo -e "${GREEN}✅ $*${NC}" >&2
}

error() {
    echo -e "${RED}❌ $*${NC}" >&2
    exit 1
}

warning() {
    echo -e "${YELLOW}⚠️  $*${NC}" >&2
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

# Analyze current cluster state
analyze_cluster() {
    log "Analyzing current cluster state..."
    
    local node_count=$(kubectl get nodes --no-headers | wc -l)
    log "Current node count: ${node_count}"
    
    if [ "${node_count}" -ne 3 ]; then
        error "Expected 3 nodes, found ${node_count}. This script is designed for 3-node clusters."
    fi
    
    # Get node resource usage
    log "Current resource usage:"
    kubectl top nodes --no-headers 2>/dev/null || warning "metrics-server not available, skipping resource usage"
    
    # Check pod distribution
    log "Pod distribution across nodes:"
    kubectl get pods --all-namespaces -o wide | grep -v "Terminating" | awk '{print $8}' | sort | uniq -c | sort -rn
    
    success "Cluster analysis complete"
}

# Select node to remove (least utilized or user-specified)
select_node_to_remove() {
    local target_node="${1:-}"
    
    if [ -n "${target_node}" ]; then
        # Verify node exists
        if ! kubectl get node "${target_node}" &> /dev/null; then
            error "Node ${target_node} not found"
        fi
        echo "${target_node}"
        return
    fi
    
    # Select node with least pods (excluding DaemonSets)
    # Redirect log output to stderr so it doesn't interfere with the return value
    log "Selecting node with least workload to remove..." >&2
    
    local nodes=($(kubectl get nodes -o jsonpath='{.items[*].metadata.name}'))
    local min_pods=999
    local selected_node=""
    
    for node in "${nodes[@]}"; do
        # Count non-DaemonSet pods on this node
        local pod_count=$(kubectl get pods --all-namespaces -o json | \
            jq -r ".items[] | select(.spec.nodeName == \"${node}\" and .metadata.ownerReferences[0].kind != \"DaemonSet\") | .metadata.name" | wc -l)
        
        log "  ${node}: ${pod_count} workload pods" >&2
        
        if [ "${pod_count}" -lt "${min_pods}" ]; then
            min_pods="${pod_count}"
            selected_node="${node}"
        fi
    done
    
    if [ -z "${selected_node}" ]; then
        error "Failed to select a node to remove"
    fi
    
    log "Selected node: ${selected_node} (${min_pods} workload pods)" >&2
    # Only output the node name to stdout (for capture)
    echo "${selected_node}"
}

# Drain node (move pods to other nodes)
drain_node() {
    local node="$1"
    
    log "Draining node: ${node}"
    warning "This will cordon the node and evict all pods"
    
    # Cordon the node (prevent new pods from scheduling)
    log "Cordoning node..."
    kubectl cordon "${node}" || error "Failed to cordon node"
    
    # Drain the node (evict pods gracefully)
    log "Draining node (this may take a few minutes)..."
    kubectl drain "${node}" \
        --ignore-daemonsets \
        --delete-emptydir-data \
        --force \
        --timeout=300s \
        --grace-period=60 || error "Failed to drain node"
    
    success "Node drained successfully"
}

# Verify pods rescheduled
verify_pods_rescheduled() {
    log "Verifying pods rescheduled on remaining nodes..."
    
    local max_attempts=30
    local attempt=0
    
    while [ "${attempt}" -lt "${max_attempts}" ]; do
        local pending_pods=$(kubectl get pods --all-namespaces --field-selector=status.phase!=Running,status.phase!=Succeeded --no-headers 2>/dev/null | grep -v "Completed" | wc -l)
        
        if [ "${pending_pods}" -eq 0 ]; then
            success "All pods rescheduled successfully"
            return 0
        fi
        
        log "Waiting for pods to reschedule... (${pending_pods} pending, attempt ${attempt}/${max_attempts})"
        sleep 10
        attempt=$((attempt + 1))
    done
    
    warning "Some pods may still be pending. Check with: kubectl get pods --all-namespaces"
}

# Delete node from cluster
delete_node() {
    local node="$1"
    
    log "Deleting node from cluster: ${node}"
    warning "This will remove the node from Kubernetes (but not from Civo)"
    
    kubectl delete node "${node}" || error "Failed to delete node"
    
    success "Node removed from cluster"
}

# Verify cluster health
verify_cluster_health() {
    log "Verifying cluster health..."
    
    local node_count=$(kubectl get nodes --no-headers | wc -l)
    log "Remaining nodes: ${node_count}"
    
    if [ "${node_count}" -ne 2 ]; then
        warning "Expected 2 nodes, found ${node_count}"
    fi
    
    # Check all nodes are ready
    local ready_nodes=$(kubectl get nodes --no-headers | grep -c " Ready " || true)
    if [ "${ready_nodes}" -ne 2 ]; then
        error "Not all nodes are ready (${ready_nodes}/2)"
    fi
    
    # Check critical pods
    log "Checking critical pods..."
    local critical_pods=(
        "kube-system:coredns"
        "kube-system:traefik"
        "metoro:metoro-exporter"
        "pixelated:pixelated"
    )
    
    for pod_info in "${critical_pods[@]}"; do
        IFS=':' read -r namespace name_prefix <<< "${pod_info}"
        local pod_count=$(kubectl get pods -n "${namespace}" --no-headers 2>/dev/null | grep -c "${name_prefix}" || true)
        
        if [ "${pod_count}" -eq 0 ]; then
            warning "No pods found for ${namespace}/${name_prefix}"
        else
            log "  ${namespace}/${name_prefix}: ${pod_count} pod(s)"
        fi
    done
    
    success "Cluster health verified"
}

# Display final summary
display_summary() {
    log "=== Scale-Down Summary ==="
    echo ""
    echo "Cluster scaled from 3 nodes to 2 nodes"
    echo ""
    echo "Remaining nodes:"
    kubectl get nodes -o custom-columns=NAME:.metadata.name,STATUS:.status.conditions[-1].type,CPU:.status.allocatable.cpu,MEMORY:.status.allocatable.memory
    echo ""
    echo "Pod distribution:"
    kubectl get pods --all-namespaces -o wide | awk '{print $8}' | sort | uniq -c | sort -rn
    echo ""
    success "Scale-down complete!"
    warning "Note: The node is still running in Civo. You may want to delete it from Civo to save costs."
}

# Show usage
show_usage() {
    echo "Usage: $0 [NODE_NAME]"
    echo ""
    echo "Scale down cluster from 3 nodes to 2 nodes."
    echo ""
    echo "Arguments:"
    echo "  NODE_NAME    Optional. Specific node to remove. If not provided,"
    echo "               the script will select the node with least workload."
    echo ""
    echo "Examples:"
    echo "  $0                                    # Auto-select node to remove"
    echo "  $0 node-1                             # Remove node-1"
    echo "  $0 k3s-pixelated-empathy-civo-...     # Remove specific node by full name"
}

# Main function
main() {
    # Check for help flag
    if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
        show_usage
        exit 0
    fi
    
    local target_node="${1:-}"
    
    log "🚀 Starting cluster scale-down (3 nodes → 2 nodes)"
    echo ""
    warning "This will:"
    echo "  1. Select a node to remove (or use specified node)"
    echo "  2. Drain the node (move pods to other nodes)"
    echo "  3. Remove the node from the cluster"
    echo ""
    
    if [ -z "${target_node}" ]; then
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "Aborted by user"
        fi
    fi
    
    check_dependencies
    analyze_cluster
    
    # Capture node name - log functions output to stderr, so we only capture stdout
    local node_to_remove
    node_to_remove=$(select_node_to_remove "${target_node}" 2>/dev/null)
    
    # Clean up node name (remove any whitespace/newlines)
    node_to_remove=$(echo "${node_to_remove}" | tr -d '\n\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    # Verify we got a valid node name
    if [ -z "${node_to_remove}" ] || ! kubectl get node "${node_to_remove}" &> /dev/null; then
        error "Failed to select a valid node to remove. Got: '${node_to_remove}'"
    fi
    
    echo ""
    warning "Node to remove: ${node_to_remove}"
    read -p "Confirm removal of this node? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error "Aborted by user"
    fi
    
    drain_node "${node_to_remove}"
    verify_pods_rescheduled
    delete_node "${node_to_remove}"
    verify_cluster_health
    display_summary
}

main "$@"


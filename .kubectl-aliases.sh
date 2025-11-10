#!/bin/sh
# kubectl aliases for prettier cluster names
# Compatible with bash, zsh, and sh
# This script safely overrides any existing kubectl aliases

# Remove any existing aliases/functions
# In zsh, we need to handle this carefully to avoid conflicts
if [ -n "${ZSH_VERSION:-}" ]; then
    # zsh: use 'disable -a' to disable aliases, or 'unalias' if available
    # Try unalias first (works if alias exists), then disable
    (unalias kgn 2>/dev/null || true)
    (unalias kgp 2>/dev/null || true)
    (unalias kgs 2>/dev/null || true)
    unset -f kgn kgp kgs 2>/dev/null || true
else
    # bash/sh: standard unalias
    unalias kgn kgp kgs 2>/dev/null || true
    unset -f kgn kgp kgs 2>/dev/null || true
fi

# Define functions - using 'function' keyword works in both bash and zsh
function kgn() {
    echo "FRIENDLY   SHORT-ID  STATUS    CPU       MEMORY"
    echo "------------------------------------------------------------"
    kubectl get nodes -o json 2>/dev/null | jq -r '.items[] | 
        "\(.metadata.labels."cluster.pixelated.io/friendly-name" // "unknown")|\(.metadata.labels."cluster.pixelated.io/short-id" // "unknown")|\(.status.conditions[] | select(.type=="Ready") | .status)|\(.status.allocatable.cpu)|\(.status.allocatable.memory)"' 2>/dev/null | \
    while IFS='|' read -r friendly short node_status cpu mem; do
        printf "%-10s %-8s %-8s %-9s %s\n" "${friendly}" "${short}" "${node_status}" "${cpu}" "${mem}"
    done
}

function kgp() {
    local namespace="${1:-}"
    if [ -z "${namespace}" ]; then
        echo "NAMESPACE       NAME                                     STATUS     NODE"
        echo "--------------------------------------------------------------------------------"
        kubectl get pods --all-namespaces -o json 2>/dev/null | jq -r '.items[] | 
            "\(.metadata.namespace)|\(.metadata.name)|\(.status.phase)|\(.spec.nodeName)"' 2>/dev/null | \
        while IFS='|' read -r ns name pod_status node; do
            local friendly
            friendly=$(kubectl get node "${node}" -o jsonpath='{.metadata.labels.cluster\.pixelated\.io/friendly-name}' 2>/dev/null)
            if [ -z "${friendly}" ]; then
                friendly="${node: -5}"
            fi
            printf "%-15s %-40s %-10s %s\n" "${ns}" "${name}" "${pod_status}" "${friendly}"
        done
    else
        echo "NAME                                     STATUS     NODE"
        echo "------------------------------------------------------------"
        kubectl get pods -n "${namespace}" -o json 2>/dev/null | jq -r '.items[] | 
            "\(.metadata.name)|\(.status.phase)|\(.spec.nodeName)"' 2>/dev/null | \
        while IFS='|' read -r name pod_status node; do
            local friendly
            friendly=$(kubectl get node "${node}" -o jsonpath='{.metadata.labels.cluster\.pixelated\.io/friendly-name}' 2>/dev/null)
            if [ -z "${friendly}" ]; then
                friendly="${node: -5}"
            fi
            printf "%-40s %-10s %s\n" "${name}" "${pod_status}" "${friendly}"
        done
    fi
}

function kgs() {
    local namespace="${1:-}"
    if [ -z "${namespace}" ]; then
        kubectl get services --all-namespaces -o custom-columns=NAMESPACE:.metadata.namespace,NAME:.metadata.name,TYPE:.spec.type,CLUSTER-IP:.spec.clusterIP 2>/dev/null
    else
        kubectl get services -n "${namespace}" -o custom-columns=NAME:.metadata.name,TYPE:.spec.type,CLUSTER-IP:.spec.clusterIP 2>/dev/null
    fi
}

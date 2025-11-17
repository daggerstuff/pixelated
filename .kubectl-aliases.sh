#!/bin/bash
# kubectl aliases for prettier cluster names
# Compatible with bash and zsh (uses bash-specific features like 'local')
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

# Function definitions rely on bash/zsh features (e.g., local, here-strings)
kgn() {
  echo "FRIENDLY   SHORT-ID  STATUS    CPU       MEMORY"
  echo "------------------------------------------------------------"
  kubectl get nodes -o json 2>/dev/null | jq -r '.items[] |
      "\(.metadata.labels."cluster.pixelated.io/friendly-name" // "unknown")|\(.metadata.labels."cluster.pixelated.io/short-id" // "unknown")|\(([.status.conditions[] | select(.type=="Ready")] | first | .status) // "Unknown")|\(.status.allocatable.cpu // "unknown")|\(.status.allocatable.memory // "unknown")"' 2>/dev/null | \
  while IFS='|' read -r friendly short node_status cpu mem; do
    printf "%-10s %-8s %-8s %-9s %s\n" "${friendly}" "${short}" "${node_status}" "${cpu}" "${mem}"
  done
}

kgp() {
  local namespace="${1:-}"
  local nodes_json
  nodes_json=$(kubectl get nodes -o json 2>/dev/null) || {
    echo "Unable to fetch node metadata" >&2
    return 1
  }

  local jq_filter
  jq_filter='
($nodes.items // [] | map({
    key: .metadata.name,
    value: (.metadata.labels."cluster.pixelated.io/friendly-name"
            // (if (.metadata.name // "" | length) > 5 then .metadata.name[-5:] else .metadata.name end)
            // "unknown")
  }) | from_entries) as $node_map
| (.items // [])
| map(select(if $ns == "" then true else (.metadata.namespace // "") == $ns end))
| .[]
| (.spec.nodeName // "pending") as $node_name
| [
    .metadata.namespace // "",
    .metadata.name // "",
    .status.phase // "Unknown",
    ($node_map[$node_name]
      // (if $node_name == "pending" then "pending"
          elif ($node_name | length) > 5 then $node_name[-5:]
          else $node_name end))
  ]
| @tsv
'

  if [ -z "${namespace}" ]; then
    echo "NAMESPACE       NAME                                     STATUS     NODE"
    echo "--------------------------------------------------------------------------------"
    kubectl get pods --all-namespaces -o json 2>/dev/null | \
      jq --argjson nodes "${nodes_json}" --arg ns "${namespace}" -r "${jq_filter}" 2>/dev/null | \
      while IFS=$'\t' read -r ns name pod_status friendly; do
        printf "%-15s %-40s %-10s %s\n" "${ns}" "${name}" "${pod_status}" "${friendly}"
      done
  else
    echo "NAME                                     STATUS     NODE"
    echo "------------------------------------------------------------"
    kubectl get pods -n "${namespace}" -o json 2>/dev/null | \
      jq --argjson nodes "${nodes_json}" --arg ns "${namespace}" -r "${jq_filter}" 2>/dev/null | \
      while IFS=$'\t' read -r _ name pod_status friendly; do
        printf "%-40s %-10s %s\n" "${name}" "${pod_status}" "${friendly}"
      done
  fi
}

kgs() {
  local namespace="${1:-}"
  if [ -z "${namespace}" ]; then
    kubectl get services --all-namespaces -o custom-columns=NAMESPACE:.metadata.namespace,NAME:.metadata.name,TYPE:.spec.type,CLUSTER-IP:.spec.clusterIP 2>/dev/null
  else
    kubectl get services -n "${namespace}" -o custom-columns=NAME:.metadata.name,TYPE:.spec.type,CLUSTER-IP:.spec.clusterIP 2>/dev/null
  fi
}

#!/bin/bash
# Fix containerd walinuxagent warnings in AKS
# This script provides multiple methods to suppress the warnings

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🔧 Fixing containerd walinuxagent warnings in AKS"
echo "=================================================="

# Method 1: Apply DaemonSet (requires cluster admin)
echo ""
echo "Method 1: Applying DaemonSet to configure containerd on nodes..."
kubectl apply -f "$PROJECT_ROOT/k8s/azure/containerd-config-fix.yaml" && {
  echo "✅ DaemonSet applied successfully"
  echo "   Waiting for pods to be ready..."
  kubectl wait --for=condition=ready pod -l app=containerd-config-fix -n kube-system --timeout=300s || true
} || {
  echo "⚠️ Failed to apply DaemonSet (may require cluster admin permissions)"
  echo "   Trying alternative methods..."
}

# Method 2: Instructions for AKS-level fix
echo ""
echo "Method 2: AKS Cluster-Level Configuration (Recommended for permanent fix)"
echo "---------------------------------------------------------------------------"
echo "For a permanent fix that survives node replacements, configure at AKS level:"
echo ""
echo "Option A: Use Azure CLI to update node configuration:"
echo "  az aks update \\"
echo "    --resource-group <RESOURCE_GROUP> \\"
echo "    --name <AKS_CLUSTER_NAME> \\"
echo "    --node-image-only"
echo ""
echo "Option B: Contact Azure Support to configure containerd log level"
echo "  This requires modifying containerd config on all nodes"
echo ""
echo "Option C: Use AKS node configuration via ARM/Bicep template"
echo "  Add containerd configuration to node pool definition"
echo ""

# Method 3: Check current status
echo ""
echo "Method 3: Checking current containerd configuration..."
if kubectl get daemonset containerd-config-fix -n kube-system >/dev/null 2>&1; then
  echo "✅ Containerd fix DaemonSet is deployed"
  kubectl get pods -l app=containerd-config-fix -n kube-system
else
  echo "⚠️ Containerd fix DaemonSet is not deployed"
fi

echo ""
echo "=================================================="
echo "✅ Fix script completed"
echo ""
echo "Note: The walinuxagent warning is benign and does not affect deployments."
echo "      However, if you want to suppress it completely, use Method 2 (AKS-level)."


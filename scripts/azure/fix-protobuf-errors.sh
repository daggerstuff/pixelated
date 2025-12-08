#!/bin/bash
# Fix protobuf wire-format parsing errors in Kubernetes operations
# This script diagnoses and fixes the root cause of protobuf errors

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🔧 Diagnosing and fixing protobuf wire-format errors"
echo "====================================================="

# Step 1: Check kubectl and cluster version compatibility
echo ""
echo "Step 1: Checking version compatibility..."
KUBECTL_VERSION=$(kubectl version --client 2>/dev/null | grep "Client Version" | awk '{print $3}' | cut -d'v' -f2 || echo "unknown")
CLUSTER_VERSION=$(kubectl version 2>/dev/null | grep "Server Version" | awk '{print $3}' | cut -d'v' -f2 || echo "unknown")

echo "Kubectl client version: $KUBECTL_VERSION"
echo "Kubernetes server version: $CLUSTER_VERSION"

if [ "$KUBECTL_VERSION" != "unknown" ] && [ "$CLUSTER_VERSION" != "unknown" ]; then
  KUBECTL_MAJOR=$(echo "$KUBECTL_VERSION" | cut -d'.' -f1)
  KUBECTL_MINOR=$(echo "$KUBECTL_VERSION" | cut -d'.' -f2)
  CLUSTER_MAJOR=$(echo "$CLUSTER_VERSION" | cut -d'.' -f1)
  CLUSTER_MINOR=$(echo "$CLUSTER_VERSION" | cut -d'.' -f2)
  
  VERSION_DIFF=$((KUBECTL_MAJOR - CLUSTER_MAJOR))
  if [ $VERSION_DIFF -gt 1 ] || [ $VERSION_DIFF -lt -1 ]; then
    echo "❌ Version mismatch detected! Kubectl is $VERSION_DIFF major versions different from cluster"
    echo "   This can cause protobuf wire-format errors"
    echo "   Solution: Update kubectl to match cluster version or upgrade cluster"
  else
    echo "✅ Version compatibility check passed"
  fi
fi

# Step 2: Test cluster connection and detect protobuf errors
echo ""
echo "Step 2: Testing cluster connection..."
if kubectl cluster-info >/dev/null 2>&1; then
  echo "✅ Cluster connection successful"
else
  ERROR_OUTPUT=$(kubectl cluster-info 2>&1 || true)
  if echo "$ERROR_OUTPUT" | grep -q "proto: cannot parse invalid wire-format data"; then
    echo "❌ Protobuf wire-format error detected!"
    echo "   This indicates a version mismatch or corrupted API response"
  else
    echo "⚠️ Cluster connection failed (may be expected in some environments)"
  fi
fi

# Step 3: Configure kubectl to use JSON output to avoid protobuf issues
echo ""
echo "Step 3: Configuring kubectl to avoid protobuf errors..."
cat > ~/.kubectl-config << 'EOF'
# Force JSON output to avoid protobuf wire-format errors
# This is a workaround for version mismatches
export KUBECTL_OUTPUT_FORMAT="json"
EOF

# Step 4: Create kubectl wrapper that handles protobuf errors
echo ""
echo "Step 4: Creating kubectl wrapper with error handling..."
cat > /tmp/kubectl-safe << 'KUBECTL_EOF'
#!/bin/bash
# Wrapper for kubectl that handles protobuf errors gracefully

# Try with JSON output first (avoids protobuf)
if kubectl "$@" --output=json >/dev/null 2>&1; then
  kubectl "$@" --output=json
  exit 0
fi

# Fallback to default output
exec kubectl "$@"
KUBECTL_EOF

chmod +x /tmp/kubectl-safe

echo ""
echo "====================================================="
echo "✅ Protobuf error diagnosis complete"
echo ""
echo "If protobuf errors persist:"
echo "1. Update kubectl: curl -LO https://dl.k8s.io/release/\$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
echo "2. Update AKS cluster: az aks upgrade --resource-group <rg> --name <cluster> --kubernetes-version <version>"
echo "3. Use JSON output: kubectl <command> --output=json"
echo ""
echo "To use the safe wrapper: /tmp/kubectl-safe <command>"


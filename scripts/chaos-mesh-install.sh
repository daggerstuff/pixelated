#!/usr/bin/env bash
# Chaos Mesh Installation Script for Staging Environment
# This script installs Chaos Mesh on the staging Kubernetes cluster
# for chaos engineering experiments (PIX-4148 CE-2.1)
#
# Prerequisites:
#   - kubectl configured with staging cluster context
#   - Helm 3.x installed
#   - Cluster-admin privileges
#
# Usage:
#   ./scripts/chaos-mesh-install.sh

set -euo pipefail

readonly CHAOS_MESH_VERSION="2.6.2"
readonly CHAOS_MESH_NAMESPACE="chaos-mesh"
readonly TARGET_NAMESPACE="pixelated-empathy"

echo "=== Chaos Mesh Installation Script ==="
echo "Version: ${CHAOS_MESH_VERSION}"
echo "Namespace: ${CHAOS_MESH_NAMESPACE}"
echo "Target: ${TARGET_NAMESPACE}"
echo ""

# Verify kubectl is configured
if ! kubectl cluster-info &>/dev/null; then
    echo "ERROR: kubectl not configured or cluster not reachable"
    exit 1
fi

# Verify helm is installed
if ! command -v helm &>/dev/null; then
    echo "ERROR: helm not found in PATH"
    exit 1
fi

# Add Chaos Mesh Helm repository
echo "Adding Chaos Mesh Helm repository..."
helm repo add chaos-mesh https://charts.chaos-mesh.org
helm repo update

# Create namespace if it doesn't exist
echo "Creating namespace ${CHAOS_MESH_NAMESPACE}..."
kubectl create namespace "${CHAOS_MESH_NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

# Install Chaos Mesh
echo "Installing Chaos Mesh ${CHAOS_MESH_VERSION}..."
helm upgrade --install chaos-mesh chaos-mesh/chaos-mesh \
    --namespace "${CHAOS_MESH_NAMESPACE}" \
    --version "${CHAOS_MESH_VERSION}" \
    --set dashboard.create=true \
    --set dashboard.securityMode=false \
    --set controllerManager.replicas=2 \
    --set chaosDaemon.runtime=containerd \
    --set chaosDaemon.privileged=true \
    --wait

# Verify installation
echo ""
echo "Verifying installation..."
kubectl get pods -n "${CHAOS_MESH_NAMESPACE}"

# Label target namespace for chaos injection
echo ""
echo "Labeling namespace ${TARGET_NAMESPACE} for chaos injection..."
kubectl label namespace "${TARGET_NAMESPACE}" chaos-mesh.org/inject=enabled --overwrite

# Verify CRDs
echo ""
echo "Verifying Chaos Mesh CRDs..."
kubectl get crd | grep chaos-mesh.org || echo "WARNING: CRDs not found"

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Next steps:"
echo "  1. Access dashboard: kubectl port-forward -n ${CHAOS_MESH_NAMESPACE} svc/chaos-dashboard 2333:2333"
echo "  2. Open browser: http://localhost:2333"
echo "  3. Run experiments: kubectl apply -f infra/k8s/chaos/<experiment>.yaml"
echo "  4. Monitor results in .agent/internal/chaos-results/"
echo ""
#!/bin/bash

# Script to fix Kubernetes readiness probe issues
# Applies updated deployment configuration with improved health checks

set -e

NAMESPACE="pixelated-prod"
DEPLOYMENT_NAME="pixelated-app"

echo "🔧 Fixing Kubernetes readiness probe configuration..."

# Check if kubectl is available and configured
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed or not in PATH"
    exit 1
fi

# Check if we can connect to the cluster
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster"
    echo "Please ensure your kubeconfig is properly configured"
    exit 1
fi

# Check if namespace exists
if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
    echo "❌ Namespace $NAMESPACE does not exist"
    exit 1
fi

echo "✅ Kubernetes cluster accessible"

# Apply the updated deployment
echo "📦 Applying updated deployment configuration..."

# If CONTAINER_IMAGE or CI_COMMIT_SHA are set, substitute them into the manifest before applying.
if command -v envsubst >/dev/null 2>&1; then
    echo "🔁 Substituting environment variables into k8s/production/deployment.yaml"
    envsubst < k8s/production/deployment.yaml > /tmp/deployment.yaml
    APPLY_FILE=/tmp/deployment.yaml
else
    APPLY_FILE=k8s/production/deployment.yaml
fi

if kubectl apply -f "$APPLY_FILE" -n "$NAMESPACE"; then
    echo "✅ Deployment configuration applied successfully"
else
    echo "❌ Failed to apply deployment configuration"
    exit 1
fi

# Wait for rollout to complete
echo "⏳ Waiting for deployment rollout to complete..."
if kubectl rollout status deployment/"$DEPLOYMENT_NAME" -n "$NAMESPACE" --timeout=300s; then
    echo "✅ Deployment rollout completed successfully"
else
    echo "❌ Deployment rollout failed or timed out"
    echo "Check the deployment status with: kubectl describe deployment $DEPLOYMENT_NAME -n $NAMESPACE"
    exit 1
fi

# Check pod health
echo "🏥 Checking pod health..."
kubectl get pods -n "$NAMESPACE" -l app=pixelated

echo "🎉 Readiness probe fix applied successfully!"
echo ""
echo "Changes made:"
echo "- Increased readiness probe timeout from 3s to 8s"
echo "- Added startup probe with 10s timeout"
echo "- Increased failure threshold to 5 for readiness probe"
echo "- Switched readiness and startup probes to /api/health/simple for faster response"
echo "- Enhanced health endpoints with better error handling and performance"
echo ""
echo "Monitor the deployment with:"
echo "  kubectl logs -n $NAMESPACE -l app=pixelated --tail=50 -f"
echo "  kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp'"
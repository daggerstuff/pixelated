#!/bin/bash
# Rollback deployment script for GKE
set -e

echo "🔄 Starting deployment rollback..."
echo "Deployment: $GKE_DEPLOYMENT_NAME"
echo "Namespace: $GKE_NAMESPACE"

# Rollback deployment
echo "🔄 Rolling back deployment..."
kubectl rollout undo deployment/"$GKE_DEPLOYMENT_NAME" -n "$GKE_NAMESPACE"

# Wait for rollback to complete
echo "⏳ Waiting for rollback to complete..."
if ! kubectl rollout status deployment/"$GKE_DEPLOYMENT_NAME" -n "$GKE_NAMESPACE" --timeout="${HEALTH_CHECK_TIMEOUT}s"; then
  echo "Rollback rollout failed or timed out."
  kubectl describe deployment "$GKE_DEPLOYMENT_NAME" -n "$GKE_NAMESPACE" || true
  kubectl get deployment "$GKE_DEPLOYMENT_NAME" -n "$GKE_NAMESPACE" -o wide || true
  kubectl get pods -l app="${GKE_DEPLOYMENT_NAME}" -n "$GKE_NAMESPACE" -o wide || true
  for pod in $(kubectl get pods -l app="$GKE_DEPLOYMENT_NAME" -n "$GKE_NAMESPACE" --no-headers -o custom-columns=":metadata.name"); do
    echo "=== Logs for ${pod} (previous) ==="
    kubectl logs "${pod}" -n "$GKE_NAMESPACE" --previous --tail=120 || true
    echo "=== Logs for ${pod} (current) ==="
    kubectl logs "${pod}" -n "$GKE_NAMESPACE" --tail=120 || true
  done
  exit 1
fi

# Clean up canary or blue-green deployments if they exist
echo "🧹 Cleaning up variant deployments..."
kubectl delete deployment "${GKE_DEPLOYMENT_NAME}-canary" -n "$GKE_NAMESPACE" --ignore-not-found=true
kubectl delete deployment "${GKE_DEPLOYMENT_NAME}-blue" -n "$GKE_NAMESPACE" --ignore-not-found=true
kubectl delete deployment "${GKE_DEPLOYMENT_NAME}-green" -n "$GKE_NAMESPACE" --ignore-not-found=true

echo "✅ Rollback completed successfully"
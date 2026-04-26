#!/bin/bash
# Rolling deployment script for GKE
set -e

echo "🚀 Starting rolling deployment to GKE..."
echo "Image: $CONTAINER_IMAGE"
echo "Deployment: $GKE_DEPLOYMENT_NAME"
echo "Namespace: $GKE_NAMESPACE"
diagnose_rollout_failure() {
  echo "Rollout failed or timed out."
  echo "Deployment details:"
  kubectl describe deployment "${GKE_DEPLOYMENT_NAME}" -n "${GKE_NAMESPACE}" || true
  echo "Deployment status:"
  kubectl get deployment "${GKE_DEPLOYMENT_NAME}" -n "${GKE_NAMESPACE}" -o wide || true
  echo "Current pods:"
  kubectl get pods -l "app=${GKE_DEPLOYMENT_NAME}" -n "${GKE_NAMESPACE}" -o wide || true

  for pod in $(kubectl get pods -l "app=${GKE_DEPLOYMENT_NAME}" -n "${GKE_NAMESPACE}" --no-headers -o custom-columns=":metadata.name"); do
    echo "=== Logs for ${pod} (previous) ==="
    kubectl logs "${pod}" -n "${GKE_NAMESPACE}" --previous --tail=120 || true
    echo "=== Logs for ${pod} (current) ==="
    kubectl logs "${pod}" -n "${GKE_NAMESPACE}" --tail=120 || true
  done
}

# Apply Kubernetes manifests
echo "📋 Applying Kubernetes manifests..."
kubectl apply -f k8s/ -n "$GKE_NAMESPACE" || true

# Update deployment with new image
echo "🔄 Updating deployment image..."
kubectl set image deployment/"$GKE_DEPLOYMENT_NAME" app="$CONTAINER_IMAGE" -n "$GKE_NAMESPACE"

# Wait for rollout to complete
echo "⏳ Waiting for rollout to complete..."
if ! kubectl rollout status deployment/"$GKE_DEPLOYMENT_NAME" -n "$GKE_NAMESPACE" --timeout="${HEALTH_CHECK_TIMEOUT}s"; then
  diagnose_rollout_failure
  exit 1
fi

echo "✅ Rolling deployment completed successfully"
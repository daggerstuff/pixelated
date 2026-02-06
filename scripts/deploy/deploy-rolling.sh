#!/bin/bash
# Rolling deployment script for GKE
set -e

echo "🚀 Starting rolling deployment to GKE..."
echo "Image: $CONTAINER_IMAGE"
echo "Deployment: $GKE_DEPLOYMENT_NAME"
echo "Namespace: $GKE_NAMESPACE"

# Apply Kubernetes manifests
echo "📋 Applying Kubernetes manifests..."
kubectl apply -f k8s/ -n "$GKE_NAMESPACE" || true

# Update deployment with new image
echo "🔄 Updating deployment image..."
kubectl set image deployment/"$GKE_DEPLOYMENT_NAME" app="$CONTAINER_IMAGE" -n "$GKE_NAMESPACE"

# Wait for rollout to complete
echo "⏳ Waiting for rollout to complete..."
kubectl rollout status deployment/"$GKE_DEPLOYMENT_NAME" -n "$GKE_NAMESPACE" --timeout="${HEALTH_CHECK_TIMEOUT}s"

echo "✅ Rolling deployment completed successfully"
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
kubectl rollout status deployment/"$GKE_DEPLOYMENT_NAME" -n "$GKE_NAMESPACE" --timeout="${HEALTH_CHECK_TIMEOUT}s"

# Clean up canary or blue-green deployments if they exist
echo "🧹 Cleaning up variant deployments..."
kubectl delete deployment "${GKE_DEPLOYMENT_NAME}-canary" -n "$GKE_NAMESPACE" --ignore-not-found=true
kubectl delete deployment "${GKE_DEPLOYMENT_NAME}-blue" -n "$GKE_NAMESPACE" --ignore-not-found=true
kubectl delete deployment "${GKE_DEPLOYMENT_NAME}-green" -n "$GKE_NAMESPACE" --ignore-not-found=true

echo "✅ Rollback completed successfully"
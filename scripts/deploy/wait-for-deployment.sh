#!/bin/bash
# Wait for deployment to be ready and perform basic health checks
set -e

echo "⏳ Waiting for deployment to be ready..."
echo "Deployment: $GKE_DEPLOYMENT_NAME"
echo "Namespace: $GKE_NAMESPACE"
echo "Timeout: ${HEALTH_CHECK_TIMEOUT}s"

# Wait for rollout to complete
kubectl rollout status deployment/"$GKE_DEPLOYMENT_NAME" -n "$GKE_NAMESPACE" --timeout="${HEALTH_CHECK_TIMEOUT}s"

# Check pod health
echo "🔍 Checking pod health..."
READY_PODS=$(kubectl get pods -l app="$GKE_DEPLOYMENT_NAME" -n "$GKE_NAMESPACE" -o jsonpath='{.items[?(@.status.phase=="Running")].status.containerStatuses[?(@.ready==true)].name}' | wc -w)
TOTAL_PODS=$(kubectl get pods -l app="$GKE_DEPLOYMENT_NAME" -n "$GKE_NAMESPACE" --no-headers | wc -l)

echo "📊 Health summary: $READY_PODS/$TOTAL_PODS pods ready"

if [ "$READY_PODS" -eq 0 ]; then
    echo "❌ No healthy pods found"
    kubectl describe pods -l app="$GKE_DEPLOYMENT_NAME" -n "$GKE_NAMESPACE"
    exit 1
elif [ "$READY_PODS" -lt "$TOTAL_PODS" ]; then
    echo "⚠️ Some pods are not ready"
    kubectl describe pods -l app="$GKE_DEPLOYMENT_NAME" -n "$GKE_NAMESPACE" | grep -A 10 -B 5 "Warning\|Error" || true
fi

echo "✅ Deployment is healthy"
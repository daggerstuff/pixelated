#!/bin/bash
# Wait for deployment to be ready and perform basic health checks
set -e

diagnose_rollout_failure() {
  local deployment_name="$1"
  local namespace="$2"
  local label_selector="$3"

  echo "Rollout failed or timed out."
  echo "Deployment details:"
  kubectl describe deployment "${deployment_name}" -n "${namespace}" || true
  echo "Deployment status:"
  kubectl get deployment "${deployment_name}" -n "${namespace}" -o wide || true
  echo "Current pods:"
  kubectl get pods -l "app=${label_selector}" -n "${namespace}" -o wide || true

  for pod in $(kubectl get pods -l "app=${label_selector}" -n "${namespace}" --no-headers -o custom-columns=":metadata.name"); do
    echo "=== Logs for ${pod} (previous) ==="
    kubectl logs "${pod}" -n "${namespace}" --previous --tail=120 || true
    echo "=== Logs for ${pod} (current) ==="
    kubectl logs "${pod}" -n "${namespace}" --tail=120 || true
  done
}

echo "⏳ Waiting for deployment to be ready..."
echo "Deployment: $GKE_DEPLOYMENT_NAME"
echo "Namespace: $GKE_NAMESPACE"
echo "Timeout: ${HEALTH_CHECK_TIMEOUT}s"

# Wait for rollout to complete
if ! kubectl rollout status deployment/"$GKE_DEPLOYMENT_NAME" -n "$GKE_NAMESPACE" --timeout="${HEALTH_CHECK_TIMEOUT}s"; then
  diagnose_rollout_failure "$GKE_DEPLOYMENT_NAME" "$GKE_NAMESPACE" "$GKE_DEPLOYMENT_NAME"
  exit 1
fi

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
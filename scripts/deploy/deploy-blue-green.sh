#!/bin/bash
# Blue-green deployment script for GKE
set -e

echo "🔵🟢 Starting blue-green deployment to GKE..."
echo "Image: $CONTAINER_IMAGE"
echo "Deployment: $GKE_DEPLOYMENT_NAME"
echo "Namespace: $GKE_NAMESPACE"
diagnose_rollout_failure() {
  local deployment_name="$1"
  local namespace="$2"

  echo "Rollout failed or timed out for ${deployment_name}."
  echo "Deployment details:"
  kubectl describe deployment "${deployment_name}" -n "${namespace}" || true
  echo "Deployment status:"
  kubectl get deployment "${deployment_name}" -n "${namespace}" -o wide || true
  echo "Current pods:"
  kubectl get pods -l app="${GKE_DEPLOYMENT_NAME}" -n "${namespace}" -o wide || true

  for pod in $(kubectl get pods -l app="${GKE_DEPLOYMENT_NAME}" -n "${namespace}" --no-headers -o custom-columns=":metadata.name"); do
    echo "=== Logs for ${pod} (previous) ==="
    kubectl logs "${pod}" -n "${namespace}" --previous --tail=120 || true
    echo "=== Logs for ${pod} (current) ==="
    kubectl logs "${pod}" -n "${namespace}" --tail=120 || true
  done
}

# Get current deployment color
CURRENT_COLOR=$(kubectl get service "$GKE_SERVICE_NAME" -n "$GKE_NAMESPACE" -o jsonpath='{.spec.selector.color}' 2>/dev/null || echo "")
# Use bash parameter expansion to default to "blue" if empty or unset
: ${CURRENT_COLOR:=blue}
NEW_COLOR="green"
if [ "$CURRENT_COLOR" = "green" ]; then
    NEW_COLOR="blue"
fi

echo "📋 Current color: $CURRENT_COLOR"
echo "📋 New color: $NEW_COLOR"

# Apply Kubernetes manifests
echo "📋 Applying Kubernetes manifests..."
kubectl apply -f k8s/ -n "$GKE_NAMESPACE" || true

# Create new deployment with new color
echo "🔄 Creating new deployment ($NEW_COLOR)..."
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${GKE_DEPLOYMENT_NAME}-${NEW_COLOR}
  namespace: ${GKE_NAMESPACE}
  labels:
    app: ${GKE_DEPLOYMENT_NAME}
    color: ${NEW_COLOR}
spec:
  replicas: ${REPLICAS:-3}
  selector:
    matchLabels:
      app: ${GKE_DEPLOYMENT_NAME}
      color: ${NEW_COLOR}
  template:
    metadata:
      labels:
        app: ${GKE_DEPLOYMENT_NAME}
        color: ${NEW_COLOR}
    spec:
      containers:
      - name: app
        image: ${CONTAINER_IMAGE}
        ports:
        - containerPort: 3000
EOF

# Wait for new deployment to be ready
echo "⏳ Waiting for new deployment to be ready..."
if ! kubectl rollout status deployment/"${GKE_DEPLOYMENT_NAME}-${NEW_COLOR}" -n "$GKE_NAMESPACE" --timeout="${HEALTH_CHECK_TIMEOUT}s"; then
  diagnose_rollout_failure "${GKE_DEPLOYMENT_NAME}-${NEW_COLOR}" "$GKE_NAMESPACE"
  exit 1
fi

# Switch traffic to new deployment
echo "🔄 Switching traffic to new deployment..."
kubectl patch service "$GKE_SERVICE_NAME" -n "$GKE_NAMESPACE" -p '{"spec":{"selector":{"color":"'"$NEW_COLOR"'"}}}'

echo "✅ Blue-green deployment completed successfully"
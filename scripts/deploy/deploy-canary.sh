#!/bin/bash
# Canary deployment script for GKE
set -e

echo "🐤 Starting canary deployment to GKE..."
echo "Image: $CONTAINER_IMAGE"
echo "Deployment: $GKE_DEPLOYMENT_NAME"
echo "Namespace: $GKE_NAMESPACE"
echo "Canary percentage: $CANARY_PERCENTAGE%"
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

# Apply Kubernetes manifests
echo "📋 Applying Kubernetes manifests..."
kubectl apply -f k8s/ -n "$GKE_NAMESPACE" || true

# Calculate canary replicas
TOTAL_REPLICAS=${REPLICAS:-3}
CANARY_REPLICAS=$((TOTAL_REPLICAS * CANARY_PERCENTAGE / 100))
if [ "$CANARY_REPLICAS" -lt 1 ]; then
    CANARY_REPLICAS=1
fi

echo "📊 Deploying $CANARY_REPLICAS canary replicas..."

# Create canary deployment
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${GKE_DEPLOYMENT_NAME}-canary
  namespace: ${GKE_NAMESPACE}
  labels:
    app: ${GKE_DEPLOYMENT_NAME}
    variant: canary
spec:
  replicas: ${CANARY_REPLICAS}
  selector:
    matchLabels:
      app: ${GKE_DEPLOYMENT_NAME}
      variant: canary
  template:
    metadata:
      labels:
        app: ${GKE_DEPLOYMENT_NAME}
        variant: canary
    spec:
      containers:
      - name: app
        image: ${CONTAINER_IMAGE}
        ports:
        - containerPort: 3000
EOF

# Wait for canary to be ready
echo "⏳ Waiting for canary deployment to be ready..."
if ! kubectl rollout status deployment/"${GKE_DEPLOYMENT_NAME}-canary" -n "$GKE_NAMESPACE" --timeout="${HEALTH_CHECK_TIMEOUT}s"; then
  diagnose_rollout_failure "${GKE_DEPLOYMENT_NAME}-canary" "$GKE_NAMESPACE"
  exit 1
fi

echo "✅ Canary deployment completed successfully"
echo "📋 Monitor canary performance before full rollout"
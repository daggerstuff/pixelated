#!/bin/bash
# Canary deployment script for GKE
set -e

echo "🐤 Starting canary deployment to GKE..."
echo "Image: $CONTAINER_IMAGE"
echo "Deployment: $GKE_DEPLOYMENT_NAME"
echo "Namespace: $GKE_NAMESPACE"
echo "Canary percentage: $CANARY_PERCENTAGE%"

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
kubectl rollout status deployment/"${GKE_DEPLOYMENT_NAME}-canary" -n "$GKE_NAMESPACE" --timeout="${HEALTH_CHECK_TIMEOUT}s"

echo "✅ Canary deployment completed successfully"
echo "📋 Monitor canary performance before full rollout"
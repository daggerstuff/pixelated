#!/bin/bash
# Deploy NeMo Data Designer to Kubernetes cluster

set -e

NAMESPACE="${NAMESPACE:-nemo}"
RELEASE_NAME="${RELEASE_NAME:-nemo-data-designer}"
CHART_REPO="${CHART_REPO:-https://nvidia.github.io/nemo-microservices-helm-charts}"
CHART_NAME="${CHART_NAME:-nemo-data-designer}"
CHART_VERSION="${CHART_VERSION:-latest}"

echo "=========================================="
echo "NeMo Data Designer Kubernetes Deployment"
echo "=========================================="
echo ""
echo "Namespace: ${NAMESPACE}"
echo "Release: ${RELEASE_NAME}"
echo ""

# Check if kubectl is installed
echo "Checking kubectl installation..."
if ! command -v kubectl &> /dev/null; then
    echo "❌ Error: kubectl is not installed"
    echo "Please install kubectl first"
    exit 1
fi

echo "✅ kubectl is installed"

# Check if Helm is installed (needed for chart deployment)
echo "Checking Helm installation..."
if ! command -v helm &> /dev/null; then
    echo "❌ Error: Helm is not installed"
    echo "Please install Helm first"
    exit 1
fi

echo "✅ Helm is installed"

# Get NVIDIA API key from local .env if it exists
if [ -f .env ]; then
    NVIDIA_API_KEY=$(grep "^NVIDIA_API_KEY=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')
else
    NVIDIA_API_KEY=""
fi

if [ -z "$NVIDIA_API_KEY" ]; then
    echo "❌ Error: NVIDIA_API_KEY not found in local .env file"
    echo "Please add NVIDIA_API_KEY to your .env file"
    exit 1
fi

echo "✅ NVIDIA_API_KEY found"

# Create namespace if it doesn't exist
echo ""
echo "Creating namespace ${NAMESPACE} if it doesn't exist..."
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

# Add NVIDIA Helm repository
echo ""
echo "Adding NVIDIA Helm repository..."
helm repo add nemo-microservices "${CHART_REPO}" 2>/dev/null || echo "Repository already exists"
helm repo update

# Create secret for NVIDIA API key
echo ""
echo "Creating secret for NVIDIA API key..."
kubectl create secret generic nemo-api-key \
    --from-literal=api-key="${NVIDIA_API_KEY}" \
    --namespace="${NAMESPACE}" \
    --dry-run=client -o yaml | kubectl apply -f -

# Deploy using Helm chart
echo ""
echo "Deploying NeMo Data Designer using Helm chart..."
helm upgrade --install "${RELEASE_NAME}" "${CHART_NAME}" \
    --repo "${CHART_REPO}" \
    --namespace "${NAMESPACE}" \
    --set nemoMicroservices.image.registry="nvcr.io/nvidia/nemo-microservices" \
    --set nemoMicroservices.image.tag="${CHART_VERSION}" \
    --set nemoMicroservices.apiKeySecret.name="nemo-api-key" \
    --set nemoMicroservices.apiKeySecret.key="api-key" \
    --set service.type="ClusterIP" \
    --set ingress.enabled=true \
    --set ingress.hosts[0].host="nemo-data-designer.your-cluster-domain.com" \
    --set ingress.hosts[0].paths[0].path="/" \
    --set ingress.hosts[0].paths[0].pathType="Prefix" \
    --timeout 10m0s \
    --wait

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Service is accessible through your cluster's ingress at:"
echo "  https://nemo-data-designer.your-cluster-domain.com"
echo ""
echo "To check status:"
echo "  kubectl get pods -n ${NAMESPACE}"
echo ""
echo "To view logs:"
echo "  kubectl logs -l app.kubernetes.io/name=nemo-data-designer -n ${NAMESPACE} -f"
echo ""
echo "To access the service internally within the cluster:"
echo "  kubectl port-forward svc/${RELEASE_NAME} 8000:8000 -n ${NAMESPACE}"
echo ""
echo "Update your local .env file with:"
echo "  NEMO_DATA_DESIGNER_BASE_URL=https://nemo-data-designer.your-cluster-domain.com"
echo ""
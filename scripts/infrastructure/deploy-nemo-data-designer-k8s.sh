#!/bin/bash
# Deploy NeMo Data Designer to Kubernetes cluster

set -e

NAMESPACE="${NAMESPACE:-nemo}"
RELEASE_NAME="${RELEASE_NAME:-nemo-data-designer}"
CHART_REPO="${CHART_REPO:-https://helm.ngc.nvidia.com/nvidia/nemo-microservices}"
CHART_NAME="${CHART_NAME:-nemo-microservices-helm-chart}"
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

# Get NVIDIA API key from .env.production if it exists, otherwise from .env
# Handle both regular files and named pipes
NVIDIA_API_KEY=""
if [ -e .env.production ]; then
    # Try to read from the file/pipe
    NVIDIA_API_KEY_LINE=$(grep "^NVIDIA_API_KEY=" .env.production | head -1)
    if [ -n "$NVIDIA_API_KEY_LINE" ]; then
        NVIDIA_API_KEY=$(echo "$NVIDIA_API_KEY_LINE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')
    fi
elif [ -e .env ]; then
    # Try to read from the file/pipe
    NVIDIA_API_KEY_LINE=$(grep "^NVIDIA_API_KEY=" .env | head -1)
    if [ -n "$NVIDIA_API_KEY_LINE" ]; then
        NVIDIA_API_KEY=$(echo "$NVIDIA_API_KEY_LINE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')
    fi
elif [ -e ../.env ]; then
    NVIDIA_API_KEY_LINE=$(grep "^NVIDIA_API_KEY=" ../.env | head -1)
    if [ -n "$NVIDIA_API_KEY_LINE" ]; then
        NVIDIA_API_KEY=$(echo "$NVIDIA_API_KEY_LINE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')
    fi
elif [ -e ../../.env ]; then
    NVIDIA_API_KEY_LINE=$(grep "^NVIDIA_API_KEY=" ../../.env | head -1)
    if [ -n "$NVIDIA_API_KEY_LINE" ]; then
        NVIDIA_API_KEY=$(echo "$NVIDIA_API_KEY_LINE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')
    fi
fi

if [ -z "$NVIDIA_API_KEY" ]; then
    echo "❌ Error: NVIDIA_API_KEY not found in local .env file"
    echo "Please add NVIDIA_API_KEY to your .env file"
    exit 1
fi

echo "✅ NVIDIA_API_KEY found"

# Add NVIDIA Helm repository with authentication
echo ""
echo "Adding NVIDIA Helm repository..."
NGC_API_KEY_CLEAN=$(echo "${NVIDIA_API_KEY}" | sed 's/"//g')
helm repo add nmp "${CHART_REPO}" --username="\$oauthtoken" --password="${NGC_API_KEY_CLEAN}" 2>/dev/null || echo "Repository already exists"
helm repo update

# Create temporary values file
cat > /tmp/nemo-values.yaml <<EOF
data-designer:
  env:
    NIM_API_KEY:
      valueFrom:
        secretKeyRef:
          name: "nemo-api-key"
          key: "api-key"
  config:
    model_provider_registry:
      default: "nvidiabuild"
      providers:
        - name: "nvidiabuild"
          endpoint: "https://integrate.api.nvidia.com/v1"
          api_key: "NIM_API_KEY"
tags:
  platform: false
  data-designer: true
EOF

# Create namespace
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

# Create secret for NVIDIA API key
NGC_API_KEY_CLEAN=$(echo "${NVIDIA_API_KEY}" | sed 's/"//g')
kubectl create secret generic nemo-api-key \
    --from-literal=api-key="${NGC_API_KEY_CLEAN}" \
    --namespace="${NAMESPACE}" \
    --dry-run=client -o yaml | kubectl apply -f -

# Deploy using Helm chart
echo ""
echo "Deploying NeMo Data Designer using Helm chart..."
helm upgrade --install "${RELEASE_NAME}" nmp/nemo-microservices-helm-chart \
    --namespace "${NAMESPACE}" \
    --values /tmp/nemo-values.yaml \
    --timeout 10m0s \
    --wait

# Clean up temporary values file
rm -f /tmp/nemo-values.yaml

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
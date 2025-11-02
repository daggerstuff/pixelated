#!/bin/bash

# Foundation Model Training Infrastructure Deployment Script
# For KAN-23 Infrastructure Enhancement

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="pixelated-training"
MONITORING_NAMESPACE="monitoring"
HELM_RELEASE="pixelated-training"
DOCKER_REGISTRY="ghcr.io/pixelated"

echo -e "${BLUE}🚀 Starting Foundation Model Training Infrastructure Deployment${NC}"

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}🔍 Checking prerequisites...${NC}"
    
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed"
        exit 1
    fi
    
    if ! command -v helm &> /dev/null; then
        print_error "helm is not installed" 
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_error "docker is not installed"
        exit 1
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    print_status "Prerequisites check passed"
}

# Create namespaces
create_namespaces() {
    echo -e "${BLUE}📁 Creating namespaces...${NC}"
    
    kubectl apply -f k8s/training/namespace.yaml
    
    # Create monitoring namespace if it doesn't exist
    kubectl create namespace ${MONITORING_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
    
    print_status "Namespaces created"
}

# Deploy storage components
deploy_storage() {
    echo -e "${BLUE}💾 Deploying storage components...${NC}"
    
    kubectl apply -f k8s/training/pvc.yaml
    
    # Wait for PVCs to be bound
    echo "Waiting for PVCs to be bound..."
    kubectl wait --for=condition=Bound pvc/training-data-pvc -n ${NAMESPACE} --timeout=300s
    kubectl wait --for=condition=Bound pvc/model-output-pvc -n ${NAMESPACE} --timeout=300s
    kubectl wait --for=condition=Bound pvc/checkpoints-pvc -n ${NAMESPACE} --timeout=300s
    
    print_status "Storage components deployed"
}

# Build and push training service image
build_training_image() {
    echo -e "${BLUE}🏗️  Building training service image...${NC}"
    
    # Build the training service image
    docker build -f docker/training-service/Dockerfile -t ${DOCKER_REGISTRY}/training-service:latest .
    
    # Push to registry (requires authentication)
    if [[ "${SKIP_PUSH:-false}" != "true" ]]; then
        docker push ${DOCKER_REGISTRY}/training-service:latest
        print_status "Training service image built and pushed"
    else
        print_warning "Skipping image push (SKIP_PUSH=true)"
    fi
}

# Deploy security policies
deploy_security() {
    echo -e "${BLUE}🔒 Deploying security policies...${NC}"
    
    kubectl apply -f k8s/security/pod-security-policy.yaml
    
    print_status "Security policies deployed"
}

# Deploy training service
deploy_training_service() {
    echo -e "${BLUE}🤖 Deploying training service...${NC}"
    
    # Create secrets (assuming they exist in environment)
    if [[ -n "${LIGHTNING_PROJECT_ID:-}" ]] && [[ -n "${WANDB_API_KEY:-}" ]] && [[ -n "${HF_TOKEN:-}" ]]; then
        kubectl create secret generic training-secrets \
            --from-literal=lightning-project-id="${LIGHTNING_PROJECT_ID}" \
            --from-literal=wandb-api-key="${WANDB_API_KEY}" \
            --from-literal=huggingface-token="${HF_TOKEN}" \
            -n ${NAMESPACE} \
            --dry-run=client -o yaml | kubectl apply -f -
    else
        print_warning "Training secrets not provided, using placeholder values"
        kubectl create secret generic training-secrets \
            --from-literal=lightning-project-id="placeholder" \
            --from-literal=wandb-api-key="placeholder" \
            --from-literal=huggingface-token="placeholder" \
            -n ${NAMESPACE} \
            --dry-run=client -o yaml | kubectl apply -f -
    fi
    
    # Deploy training service
    kubectl apply -f k8s/training/deployment.yaml
    
    # Wait for deployment to be ready
    kubectl wait --for=condition=Available deployment/training-service -n ${NAMESPACE} --timeout=600s
    
    print_status "Training service deployed"
}

# Deploy with Helm (alternative method)
deploy_with_helm() {
    echo -e "${BLUE}⚓ Deploying with Helm...${NC}"
    
    # Install or upgrade Helm release
    helm upgrade --install ${HELM_RELEASE} ./helm \
        -f helm/values-training.yaml \
        --namespace ${NAMESPACE} \
        --create-namespace \
        --wait \
        --timeout 10m
    
    print_status "Helm deployment completed"
}

# Deploy monitoring
deploy_monitoring() {
    echo -e "${BLUE}📊 Deploying monitoring...${NC}"
    
    # Create ConfigMap for Grafana dashboard
    kubectl create configmap training-dashboard \
        --from-file=monitoring/grafana/dashboards/training/foundation-model-training.json \
        -n ${MONITORING_NAMESPACE} \
        --dry-run=client -o yaml | kubectl apply -f -
    
    print_status "Monitoring components deployed"
}

# Verify deployment
verify_deployment() {
    echo -e "${BLUE}✅ Verifying deployment...${NC}"
    
    # Check pod status
    echo "Checking pod status..."
    kubectl get pods -n ${NAMESPACE}
    
    # Check services
    echo "Checking services..."
    kubectl get svc -n ${NAMESPACE}
    
    # Check PVCs
    echo "Checking storage..."
    kubectl get pvc -n ${NAMESPACE}
    
    # Test health endpoint if service is running
    if kubectl get pods -n ${NAMESPACE} -l app=training-service --field-selector=status.phase=Running | grep -q training-service; then
        echo "Testing health endpoint..."
        kubectl port-forward -n ${NAMESPACE} service/training-service 8003:80 &
        PORT_FORWARD_PID=$!
        sleep 5
        
        if curl -f http://localhost:8003/health 2>/dev/null; then
            print_status "Health check passed"
        else
            print_warning "Health check failed or service not ready"
        fi
        
        kill $PORT_FORWARD_PID 2>/dev/null || true
    fi
    
    print_status "Deployment verification completed"
}

# Main deployment function
main() {
    echo -e "${BLUE}=== Foundation Model Training Infrastructure Deployment ===${NC}"
    echo "Namespace: ${NAMESPACE}"
    echo "Registry: ${DOCKER_REGISTRY}"
    echo ""
    
    check_prerequisites
    create_namespaces
    deploy_storage
    
    # Choose deployment method
    if [[ "${USE_HELM:-true}" == "true" ]]; then
        build_training_image
        deploy_security
        deploy_with_helm
    else
        build_training_image
        deploy_security
        deploy_training_service
    fi
    
    deploy_monitoring
    verify_deployment
    
    echo ""
    echo -e "${GREEN}🎉 Foundation Model Training Infrastructure deployment completed successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Configure training data in the training-data-pvc"
    echo "2. Update training secrets with real values"
    echo "3. Access training service at: kubectl port-forward -n ${NAMESPACE} service/training-service 8003:80"
    echo "4. Monitor training progress in Grafana dashboard"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-push)
            export SKIP_PUSH=true
            shift
            ;;
        --no-helm)
            export USE_HELM=false
            shift
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --registry)
            DOCKER_REGISTRY="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --skip-push      Skip pushing Docker image to registry"
            echo "  --no-helm        Use kubectl instead of Helm for deployment"
            echo "  --namespace      Set target namespace (default: pixelated-training)"
            echo "  --registry       Set Docker registry (default: ghcr.io/pixelated)"
            echo "  --help           Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main
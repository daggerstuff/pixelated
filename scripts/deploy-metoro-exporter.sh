#!/bin/bash

# Deploy Metoro Exporter to Kubernetes Cluster
# This script installs the Metoro exporter using Helm
# Works with any Kubernetes cluster (Civo, GKE, EKS, etc.)

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Load environment variables from .env if it exists (handles regular files and named pipes)
# This must be done after logging functions are defined
load_env_file() {
    # Check if .env exists as a readable file or named pipe
    if [ -r "${PROJECT_ROOT}/.env" ] || [ -p "${PROJECT_ROOT}/.env" ] || [ -f "${PROJECT_ROOT}/.env" ]; then
        log "Loading environment variables from .env file..."
        set -a
        # Use source with error handling
        if source "${PROJECT_ROOT}/.env" 2>/dev/null; then
            set +a
            log "Environment variables loaded from .env"
            return 0
        else
            set +a
            warning "Failed to load .env file, continuing without it"
            return 1
        fi
    fi
    return 1
}

# Load environment file early
load_env_file

# Check if required tools are installed
check_dependencies() {
    log "Checking dependencies..."
    
    local required_tools=("helm" "kubectl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "${tool}" &> /dev/null; then
            error "Required tool not found: ${tool}"
        fi
    done
    
    success "All dependencies found"
}

# Verify Kubernetes cluster access
verify_cluster_access() {
    log "Verifying Kubernetes cluster access..."
    
    # Check if kubectl can connect to the cluster
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot access Kubernetes cluster. Please ensure kubectl is configured with the correct context."
    fi
    
    # Get current context
    local current_context
    current_context=$(kubectl config current-context 2>/dev/null || echo "unknown")
    log "Current Kubernetes context: ${current_context}"
    
    # Verify we can list nodes
    if ! kubectl get nodes &> /dev/null; then
        error "Cannot list cluster nodes. Please check your cluster access permissions."
    fi
    
    success "Successfully connected to Kubernetes cluster"
}

# Add Metoro Helm repository
add_metoro_repo() {
    log "Adding Metoro Helm repository..."
    
    # Check if repository already exists
    if helm repo list | grep -q "metoro-exporter"; then
        log "Metoro repository already exists, updating..."
        if ! helm repo update metoro-exporter; then
            error "Failed to update Metoro repository"
        fi
    else
        log "Adding Metoro repository..."
        if ! helm repo add metoro-exporter https://metoro-io.github.io/metoro-helm-charts/; then
            error "Failed to add Metoro repository"
        fi
        
        log "Updating Helm repositories..."
        if ! helm repo update; then
            error "Failed to update Helm repositories"
        fi
    fi
    
    success "Metoro Helm repository configured"
}

# Deploy Metoro exporter
deploy_metoro_exporter() {
    log "Deploying Metoro exporter..."
    
    # Create namespace if it doesn't exist
    if ! kubectl get namespace metoro &> /dev/null; then
        log "Creating metoro namespace..."
        if ! kubectl create namespace metoro; then
            error "Failed to create metoro namespace"
        fi
    else
        log "Namespace metoro already exists"
    fi
    
    # Install/upgrade Metoro exporter
    # JWT token obtained from Metoro webapp - contains environment "pixelcluster"
    # This JWT token is required by the exporter to authenticate and identify the environment
    # Token can be overridden by setting METORO_JWT_TOKEN environment variable
    local jwt_token="${METORO_JWT_TOKEN:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoib3JnXzM0WkVQYXdPSngzRk5VNDlsM2pJdW00dVBndiIsImVudmlyb25tZW50IjoicGl4ZWxjbHVzdGVyIiwiZXhwIjoyMDc2NzcyODQ5fQ.4r_2a41BsoOY31e2q6YFhm-hhytObYngAyaR1bTE0O0}"
    
    if [ -z "${jwt_token}" ]; then
        error "No JWT token found. Set METORO_JWT_TOKEN environment variable or update the script."
    fi
    
    # Verify token looks like a JWT (starts with eyJ)
    if [[ ! "${jwt_token}" =~ ^eyJ ]]; then
        error "Token does not appear to be a JWT (should start with 'eyJ'). The exporter requires a JWT token."
    fi
    
    log "Using JWT token (length: ${#jwt_token} characters)"
    log "Environment: pixelcluster"
    
    log "Installing Metoro exporter via Helm..."
    
    # Optimize resource requests based on actual usage analysis:
    # - Current usage: 12m CPU, 52Mi memory
    # - Default requests: 1000m CPU, 2Gi memory (massive over-provisioning)
    # - Optimized: 50m CPU, 128Mi memory (still 4x headroom for spikes)
    # Set replicas to 1 and disable HPA to work with limited cluster resources
    if ! helm upgrade --install --create-namespace --namespace metoro metoro-exporter metoro-exporter/metoro-exporter \
        --set exporter.secret.bearerToken="${jwt_token}" \
        --set exporter.replicas=1 \
        --set exporter.autoscaling.horizontalPodAutoscaler.enabled=false \
        --set exporter.resources.requests.cpu=50m \
        --set exporter.resources.requests.memory=128Mi \
        --set exporter.resources.limits.cpu=200m \
        --set exporter.resources.limits.memory=512Mi; then
        error "Failed to install Metoro exporter"
    fi
    
    log "Metoro exporter configured with optimized resources (50m CPU, 128Mi memory)"
    
    success "Metoro exporter deployed successfully"
}

# Verify deployment
verify_deployment() {
    log "Verifying Metoro exporter deployment..."
    
    # Wait for deployment to be ready
    log "Waiting for deployment to be ready..."
    if ! kubectl rollout status deployment/metoro-exporter -n metoro --timeout=300s; then
        error "Deployment failed to become ready"
    fi
    
    # Check pod status
    log "Checking pod status..."
    kubectl get pods -n metoro
    
    # Check service status
    log "Checking service status..."
    kubectl get services -n metoro
    
    success "Deployment verification completed"
}

# Main function
main() {
    log "🚀 Starting Metoro Exporter deployment to Kubernetes cluster"
    
    check_dependencies
    verify_cluster_access
    add_metoro_repo
    deploy_metoro_exporter
    verify_deployment
    
    log "🎉 Metoro Exporter deployment completed successfully!"
    log "The exporter is now running in the 'metoro' namespace and will begin sending metrics."
}

# Handle command line arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        echo "Usage: $0"
        echo "Deploys Metoro exporter to the Kubernetes cluster"
        echo ""
        echo "This script will:"
        echo "1. Verify access to the Kubernetes cluster (kubectl must be configured)"
        echo "2. Add the Metoro Helm repository"
        echo "3. Deploy the Metoro exporter to the 'metoro' namespace"
        echo "4. Verify the deployment"
        echo ""
        echo "Requirements:"
        echo "  - kubectl configured with cluster access"
        echo "  - helm installed"
        echo "  - JWT token configured in script (obtained from Metoro webapp)"
        echo ""
        echo "Note: The script uses a JWT token with environment 'pixelcluster'."
        echo "      To use a different token, set METORO_JWT_TOKEN environment variable."
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
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
    # IMPORTANT: The exporter code tries to parse the token as a JWT to extract environment info
    # However, Metoro API keys are in the format: metoro_secret_<token>
    # The recommended way is to use the installation command from the Metoro webapp
    # which generates the proper authentication token with environment information.
    #
    # For manual Helm deployment, we'll use the API key, but the exporter may fail
    # if it cannot parse it as a JWT. The webapp installation command is the recommended approach.
    local bearer_token="${METORO_JWT_TOKEN:-${METORO_API_KEY:-}}"
    
    if [ -z "${bearer_token}" ]; then
        error "No bearer token found. Set METORO_API_KEY in your .env file."
        error ""
        error "NOTE: The exporter may require a JWT token (not just an API key)."
        error "      The recommended installation method is to use the command from the Metoro webapp:"
        error "      https://us-east.metoro.io/"
        error "      The webapp will provide a properly configured installation command."
    fi
    
    # Check if token looks like a JWT (starts with eyJ) or API key (starts with metoro_secret_)
    if [[ "${bearer_token}" =~ ^eyJ ]]; then
        log "Using JWT token (length: ${#bearer_token} characters)"
    elif [[ "${bearer_token}" =~ ^metoro_secret_ ]]; then
        warning "⚠️  Using API key format (metoro_secret_...)"
        warning "The exporter code tries to parse this as a JWT to extract environment information."
        warning "If deployment fails with 'Failed to parse jwt token', you may need to:"
        warning "  1. Use the installation command from the Metoro webapp instead"
        warning "  2. Contact Metoro support for the correct token format for manual Helm deployment"
        log "Proceeding with API key deployment..."
    else
        warning "⚠️  Token format unrecognized (expected JWT starting with 'eyJ' or API key starting with 'metoro_secret_')"
        log "Proceeding with deployment..."
    fi
    
    log "Installing Metoro exporter via Helm..."
    
    if ! helm upgrade --install --create-namespace --namespace metoro metoro-exporter metoro-exporter/metoro-exporter \
        --set exporter.secret.bearerToken="${bearer_token}"; then
        error "Failed to install Metoro exporter"
    fi
    
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
        echo "  - METORO_API_KEY set in .env file"
        echo ""
        echo "IMPORTANT: The exporter code expects a JWT token to extract environment information."
        echo "           However, Metoro API keys are in format: metoro_secret_<token>"
        echo ""
        echo "Recommended: Use the installation command from the Metoro webapp:"
        echo "            https://us-east.metoro.io/"
        echo "            The webapp provides a properly configured installation command."
        echo ""
        echo "Manual Deployment: This script uses METORO_API_KEY, but the exporter may fail"
        echo "                  if it cannot parse the token as a JWT. If deployment fails,"
        echo "                  use the webapp installation command instead."
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
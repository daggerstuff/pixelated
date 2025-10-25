#!/bin/bash

# Deploy Metoro Exporter to GKE Cluster
# This script installs the Metoro exporter using Helm

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

# Check if required tools are installed
check_dependencies() {
    log "Checking dependencies..."
    
    local required_tools=("helm" "kubectl" "gcloud")
    for tool in "${required_tools[@]}"; do
        if ! command -v "${tool}" &> /dev/null; then
            error "Required tool not found: ${tool}"
        fi
    done
    
    success "All dependencies found"
}

# Authenticate with GKE cluster
authenticate_cluster() {
    log "Authenticating with GKE cluster..."
    
    # Get cluster credentials
    if ! gcloud container clusters get-credentials pixelated-empathy-prod --location=us-central1-c; then
        error "Failed to get cluster credentials"
    fi
    
    success "Successfully authenticated with GKE cluster"
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
    # Note: The bearer token is provided in the task, but in practice this should come from a secret management system
    log "Installing Metoro exporter via Helm..."
    
    if ! helm upgrade --install --create-namespace --namespace metoro metoro-exporter metoro-exporter/metoro-exporter \
        --set exporter.secret.bearerToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXN0b21lcklkIjoib3JnXzM0WkVQYXdPSngzRk5VNDlsM2pJdW00dVBndiIsImVudmlyb25tZW50IjoicGl4ZWxjbHVzdGVyIiwiZXhwIjoyMDc2NzcyODQ5fQ.4r_2a41BsoOY31e2q6YFhm-hhytObYngAyaR1bTE0O0; then
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
    log "🚀 Starting Metoro Exporter deployment to GKE cluster"
    
    check_dependencies
    authenticate_cluster
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
        echo "Deploys Metoro exporter to the GKE cluster"
        echo ""
        echo "This script will:"
        echo "1. Authenticate with the GKE cluster"
        echo "2. Add the Metoro Helm repository"
        echo "3. Deploy the Metoro exporter to the 'metoro' namespace"
        echo "4. Verify the deployment"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
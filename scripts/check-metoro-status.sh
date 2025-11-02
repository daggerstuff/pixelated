#!/bin/bash

# Check Metoro Exporter Status
# This script checks the status of the Metoro exporter deployment

set -euo pipefail

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
}

# Check if required tools are installed
check_dependencies() {
    log "Checking dependencies..."
    
    local required_tools=("kubectl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "${tool}" &> /dev/null; then
            error "Required tool not found: ${tool}"
            exit 1
        fi
    done
    
    success "All dependencies found"
}

# Check namespace existence
check_namespace() {
    log "Checking metoro namespace..."
    
    if kubectl get namespace metoro &> /dev/null; then
        success "Namespace 'metoro' exists"
    else
        error "Namespace 'metoro' does not exist"
        exit 1
    fi
}

# Check pod status
check_pods() {
    log "Checking pod status..."
    
    local pods_running
    pods_running=$(kubectl get pods -n metoro --no-headers | grep -c "Running" || true)
    local total_pods
    total_pods=$(kubectl get pods -n metoro --no-headers | wc -l || true)
    
    if [[ $pods_running -eq $total_pods ]] && [[ $total_pods -gt 0 ]]; then
        success "All $total_pods pods are running"
        kubectl get pods -n metoro
    else
        warning "Not all pods are running ($pods_running/$total_pods)"
        kubectl get pods -n metoro
        return 1
    fi
}

# Check service status
check_services() {
    log "Checking service status..."
    
    local service_count
    service_count=$(kubectl get services -n metoro --no-headers | wc -l || true)
    
    if [[ $service_count -gt 0 ]]; then
        success "Found $service_count services"
        kubectl get services -n metoro
    else
        warning "No services found in metoro namespace"
        return 1
    fi
}

# Check recent logs
check_logs() {
    log "Checking recent logs from exporter pods..."
    
    # Get logs from the first exporter pod
    local first_pod
    first_pod=$(kubectl get pods -n metoro -l app.kubernetes.io/name=metoro-exporter --no-headers | head -n 1 | awk '{print $1}' || true)
    
    if [[ -n "$first_pod" ]]; then
        log "Recent logs from $first_pod:"
        kubectl logs "$first_pod" -n metoro --tail=10
    else
        warning "No exporter pods found"
        return 1
    fi
}

# Main function
main() {
    log "🚀 Checking Metoro Exporter Deployment Status"
    
    check_dependencies
    check_namespace
    
    if check_pods && check_services; then
        success "Metoro exporter deployment appears to be healthy"
        check_logs
        log "🎉 Status check completed successfully"
    else
        error "Issues detected in Metoro exporter deployment"
        check_logs
        log "Please investigate the issues above"
        exit 1
    fi
}

# Handle command line arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        echo "Usage: $0"
        echo "Checks the status of the Metoro exporter deployment"
        echo ""
        echo "This script will:"
        echo "1. Verify the metoro namespace exists"
        echo "2. Check that all pods are running"
        echo "3. Verify services are present"
        echo "4. Show recent logs from exporter pods"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
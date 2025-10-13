#!/bin/bash

# Global Threat Intelligence Network Deployment Script
# This script deploys the comprehensive threat intelligence system

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOYMENT_ENV="${1:-staging}"
VERSION="${2:-latest}"
REGIONS="${3:-us-east-1,eu-west-1,ap-southeast-1}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if required tools are installed
    command -v node >/dev/null 2>&1 || { log_error "Node.js is required but not installed."; exit 1; }
    command -v pnpm >/dev/null 2>&1 || { log_error "pnpm is required but not installed."; exit 1; }
    command -v docker >/dev/null 2>&1 || { log_error "Docker is required but not installed."; exit 1; }
    command -v kubectl >/dev/null 2>&1 || { log_error "kubectl is required but not installed."; exit 1; }
    
    # Check environment variables
    required_vars=("MONGODB_URI" "REDIS_URL" "OPENAI_API_KEY")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    log_success "Prerequisites check passed"
}

# Build application
build_application() {
    log_info "Building threat intelligence application..."
    
    cd "${PROJECT_ROOT}"
    
    # Install dependencies
    pnpm install --frozen-lockfile
    
    # Build the application
    pnpm build
    
    # Run tests
    pnpm test:unit
    
    log_success "Application built successfully"
}

# Deploy to Kubernetes
deploy_to_kubernetes() {
    local region=$1
    local namespace="threat-intelligence-${DEPLOYMENT_ENV}"
    
    log_info "Deploying to Kubernetes in region ${region}..."
    
    # Create namespace if it doesn't exist
    kubectl create namespace "${namespace}" --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply configuration
    kubectl apply -f k8s/configmap.yaml -n "${namespace}"
    kubectl apply -f k8s/secret.yaml -n "${namespace}"
    
    # Deploy each component
    for component in global edge correlation database orchestration hunting feeds validation; do
        log_info "Deploying ${component} component..."
        
        # Update deployment with current version and region
        sed -e "s/{{VERSION}}/${VERSION}/g" \
            -e "s/{{REGION}}/${region}/g" \
            -e "s/{{ENVIRONMENT}}/${DEPLOYMENT_ENV}/g" \
            "k8s/${component}-deployment.yaml" | \
            kubectl apply -f - -n "${namespace}"
        
        # Wait for deployment to be ready
        kubectl rollout status deployment/threat-intelligence-${component} -n "${namespace}" --timeout=300s
        
        log_success "${component} component deployed successfully"
    done
    
    # Deploy services and ingress
    kubectl apply -f k8s/services.yaml -n "${namespace}"
    kubectl apply -f k8s/ingress.yaml -n "${namespace}"
    
    log_success "Kubernetes deployment completed for region ${region}"
}

# Deploy databases
deploy_databases() {
    log_info "Deploying databases..."
    
    # Deploy MongoDB
    kubectl apply -f k8s/mongodb-deployment.yaml
    kubectl apply -f k8s/mongodb-service.yaml
    
    # Deploy Redis
    kubectl apply -f k8s/redis-deployment.yaml
    kubectl apply -f k8s/redis-service.yaml
    
    # Wait for databases to be ready
    kubectl rollout status deployment/mongodb --timeout=600s
    kubectl rollout status deployment/redis --timeout=300s
    
    log_success "Databases deployed successfully"
}

# Deploy monitoring
deploy_monitoring() {
    log_info "Deploying monitoring stack..."
    
    # Deploy Prometheus
    kubectl apply -f monitoring/prometheus-deployment.yaml
    kubectl apply -f monitoring/prometheus-service.yaml
    
    # Deploy Grafana
    kubectl apply -f monitoring/grafana-deployment.yaml
    kubectl apply -f monitoring/grafana-service.yaml
    
    # Deploy custom dashboards
    kubectl create configmap threat-intelligence-dashboards \
        --from-file=monitoring/dashboards/threat-intelligence-overview.json \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy alerting rules
    kubectl apply -f monitoring/alerts/threat-intelligence-alerts.yaml
    
    log_success "Monitoring stack deployed successfully"
}

# Initialize threat intelligence data
initialize_data() {
    log_info "Initializing threat intelligence data..."
    
    # Run database migrations
    pnpm mongodb:migrate
    
    # Seed initial data
    pnpm mongodb:seed
    
    # Initialize AI models
    pnpm initialize-models
    
    log_success "Data initialization completed"
}

# Configure external feeds
configure_feeds() {
    log_info "Configuring external threat feeds..."
    
    # Create feed configuration
    cat > feeds-config.yaml << EOF
feeds:
  - sourceId: "otx_alien_vault"
    name: "AlienVault OTX"
    provider: "AlienVault"
    feedType: "otx"
    endpoint: "https://otx.alienvault.com/api/v1/pulses/subscribed"
    authType: "api_key"
    requiresAuth: true
    updateFrequency: "hourly"
    enabled: true
  - sourceId: "virustotal_intelligence"
    name: "VirusTotal Intelligence"
    provider: "VirusTotal"
    feedType: "virustotal"
    endpoint: "https://www.virustotal.com/api/v3/intelligence/hunting_notifications"
    authType: "api_key"
    requiresAuth: true
    updateFrequency: "real-time"
    enabled: true
EOF
    
    # Apply feed configuration
    kubectl create configmap threat-feeds-config \
        --from-file=feeds-config.yaml \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log_success "External feeds configured successfully"
}

# Health checks
perform_health_checks() {
    local region=$1
    local namespace="threat-intelligence-${DEPLOYMENT_ENV}"
    
    log_info "Performing health checks for region ${region}..."
    
    # Check pod status
    kubectl get pods -n "${namespace}" -l app=threat-intelligence
    
    # Check service endpoints
    kubectl get endpoints -n "${namespace}"
    
    # Test API endpoints
    local api_endpoint="https://threat-intelligence-${DEPLOYMENT_ENV}.${region}.pixelated.com/health"
    
    if curl -f -s -o /dev/null "${api_endpoint}"; then
        log_success "API health check passed for region ${region}"
    else
        log_error "API health check failed for region ${region}"
        return 1
    fi
    
    log_success "Health checks completed for region ${region}"
}

# Setup load balancing and failover
setup_load_balancing() {
    log_info "Setting up load balancing and failover..."
    
    # Deploy load balancer configuration
    kubectl apply -f k8s/load-balancer.yaml
    
    # Configure failover rules
    kubectl apply -f k8s/failover-config.yaml
    
    log_success "Load balancing and failover configured"
}

# Security hardening
security_hardening() {
    log_info "Applying security hardening..."
    
    # Apply network policies
    kubectl apply -f k8s/network-policies.yaml
    
    # Apply pod security policies
    kubectl apply -f k8s/pod-security-policies.yaml
    
    # Apply RBAC configurations
    kubectl apply -f k8s/rbac.yaml
    
    # Enable audit logging
    kubectl apply -f k8s/audit-config.yaml
    
    log_success "Security hardening applied"
}

# Backup configuration
configure_backups() {
    log_info "Configuring backups..."
    
    # Create backup cron jobs
    kubectl apply -f k8s/backup-cronjob.yaml
    
    # Configure backup storage
    kubectl apply -f k8s/backup-storage.yaml
    
    log_success "Backup configuration completed"
}

# Main deployment function
main() {
    log_info "Starting Global Threat Intelligence Network deployment..."
    log_info "Environment: ${DEPLOYMENT_ENV}"
    log_info "Version: ${VERSION}"
    log_info "Regions: ${REGIONS}"
    
    # Parse regions
    IFS=',' read -ra REGION_ARRAY <<< "$REGIONS"
    
    # Execute deployment steps
    check_prerequisites
    build_application
    deploy_databases
    
    # Deploy to each region
    for region in "${REGION_ARRAY[@]}"; do
        log_info "Deploying to region: ${region}"
        deploy_to_kubernetes "$region"
        perform_health_checks "$region"
    done
    
    setup_load_balancing
    deploy_monitoring
    security_hardening
    configure_backups
    initialize_data
    configure_feeds
    
    log_success "Global Threat Intelligence Network deployment completed successfully!"
    log_info "Access points:"
    for region in "${REGION_ARRAY[@]}"; do
        log_info "  - ${region}: https://threat-intelligence-${DEPLOYMENT_ENV}.${region}.pixelated.com"
    done
    
    # Display deployment summary
    echo ""
    log_info "Deployment Summary:"
    echo "  Environment: ${DEPLOYMENT_ENV}"
    echo "  Version: ${VERSION}"
    echo "  Regions: ${REGIONS}"
    echo "  Status: ✅ DEPLOYED"
    echo ""
    log_info "Next steps:"
    echo "  1. Monitor the deployment using the provided dashboards"
    echo "  2. Configure external threat feeds as needed"
    echo "  3. Set up alerting and notification channels"
    echo "  4. Perform initial threat hunting operations"
    echo ""
}

# Cleanup function
cleanup() {
    log_info "Cleaning up deployment resources..."
    
    # Remove temporary files
    rm -f feeds-config.yaml
    
    log_success "Cleanup completed"
}

# Set trap for cleanup
trap cleanup EXIT

# Execute main function
main "$@"
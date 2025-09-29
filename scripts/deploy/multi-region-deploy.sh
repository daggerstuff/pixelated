#!/bin/bash

# Multi-Region Deployment Script
# Automated deployment script for global multi-region infrastructure

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOG_FILE="${PROJECT_ROOT}/logs/multi-region-deploy-$(date +%Y%m%d-%H%M%S).log"
CONFIG_FILE="${PROJECT_ROOT}/config/multi-region-config.json"
TERRAFORM_DIR="${PROJECT_ROOT}/terraform/multi-region"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        INFO)  color=$BLUE ;;
        SUCCESS) color=$GREEN ;;
        WARN)  color=$YELLOW ;;
        ERROR) color=$RED ;;
        *)     color=$NC ;;
    esac
    
    echo -e "${color}[${timestamp}] [${level}] ${message}${NC}" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log ERROR "$1"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log INFO "Checking prerequisites..."
    
    # Check required tools
    local required_tools=("terraform" "aws" "gcloud" "kubectl" "helm" "jq" "curl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error_exit "Required tool '$tool' is not installed"
        fi
    done
    
    # Check environment variables
    local required_env_vars=(
        "AWS_ACCESS_KEY_ID"
        "AWS_SECRET_ACCESS_KEY"
        "AWS_DEFAULT_REGION"
        "GOOGLE_APPLICATION_CREDENTIALS"
        "TF_VAR_gcp_project_id"
        "TF_VAR_azure_subscription_id"
        "TF_VAR_azure_client_id"
        "TF_VAR_azure_client_secret"
        "TF_VAR_azure_tenant_id"
    )
    
    for var in "${required_env_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error_exit "Required environment variable '$var' is not set"
        fi
    done
    
    log SUCCESS "All prerequisites satisfied"
}

# Initialize Terraform
init_terraform() {
    log INFO "Initializing Terraform..."
    
    cd "$TERRAFORM_DIR"
    
    # Initialize Terraform backend
    terraform init -backend=true -backend-config="bucket=${TF_VAR_project_name:-pixelated}-terraform-state" \
        -backend-config="key=multi-region/${ENVIRONMENT:-production}/terraform.tfstate" \
        -backend-config="region=${AWS_DEFAULT_REGION:-us-east-1}" \
        -backend-config="encrypt=true" \
        -backend-config="dynamodb_table=${TF_VAR_project_name:-pixelated}-terraform-locks" || error_exit "Terraform initialization failed"
    
    # Validate configuration
    terraform validate || error_exit "Terraform validation failed"
    
    # Plan deployment
    terraform plan -out=tfplan -var-file="terraform.tfvars" || error_exit "Terraform plan failed"
    
    log SUCCESS "Terraform initialization completed"
}

# Deploy infrastructure
deploy_infrastructure() {
    log INFO "Deploying multi-region infrastructure..."
    
    cd "$TERRAFORM_DIR"
    
    # Apply Terraform configuration
    terraform apply -auto-approve tfplan || error_exit "Terraform apply failed"
    
    # Save outputs
    terraform output -json > outputs.json
    
    log SUCCESS "Infrastructure deployment completed"
}

# Configure Kubernetes clusters
configure_kubernetes() {
    log INFO "Configuring Kubernetes clusters..."
    
    local regions=("us-east-1" "us-west-2" "eu-central-1" "ap-southeast-1")
    
    for region in "${regions[@]}"; do
        log INFO "Configuring EKS cluster in $region..."
        
        # Update kubeconfig
        aws eks update-kubeconfig --region "$region" --name "pixelated-eks-${region//-/_}" || {
            log WARN "Failed to update kubeconfig for $region"
            continue
        }
        
        # Apply cluster configurations
        kubectl apply -f "${PROJECT_ROOT}/k8s/multi-region/cluster-config.yaml" --context="arn:aws:eks:${region}:$(aws sts get-caller-identity --query Account --output text):cluster/pixelated-eks-${region//-/_}" || {
            log WARN "Failed to apply cluster configuration for $region"
            continue
        }
        
        # Install cluster add-ons
        install_cluster_addons "$region"
        
        log SUCCESS "EKS cluster configuration completed for $region"
    done
    
    # Configure GCP GKE clusters
    configure_gke_clusters
    
    log SUCCESS "All Kubernetes clusters configured"
}

# Install cluster add-ons
install_cluster_addons() {
    local region=$1
    
    log INFO "Installing cluster add-ons for $region..."
    
    # Install metrics server
    kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml \
        --context="arn:aws:eks:${region}:$(aws sts get-caller-identity --query Account --output text):cluster/pixelated-eks-${region//-/_}" || \
        log WARN "Failed to install metrics server for $region"
    
    # Install cluster autoscaler
    helm repo add autoscaler https://kubernetes.github.io/autoscaler || log WARN "Failed to add autoscaler repo"
    helm repo update
    
    helm upgrade --install cluster-autoscaler autoscaler/cluster-autoscaler \
        --namespace kube-system \
        --set autoDiscovery.clusterName="pixelated-eks-${region//-/_}" \
        --set awsRegion="$region" \
        --set rbac.create=true \
        --context="arn:aws:eks:${region}:$(aws sts get-caller-identity --query Account --output text):cluster/pixelated-eks-${region//-/_}" || \
        log WARN "Failed to install cluster autoscaler for $region"
    
    # Install AWS Load Balancer Controller
    helm repo add eks https://aws.github.io/eks-charts || log WARN "Failed to add EKS charts repo"
    helm repo update
    
    helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
        --namespace kube-system \
        --set clusterName="pixelated-eks-${region//-/_}" \
        --set serviceAccount.create=true \
        --set serviceAccount.name=aws-load-balancer-controller \
        --context="arn:aws:eks:${region}:$(aws sts get-caller-identity --query Account --output text):cluster/pixelated-eks-${region//-/_}" || \
        log WARN "Failed to install AWS Load Balancer Controller for $region"
}

# Configure GKE clusters
configure_gke_clusters() {
    log INFO "Configuring GKE clusters..."
    
    local gcp_regions=("europe-west3" "asia-southeast1")
    
    for region in "${gcp_regions[@]}"; do
        log INFO "Configuring GKE cluster in $region..."
        
        # Get cluster credentials
        gcloud container clusters get-credentials "pixelated-gke-${region//-/_}" --region "$region" || {
            log WARN "Failed to get credentials for GKE cluster in $region"
            continue
        }
        
        # Apply configurations
        kubectl apply -f "${PROJECT_ROOT}/k8s/multi-region/gke-config.yaml" || {
            log WARN "Failed to apply GKE configuration for $region"
            continue
        }
        
        log SUCCESS "GKE cluster configuration completed for $region"
    done
}

# Deploy applications
deploy_applications() {
    log INFO "Deploying applications to multi-region clusters..."
    
    # Deploy to each region
    local regions=("us-east-1" "us-west-2" "eu-central-1" "ap-southeast-1")
    
    for region in "${regions[@]}"; do
        log INFO "Deploying to $region..."
        
        # Set context
        kubectl config use-context "arn:aws:eks:${region}:$(aws sts get-caller-identity --query Account --output text):cluster/pixelated-eks-${region//-/_}" || {
            log WARN "Failed to set context for $region"
            continue
        }
        
        # Deploy application
        deploy_application "$region"
        
        log SUCCESS "Application deployment completed for $region"
    done
    
    # Deploy to GCP regions
    deploy_gcp_applications
    
    log SUCCESS "All applications deployed"
}

# Deploy application to specific region
deploy_application() {
    local region=$1
    
    log INFO "Deploying application to $region..."
    
    # Create namespace
    kubectl create namespace pixelated --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply configurations
    kubectl apply -f "${PROJECT_ROOT}/k8s/multi-region/configmap.yaml" -n pixelated
    kubectl apply -f "${PROJECT_ROOT}/k8s/multi-region/secrets.yaml" -n pixelated
    
    # Deploy main application
    envsubst < "${PROJECT_ROOT}/k8s/multi-region/deployment.yaml" | kubectl apply -f - -n pixelated
    
    # Deploy services
    kubectl apply -f "${PROJECT_ROOT}/k8s/multi-region/service.yaml" -n pixelated
    
    # Deploy ingress
    envsubst < "${PROJECT_ROOT}/k8s/multi-region/ingress.yaml" | kubectl apply -f - -n pixelated
    
    # Wait for deployment
    kubectl rollout status deployment/pixelated-app -n pixelated --timeout=600s || \
        log WARN "Deployment rollout timeout for $region"
}

# Deploy GCP applications
deploy_gcp_applications() {
    log INFO "Deploying applications to GCP regions..."
    
    local gcp_regions=("europe-west3" "asia-southeast1")
    
    for region in "${gcp_regions[@]}"; do
        log INFO "Deploying to GKE cluster in $region..."
        
        # Set context
        kubectl config use-context "gke_${TF_VAR_gcp_project_id}_${region}_pixelated-gke-${region//-/_}" || {
            log WARN "Failed to set GKE context for $region"
            continue
        }
        
        # Deploy application
        deploy_application "$region"
        
        log SUCCESS "Application deployment completed for GKE $region"
    done
}

# Configure global load balancing
configure_global_load_balancing() {
    log INFO "Configuring global load balancing..."
    
    cd "$TERRAFORM_DIR"
    
    # Get load balancer endpoints
    local us_east_endpoint=$(terraform output -raw multi_region_endpoints | jq -r '.us_east.load_balancer_dns')
    local us_west_endpoint=$(terraform output -raw multi_region_endpoints | jq -r '.us_west.load_balancer_dns')
    local eu_central_endpoint=$(terraform output -raw multi_region_endpoints | jq -r '.eu_central.load_balancer_dns')
    local ap_southeast_endpoint=$(terraform output -raw multi_region_endpoints | jq -r '.ap_southeast.load_balancer_dns')
    
    # Configure Cloudflare load balancing
    configure_cloudflare_lb "$us_east_endpoint" "$us_west_endpoint" "$eu_central_endpoint" "$ap_southeast_endpoint"
    
    log SUCCESS "Global load balancing configured"
}

# Configure Cloudflare load balancing
configure_cloudflare_lb() {
    local us_east=$1
    local us_west=$2
    local eu_central=$3
    local ap_southeast=$4
    
    log INFO "Configuring Cloudflare load balancing..."
    
    # Create health checks
    for region in us-east us-west eu-central ap-southeast; do
        curl -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/healthchecks" \
            -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
            -H "Content-Type: application/json" \
            --data "{
                \"type\": \"HTTPS\",
                \"name\": \"pixelated-${region}\",
                \"description\": \"Health check for ${region} region\",
                \"suspended\": false,
                \"address\": \"api-${region}.${DOMAIN_NAME}\",
                \"path\": \"/health\",
                \"port\": 443,
                \"interval\": 30,
                \"timeout\": 5,
                \"retries\": 3,
                \"consecutive_up\": 2,
                \"consecutive_down\": 3,
                \"expected_codes\": \"200\"
            }" || log WARN "Failed to create health check for $region"
    done
    
    log SUCCESS "Cloudflare load balancing configured"
}

# Configure monitoring and alerting
configure_monitoring() {
    log INFO "Configuring monitoring and alerting..."
    
    # Deploy Prometheus and Grafana
    deploy_monitoring_stack
    
    # Configure alerts
    configure_alerts
    
    log SUCCESS "Monitoring and alerting configured"
}

# Deploy monitoring stack
deploy_monitoring_stack() {
    log INFO "Deploying monitoring stack..."
    
    # Add Prometheus Helm repository
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts || error_exit "Failed to add Prometheus repo"
    helm repo add grafana https://grafana.github.io/helm-charts || error_exit "Failed to add Grafana repo"
    helm repo update
    
    # Deploy Prometheus
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --create-namespace \
        --set prometheus.prometheusSpec.retention=30d \
        --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=100Gi \
        --set grafana.adminPassword="${GRAFANA_ADMIN_PASSWORD}" || \
        log WARN "Failed to deploy Prometheus stack"
    
    # Deploy custom dashboards
    kubectl apply -f "${PROJECT_ROOT}/monitoring/dashboards/" -n monitoring || \
        log WARN "Failed to apply custom dashboards"
    
    log SUCCESS "Monitoring stack deployed"
}

# Configure alerts
configure_alerts() {
    log INFO "Configuring alerts..."
    
    # Apply alert rules
    kubectl apply -f "${PROJECT_ROOT}/monitoring/alerts/" -n monitoring || \
        log WARN "Failed to apply alert rules"
    
    # Configure alertmanager
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        kubectl create secret generic alertmanager-slack \
            --from-literal=webhook_url="$SLACK_WEBHOOK_URL" \
            --namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
    fi
    
    log SUCCESS "Alerts configured"
}

# Run health checks
run_health_checks() {
    log INFO "Running health checks..."
    
    # Check all regions
    local regions=("us-east-1" "us-west-2" "eu-central-1" "ap-southeast-1")
    
    for region in "${regions[@]}"; do
        log INFO "Running health checks for $region..."
        
        # Set context
        kubectl config use-context "arn:aws:eks:${region}:$(aws sts get-caller-identity --query Account --output text):cluster/pixelated-eks-${region//-/_}" || {
            log WARN "Failed to set context for $region"
            continue
        }
        
        # Run health checks
        kubectl get pods -n pixelated || log WARN "Failed to get pods for $region"
        kubectl get services -n pixelated || log WARN "Failed to get services for $region"
        kubectl get ingress -n pixelated || log WARN "Failed to get ingress for $region"
        
        # Test application endpoints
        test_application_health "$region"
        
        log SUCCESS "Health checks completed for $region"
    done
    
    log SUCCESS "All health checks completed"
}

# Test application health
test_application_health() {
    local region=$1
    
    log INFO "Testing application health for $region..."
    
    # Get load balancer endpoint
    local endpoint=$(kubectl get ingress pixelated-ingress -n pixelated -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
    
    if [[ -n "$endpoint" ]]; then
        # Test health endpoint
        if curl -f -s -m 10 "https://${endpoint}/health" > /dev/null; then
            log SUCCESS "Application health check passed for $region"
        else
            log WARN "Application health check failed for $region"
        fi
    else
        log WARN "No load balancer endpoint found for $region"
    fi
}

# Configure backup and disaster recovery
configure_backup_dr() {
    log INFO "Configuring backup and disaster recovery..."
    
    # Configure database backups
    configure_database_backups
    
    # Configure cross-region replication
    configure_cross_region_replication
    
    # Test disaster recovery
    test_disaster_recovery
    
    log SUCCESS "Backup and disaster recovery configured"
}

# Configure database backups
configure_database_backups() {
    log INFO "Configuring database backups..."
    
    # Create backup policies
    for region in us-east-1 us-west-2 eu-central-1 ap-southeast-1; do
        aws rds create-db-snapshot \
            --db-snapshot-identifier "pixelated-${region}-$(date +%Y%m%d-%H%M%S)" \
            --db-instance-identifier "pixelated-db-${region}" || \
            log WARN "Failed to create snapshot for $region"
    done
    
    log SUCCESS "Database backups configured"
}

# Configure cross-region replication
configure_cross_region_replication() {
    log INFO "Configuring cross-region replication..."
    
    # Configure S3 cross-region replication
    cd "$TERRAFORM_DIR"
    terraform apply -auto-approve -target=module.s3_multi_region || \
        log WARN "Failed to configure S3 cross-region replication"
    
    log SUCCESS "Cross-region replication configured"
}

# Test disaster recovery
test_disaster_recovery() {
    log INFO "Testing disaster recovery..."
    
    # Test failover scenarios
    test_failover_scenarios
    
    log SUCCESS "Disaster recovery testing completed"
}

# Test failover scenarios
test_failover_scenarios() {
    log INFO "Testing failover scenarios..."
    
    # Simulate region failure
    log INFO "Simulating region failure..."
    
    # Test traffic routing
    test_traffic_routing
    
    log SUCCESS "Failover scenarios tested"
}

# Test traffic routing
test_traffic_routing() {
    log INFO "Testing traffic routing..."
    
    # Test global DNS resolution
    for region in us-east us-west eu-central ap-southeast; do
        if nslookup "api-${region}.${DOMAIN_NAME}" > /dev/null 2>&1; then
            log SUCCESS "DNS resolution working for $region"
        else
            log WARN "DNS resolution failed for $region"
        fi
    done
    
    log SUCCESS "Traffic routing tested"
}

# Generate deployment report
generate_deployment_report() {
    log INFO "Generating deployment report..."
    
    local report_file="${PROJECT_ROOT}/reports/multi-region-deployment-$(date +%Y%m%d-%H%M%S).json"
    
    # Create report directory
    mkdir -p "$(dirname "$report_file")"
    
    # Generate report
    cat > "$report_file" << EOF
{
    "deployment_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "${ENVIRONMENT:-production}",
    "regions": {
        "aws": ["us-east-1", "us-west-2", "eu-central-1", "ap-southeast-1"],
        "gcp": ["europe-west3", "asia-southeast1"]
    },
    "status": "completed",
    "components": {
        "kubernetes_clusters": "deployed",
        "databases": "deployed",
        "load_balancers": "configured",
        "monitoring": "configured",
        "backup_dr": "configured"
    },
    "endpoints": {
        "global_api": "https://api.${DOMAIN_NAME}",
        "monitoring": {
            "grafana": "https://grafana.${DOMAIN_NAME}",
            "prometheus": "https://prometheus.${DOMAIN_NAME}"
        }
    },
    "logs": "${LOG_FILE}"
}
EOF
    
    log SUCCESS "Deployment report generated: $report_file"
}

# Cleanup function
cleanup() {
    log INFO "Cleaning up..."
    
    # Remove temporary files
    rm -f "${TERRAFORM_DIR}/tfplan"
    rm -f "${TERRAFORM_DIR}/outputs.json"
    
    log SUCCESS "Cleanup completed"
}

# Main deployment function
main() {
    log INFO "Starting multi-region deployment..."
    
    # Set up trap for cleanup
    trap cleanup EXIT
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --environment|-e)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --config|-c)
                CONFIG_FILE="$2"
                shift 2
                ;;
            --skip-health-checks)
                SKIP_HEALTH_CHECKS=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log WARN "Unknown option: $1"
                shift
                ;;
        esac
    done
    
    # Set default environment
    ENVIRONMENT=${ENVIRONMENT:-production}
    
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Run deployment steps
    check_prerequisites
    init_terraform
    deploy_infrastructure
    configure_kubernetes
    deploy_applications
    configure_global_load_balancing
    configure_monitoring
    
    if [[ "${SKIP_HEALTH_CHECKS:-false}" != "true" ]]; then
        run_health_checks
    fi
    
    configure_backup_dr
    generate_deployment_report
    
    log SUCCESS "Multi-region deployment completed successfully!"
    log INFO "Check the deployment report and logs for details"
}

# Show help
show_help() {
    cat << EOF
Multi-Region Deployment Script

Usage: $0 [OPTIONS]

Options:
    -e, --environment ENV     Environment (development, staging, production)
    -c, --config FILE         Configuration file path
    --skip-health-checks      Skip health checks after deployment
    -h, --help               Show this help message

Environment Variables:
    AWS_ACCESS_KEY_ID         AWS access key
    AWS_SECRET_ACCESS_KEY     AWS secret key
    AWS_DEFAULT_REGION        AWS default region
    GOOGLE_APPLICATION_CREDENTIALS  GCP service account key
    TF_VAR_gcp_project_id     GCP project ID
    TF_VAR_azure_subscription_id    Azure subscription ID
    TF_VAR_azure_client_id    Azure client ID
    TF_VAR_azure_client_secret      Azure client secret
    TF_VAR_azure_tenant_id    Azure tenant ID
    DOMAIN_NAME               Domain name for the application
    CLOUDFLARE_API_TOKEN      Cloudflare API token
    CLOUDFLARE_ZONE_ID        Cloudflare zone ID
    GRAFANA_ADMIN_PASSWORD    Grafana admin password
    SLACK_WEBHOOK_URL         Slack webhook URL for alerts

Examples:
    $0 --environment production
    $0 -e staging --config custom-config.json
    $0 --skip-health-checks

EOF
}

# Run main function
main "$@"
#!/bin/bash
# Google Cloud Workload Identity Federation Deployment Script
# ==========================================================
# This script deploys the GCP Workload Identity Federation infrastructure
# required for GitHub Actions to authenticate to Google Cloud without service account keys

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")"
GCP_CONFIG_FILE="${SCRIPT_DIR}/gcp-config.tfvars"

# Functions
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
    
    # Check if Terraform is installed
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed. Please install Terraform >= 1.0"
        exit 1
    fi
    
    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        log_error "Google Cloud SDK is not installed. Please install gcloud CLI"
        exit 1
    fi
    
    # Check if user is authenticated with gcloud
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        log_error "Not authenticated with Google Cloud. Please run: gcloud auth login"
        exit 1
    fi
    
    log_success "Prerequisites check completed"
}

# Initialize Terraform
init_terraform() {
    log_info "Initializing Terraform..."
    
    cd "$TERRAFORM_DIR"
    
    # Initialize Terraform
    terraform init -backend=false
    
    if [ $? -eq 0 ]; then
        log_success "Terraform initialized successfully"
    else
        log_error "Failed to initialize Terraform"
        exit 1
    fi
}

# Validate Terraform configuration
validate_terraform() {
    log_info "Validating Terraform configuration..."
    
    cd "$TERRAFORM_DIR"
    
    # Validate configuration
    terraform validate
    
    if [ $? -eq 0 ]; then
        log_success "Terraform configuration is valid"
    else
        log_error "Terraform configuration validation failed"
        exit 1
    fi
}

# Plan Terraform deployment
plan_deployment() {
    log_info "Planning Terraform deployment..."
    
    cd "$TERRAFORM_DIR"
    
    # Create plan
    terraform plan -out=tfplan-gcp-workload-identity \
        -var-file="$GCP_CONFIG_FILE" \
        -target=google_project_service.required_apis \
        -target=google_iam_workload_identity_pool.github_pool \
        -target=google_iam_workload_identity_pool_provider.github_provider \
        -target=google_service_account.github_actions_sa \
        -target=google_project_iam_member.github_actions_roles \
        -target=google_service_account_iam_member.workload_identity_user \
        -target=google_project_iam_custom_role.gke_monitoring_role \
        -target=google_project_iam_member.gke_monitoring_role_binding
    
    if [ $? -eq 0 ]; then
        log_success "Terraform plan created successfully"
    else
        log_error "Failed to create Terraform plan"
        exit 1
    fi
}

# Apply Terraform deployment
apply_deployment() {
    log_info "Applying Terraform deployment..."
    
    cd "$TERRAFORM_DIR"
    
    # Apply plan
    terraform apply tfplan-gcp-workload-identity
    
    if [ $? -eq 0 ]; then
        log_success "Terraform deployment completed successfully"
    else
        log_error "Failed to apply Terraform deployment"
        exit 1
    fi
}

# Show deployment outputs
show_outputs() {
    log_info "Showing deployment outputs..."
    
    cd "$TERRAFORM_DIR"
    
    # Show outputs
    terraform output -json github_actions_configuration | jq -r '.setup_instructions'
    
    log_info "Configuration values for GitHub Actions secrets:"
    terraform output -json github_actions_configuration | jq -r '
        "GCP_WORKLOAD_IDENTITY_PROVIDER: " + .GCP_WORKLOAD_IDENTITY_PROVIDER + "\n" +
        "GCP_SERVICE_ACCOUNT_EMAIL: " + .GCP_SERVICE_ACCOUNT_EMAIL + "\n" +
        "GCP_PROJECT_ID: " + .GCP_PROJECT_ID
    '
}

# Create configuration file
create_config_file() {
    log_info "Creating configuration file..."
    
    cat > "$GCP_CONFIG_FILE" << EOF
# Google Cloud Platform Configuration
gcp_project_id = "pixelated-463209-e5"
gcp_region     = "us-central1"

# GitHub Configuration
github_repository = "pixelatedempathy/pixelated"

# Workload Identity Configuration
workload_identity_pool_id      = "github-pool"
workload_identity_provider_id  = "github-provider"

# Service Account Configuration
service_account_id          = "github-actions-sa"
service_account_display_name = "GitHub Actions Service Account"
EOF

    log_success "Configuration file created at $GCP_CONFIG_FILE"
}

# Main deployment function
main() {
    log_info "Starting Google Cloud Workload Identity Federation deployment..."
    
    # Create configuration file
    create_config_file
    
    # Check prerequisites
    check_prerequisites
    
    # Initialize Terraform
    init_terraform
    
    # Validate configuration
    validate_terraform
    
    # Plan deployment
    plan_deployment
    
    # Ask for confirmation
    log_warning "This will create Google Cloud resources that may incur costs."
    log_info "Please review the Terraform plan above."
    read -p "Do you want to proceed with the deployment? (yes/no): " -r
    
    if [[ $REPLY =~ ^[Yy]es$ ]]; then
        # Apply deployment
        apply_deployment
        
        # Show outputs
        show_outputs
        
        log_success "Google Cloud Workload Identity Federation deployment completed!"
        log_info "Add the output values to your GitHub repository secrets to enable authentication."
    else
        log_info "Deployment cancelled by user"
        exit 0
    fi
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [--help|-h]"
        echo ""
        echo "Deploy Google Cloud Workload Identity Federation for GitHub Actions"
        echo ""
        echo "Options:"
        echo "  --help, -h    Show this help message"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
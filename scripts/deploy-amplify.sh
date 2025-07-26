#!/bin/bash

# AWS Amplify Deployment Script
# This script handles the deployment of the Pixelated app to AWS Amplify

set -e  # Exit on any error

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

# Check required environment variables
check_env_vars() {
    log_info "Checking required environment variables..."
    
    if [ -z "$AMPLIFY_APP_ID" ]; then
        log_error "AMPLIFY_APP_ID environment variable is not set"
        exit 1
    fi
    
    if [ -z "$AWS_REGION" ]; then
        log_error "AWS_REGION environment variable is not set"
        exit 1
    fi
    
    log_success "Environment variables check passed"
}

# Install AWS CLI if not present
install_aws_cli() {
    if ! command -v aws &> /dev/null; then
        log_info "Installing AWS CLI..."
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
        unzip awscliv2.zip
        sudo ./aws/install
        rm -rf awscliv2.zip aws
        log_success "AWS CLI installed"
    else
        log_info "AWS CLI already installed"
    fi
}

# Verify AWS configuration
verify_aws_config() {
    log_info "Verifying AWS configuration..."
    
    if ! aws sts get-caller-identity > /dev/null 2>&1; then
        log_error "AWS credentials not configured properly"
        exit 1
    fi
    
    log_success "AWS configuration verified"
}

# Create deployment package
create_deployment_package() {
    log_info "Creating deployment package..."
    
    # Ensure build directory exists
    if [ ! -d "dist" ]; then
        log_error "Build directory 'dist' not found. Please run 'pnpm build' first."
        exit 1
    fi
    
    # Create a temporary deployment directory
    DEPLOY_DIR=$(mktemp -d)
    log_info "Using temporary directory: $DEPLOY_DIR"
    
    # Copy built files
    cp -r dist/* "$DEPLOY_DIR/"
    
    # Copy Amplify configuration
    if [ -f "amplify.yml" ]; then
        cp amplify.yml "$DEPLOY_DIR/"
    fi
    
    log_success "Deployment package created"
    echo "$DEPLOY_DIR"
}

# Deploy to Amplify
deploy_to_amplify() {
    local deploy_dir=$1
    
    log_info "Starting deployment to AWS Amplify (App ID: $AMPLIFY_APP_ID)..."
    
    # Create a deployment
    DEPLOYMENT_ID=$(aws amplify start-deployment \
        --app-id "$AMPLIFY_APP_ID" \
        --branch-name "master" \
        --source-url "s3://amplify-deployments-$(date +%s)" \
        --region "$AWS_REGION" \
        --query 'jobSummary.jobId' \
        --output text)
    
    if [ $? -eq 0 ]; then
        log_success "Deployment started with ID: $DEPLOYMENT_ID"
        
        # Monitor deployment status
        log_info "Monitoring deployment status..."
        while true; do
            STATUS=$(aws amplify get-job \
                --app-id "$AMPLIFY_APP_ID" \
                --branch-name "master" \
                --job-id "$DEPLOYMENT_ID" \
                --region "$AWS_REGION" \
                --query 'job.summary.status' \
                --output text)
            
            case $STATUS in
                "SUCCEED")
                    log_success "Deployment completed successfully!"
                    break
                    ;;
                "FAILED"|"CANCELLED")
                    log_error "Deployment failed with status: $STATUS"
                    exit 1
                    ;;
                "PENDING"|"RUNNING")
                    log_info "Deployment status: $STATUS"
                    sleep 30
                    ;;
                *)
                    log_warning "Unknown deployment status: $STATUS"
                    sleep 30
                    ;;
            esac
        done
    else
        log_error "Failed to start deployment"
        exit 1
    fi
}

# Cleanup function
cleanup() {
    if [ -n "$DEPLOY_DIR" ] && [ -d "$DEPLOY_DIR" ]; then
        log_info "Cleaning up temporary files..."
        rm -rf "$DEPLOY_DIR"
        log_success "Cleanup completed"
    fi
}

# Set up cleanup trap
trap cleanup EXIT

# Main deployment process
main() {
    log_info "Starting AWS Amplify deployment process..."
    
    check_env_vars
    install_aws_cli
    verify_aws_config
    
    DEPLOY_DIR=$(create_deployment_package)
    deploy_to_amplify "$DEPLOY_DIR"
    
    log_success "AWS Amplify deployment completed successfully!"
}

# Run main function
main "$@"

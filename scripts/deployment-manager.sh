#!/bin/bash

# Deployment Manager for Pixelated Empathy
# Manages dual Azure and Vercel deployments

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_header() {
    echo -e "${CYAN}🚀 $1${NC}"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Available commands
show_help() {
    echo "Deployment Manager for Pixelated Empathy"
    echo "========================================"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  validate          Validate deployment configurations"
    echo "  build <platform>  Build for specific platform (azure|vercel|both)"
    echo "  deploy <platform> Deploy to specific platform (azure|vercel|both)"
    echo "  status            Check deployment status"
    echo "  switch <platform> Switch default configuration"
    echo "  clean             Clean build artifacts"
    echo "  help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 validate"
    echo "  $0 build azure"
    echo "  $0 deploy vercel"
    echo "  $0 deploy both"
    echo "  $0 status"
    echo ""
}

# Validate deployment configurations
validate_config() {
    log_header "Validating Deployment Configurations"
    
    local errors=0
    
    # Check required files
    log_info "Checking required configuration files..."
    
    local required_files=(
        "astro.config.azure.mjs"
        "astro.config.vercel.mjs"
        "vercel.json"
        "Dockerfile.azure"
        "azure-pipelines.yml"
        "package.json"
    )
    
    for file in "${required_files[@]}"; do
        if [ -f "$PROJECT_ROOT/$file" ]; then
            log_success "$file found"
        else
            log_error "$file missing"
            ((errors++))
        fi
    done
    
    # Check package.json scripts
    log_info "Checking package.json scripts..."
    
    local required_scripts=(
        "build:azure"
        "build:vercel"
        "deploy:azure"
        "deploy:vercel"
    )
    
    for script in "${required_scripts[@]}"; do
        if grep -q "\"$script\":" "$PROJECT_ROOT/package.json"; then
            log_success "Script '$script' found"
        else
            log_error "Script '$script' missing"
            ((errors++))
        fi
    done
    
    # Check environment variables for Azure
    log_info "Checking Azure environment variables..."
    
    local azure_vars=(
        "AZURE_RESOURCE_GROUP"
        "AZURE_APP_SERVICE_NAME"
        "AZURE_CONTAINER_REGISTRY"
    )
    
    for var in "${azure_vars[@]}"; do
        if [ -n "${!var:-}" ]; then
            log_success "$var is set"
        else
            log_warning "$var is not set (required for Azure deployment)"
        fi
    done
    
    # Check Vercel configuration
    log_info "Checking Vercel configuration..."
    
    if command -v vercel >/dev/null 2>&1; then
        log_success "Vercel CLI is installed"
    else
        log_warning "Vercel CLI is not installed (install with: npm i -g vercel)"
    fi
    
    # Check Azure CLI
    log_info "Checking Azure CLI..."
    
    if command -v az >/dev/null 2>&1; then
        log_success "Azure CLI is installed"
        AZ_VERSION=$(az --version | head -n 1)
        log_info "Version: $AZ_VERSION"
    else
        log_warning "Azure CLI is not installed"
    fi
    
    # Summary
    echo ""
    if [ $errors -eq 0 ]; then
        log_success "All configuration validations passed!"
        return 0
    else
        log_error "$errors configuration errors found"
        return 1
    fi
}

# Build for specific platform
build_platform() {
    local platform="$1"
    
    log_header "Building for $platform"
    
    cd "$PROJECT_ROOT"
    
    case "$platform" in
        "azure")
            log_info "Building with Azure configuration..."
            pnpm run build:azure
            ;;
        "vercel")
            log_info "Building with Vercel configuration..."
            pnpm run build:vercel
            ;;
        "both")
            log_info "Building for both platforms..."
            log_info "Building Azure version..."
            pnpm run build:azure
            mv dist dist-azure
            
            log_info "Building Vercel version..."
            pnpm run build:vercel
            mv dist dist-vercel
            
            log_success "Both builds completed"
            log_info "Azure build: dist-azure/"
            log_info "Vercel build: dist-vercel/"
            ;;
        *)
            log_error "Unknown platform: $platform"
            log_info "Available platforms: azure, vercel, both"
            return 1
            ;;
    esac
    
    log_success "Build completed for $platform"
}

# Deploy to specific platform
deploy_platform() {
    local platform="$1"
    
    log_header "Deploying to $platform"
    
    cd "$PROJECT_ROOT"
    
    case "$platform" in
        "azure")
            log_info "Deploying to Azure..."
            pnpm run deploy:azure
            ;;
        "vercel")
            log_info "Deploying to Vercel..."
            pnpm run deploy:vercel
            ;;
        "both")
            log_info "Deploying to both platforms..."
            
            log_info "Deploying to Azure..."
            pnpm run deploy:azure &
            AZURE_PID=$!
            
            log_info "Deploying to Vercel..."
            pnpm run deploy:vercel &
            VERCEL_PID=$!
            
            # Wait for both deployments
            wait $AZURE_PID
            AZURE_STATUS=$?
            
            wait $VERCEL_PID
            VERCEL_STATUS=$?
            
            if [ $AZURE_STATUS -eq 0 ] && [ $VERCEL_STATUS -eq 0 ]; then
                log_success "Both deployments completed successfully"
            else
                log_error "One or more deployments failed"
                [ $AZURE_STATUS -ne 0 ] && log_error "Azure deployment failed"
                [ $VERCEL_STATUS -ne 0 ] && log_error "Vercel deployment failed"
                return 1
            fi
            ;;
        *)
            log_error "Unknown platform: $platform"
            log_info "Available platforms: azure, vercel, both"
            return 1
            ;;
    esac
    
    log_success "Deployment completed for $platform"
}

# Check deployment status
check_status() {
    log_header "Checking Deployment Status"
    
    # Check Azure status
    log_info "Checking Azure deployment status..."
    if [ -n "${AZURE_APP_SERVICE_NAME:-}" ] && [ -n "${AZURE_RESOURCE_GROUP:-}" ]; then
        if command -v az >/dev/null 2>&1; then
            AZURE_URL=$(az webapp show --name "$AZURE_APP_SERVICE_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --query "defaultHostName" --output tsv 2>/dev/null || echo "")
            if [ -n "$AZURE_URL" ]; then
                log_success "Azure: https://$AZURE_URL"
                
                # Health check
                if curl -f -s --max-time 10 "https://$AZURE_URL/api/health/simple" >/dev/null 2>&1; then
                    log_success "Azure health check: PASSED"
                else
                    log_warning "Azure health check: FAILED"
                fi
            else
                log_warning "Azure: Unable to get URL"
            fi
        else
            log_warning "Azure CLI not available"
        fi
    else
        log_warning "Azure configuration not set"
    fi
    
    # Check Vercel status
    log_info "Checking Vercel deployment status..."
    if command -v vercel >/dev/null 2>&1; then
        if [ -f ".vercel/project.json" ]; then
            VERCEL_URL=$(vercel ls --token="${VERCEL_TOKEN:-}" 2>/dev/null | grep -E "https://.*\.vercel\.app" | head -1 || echo "")
            if [ -n "$VERCEL_URL" ]; then
                log_success "Vercel: $VERCEL_URL"
                
                # Health check
                if curl -f -s --max-time 10 "$VERCEL_URL/api/health/simple" >/dev/null 2>&1; then
                    log_success "Vercel health check: PASSED"
                else
                    log_warning "Vercel health check: FAILED"
                fi
            else
                log_warning "Vercel: Unable to get URL"
            fi
        else
            log_warning "Vercel project not configured"
        fi
    else
        log_warning "Vercel CLI not available"
    fi
}

# Switch default configuration
switch_config() {
    local platform="$1"
    
    log_header "Switching to $platform configuration"
    
    cd "$PROJECT_ROOT"
    
    case "$platform" in
        "azure")
            if [ -f "astro.config.azure.mjs" ]; then
                cp "astro.config.azure.mjs" "astro.config.mjs"
                log_success "Switched to Azure configuration"
            else
                log_error "Azure configuration not found"
                return 1
            fi
            ;;
        "vercel")
            if [ -f "astro.config.vercel.mjs" ]; then
                cp "astro.config.vercel.mjs" "astro.config.mjs"
                log_success "Switched to Vercel configuration"
            else
                log_error "Vercel configuration not found"
                return 1
            fi
            ;;
        *)
            log_error "Unknown platform: $platform"
            log_info "Available platforms: azure, vercel"
            return 1
            ;;
    esac
}

# Clean build artifacts
clean_artifacts() {
    log_header "Cleaning Build Artifacts"
    
    cd "$PROJECT_ROOT"
    
    local dirs_to_clean=(
        "dist"
        "dist-azure"
        "dist-vercel"
        ".astro"
        ".vercel"
    )
    
    for dir in "${dirs_to_clean[@]}"; do
        if [ -d "$dir" ]; then
            rm -rf "$dir"
            log_success "Cleaned $dir"
        fi
    done
    
    log_success "All build artifacts cleaned"
}

# Main command handler
main() {
    if [ $# -eq 0 ]; then
        show_help
        exit 1
    fi
    
    local command="$1"
    shift
    
    case "$command" in
        "validate")
            validate_config
            ;;
        "build")
            if [ $# -eq 0 ]; then
                log_error "Platform required for build command"
                log_info "Usage: $0 build <azure|vercel|both>"
                exit 1
            fi
            build_platform "$1"
            ;;
        "deploy")
            if [ $# -eq 0 ]; then
                log_error "Platform required for deploy command"
                log_info "Usage: $0 deploy <azure|vercel|both>"
                exit 1
            fi
            deploy_platform "$1"
            ;;
        "status")
            check_status
            ;;
        "switch")
            if [ $# -eq 0 ]; then
                log_error "Platform required for switch command"
                log_info "Usage: $0 switch <azure|vercel>"
                exit 1
            fi
            switch_config "$1"
            ;;
        "clean")
            clean_artifacts
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"

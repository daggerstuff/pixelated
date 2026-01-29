#!/bin/bash

# Pixelated Deployment Script
# Automated deployment with health checks and rollback capabilities

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEPLOY_LOG="${PROJECT_ROOT}/logs/deploy-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="${1:-staging}"
BRANCH="${2:-main}"
HEALTH_CHECK_TIMEOUT=300
ROLLBACK_ON_FAILURE=true

# Functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "${DEPLOY_LOG}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "${DEPLOY_LOG}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "${DEPLOY_LOG}"
}

error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "${DEPLOY_LOG}"
    exit 1
}

check_dependencies() {
    log "Checking deployment dependencies..."

    # Check required tools
    local required_tools=("docker" "git" "curl" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "${tool}" &> /dev/null; then
            error "Required tool not found: ${tool}"
        fi
    done

    # Check if we're in git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        error "Not in a git repository"
    fi

    success "Dependencies check completed"
}

pre_deployment_checks() {
    log "Running pre-deployment checks for ${ENVIRONMENT}..."

    # Check if branch exists
    if ! git show-ref --verify --quiet "refs/remotes/origin/${BRANCH}"; then
        error "Branch ${BRANCH} does not exist"
    fi

    # Check if we're up to date
    git fetch origin
    if ! git diff --quiet "origin/${BRANCH}"; then
        warning "Local branch is not up to date with remote"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "Deployment cancelled"
        fi
    fi

    # Check environment configuration
    if [[ ! -f ".env.${ENVIRONMENT}" ]]; then
        error "Environment file not found: .env.${ENVIRONMENT}"
    fi

    # Validate configuration
    if ! "${SCRIPT_DIR}/validate-config.sh" "${ENVIRONMENT}"; then
        error "Configuration validation failed"
    fi

    success "Pre-deployment checks completed"
}

build_application() {
    log "Building application for ${ENVIRONMENT}..."

    # Clean previous builds
    rm -rf dist/
    rm -rf .astro/

    # Build with environment-specific configuration
    NODE_ENV=production pnpm build

    success "Application build completed"
}

deploy_services() {
    log "Deploying services to ${ENVIRONMENT}..."

    # Stop existing services
    docker-compose down

    # Backup current deployment (if exists)
    if [[ -d "deployment-backup" ]]; then
        mv deployment-backup "deployment-backup-$(date +%Y%m%d-%H%M%S)"
    fi

    # Create deployment backup
    cp -r . "deployment-backup/"

    # Start services with health checks
    docker-compose up -d

    # Wait for services to be ready
    log "Waiting for services to start..."
    sleep 30

    success "Services deployment initiated"
}

run_health_checks() {
    log "Running health checks..."

    local health_check_url
    case "${ENVIRONMENT}" in
        "staging")
            health_check_url="${STAGING_URL:-http://localhost:4321}"
            ;;
        "production")
            health_check_url="${PRODUCTION_URL:-https://pixelatedempathy.com}"
            ;;
        *)
            health_check_url="http://localhost:4321"
            ;;
    esac

    # Comprehensive health check
    local start_time=$(date +%s)
    local timeout=$((start_time + HEALTH_CHECK_TIMEOUT))

    while [[ $(date +%s) -lt timeout ]]; do
        if curl -f -s "${health_check_url}/api/health" > /dev/null 2>&1; then
            success "Health check passed"

            # Run detailed health verification
            if "${SCRIPT_DIR}/verify-deployment.sh" "${health_check_url}"; then
                success "Deployment verification completed"
                return 0
            fi
        fi

        log "Health check failed, retrying in 10 seconds..."
        sleep 10
    done

    error "Health checks failed after ${HEALTH_CHECK_TIMEOUT} seconds"
}

run_smoke_tests() {
    log "Running smoke tests..."

    if ! pnpm test:smoke; then
        error "Smoke tests failed"
    fi

    success "Smoke tests passed"
}

post_deployment_tasks() {
    log "Running post-deployment tasks..."

    # Update deployment tracking
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Deployed to ${ENVIRONMENT} from ${BRANCH}" >> "${PROJECT_ROOT}/deployment-history.log"

    # Clean up old backups (keep last 5)
    if [[ -d "deployment-backup" ]]; then
        find . -name "deployment-backup-*" -type d | sort -r | tail -n +6 | xargs -r rm -rf
    fi

    # Generate deployment report
    "${SCRIPT_DIR}/generate-deploy-report.sh" "${ENVIRONMENT}" >> "${DEPLOY_LOG}"

    success "Post-deployment tasks completed"
}

rollback() {
    log "Rolling back deployment..."

    if [[ -d "deployment-backup" ]]; then
        # Stop current services
        docker-compose down

        # Restore from backup
        cp -r deployment-backup/* .

        # Restart services
        docker-compose up -d

        success "Rollback completed"
    else
        error "No deployment backup found for rollback"
    fi
}

cleanup() {
    log "Cleaning up deployment artifacts..."

    # Remove temporary files
    rm -rf .astro/
    rm -rf node_modules/.cache/

    success "Cleanup completed"
}

# Main deployment flow
main() {
    log "🚀 Starting deployment to ${ENVIRONMENT} from branch ${BRANCH}"

    # Trap for cleanup on error
    trap cleanup EXIT

    check_dependencies
    pre_deployment_checks
    build_application
    deploy_services

    # Health checks with timeout
    if ! timeout "${HEALTH_CHECK_TIMEOUT}s" bash -c "$(declare -f run_health_checks); run_health_checks"; then
        if [[ "${ROLLBACK_ON_FAILURE}" == "true" ]]; then
            error "Deployment failed, initiating rollback..."
            rollback
        else
            error "Deployment failed"
        fi
    fi

    run_smoke_tests
    post_deployment_tasks
    cleanup

    log "🎉 Deployment to ${ENVIRONMENT} completed successfully!"
    log "📊 Deployment log: ${DEPLOY_LOG}"
}

# Handle command line arguments
case "${1:-}" in
    "staging")
        ENVIRONMENT="staging"
        BRANCH="${2:-main}"
        ;;
    "production")
        ENVIRONMENT="production"
        BRANCH="${2:-main}"
        # Extra validation for production
        warning "Deploying to PRODUCTION - ensure all tests pass"
        read -p "Continue with production deployment? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "Production deployment cancelled"
        fi
        ;;
    "rollback")
        rollback
        exit 0
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [staging|production] [branch]"
        echo "       $0 rollback"
        echo "       $0 help"
        exit 0
        ;;
    *)
        if [[ -n "${1:-}" ]]; then
            error "Unknown environment: $1"
        fi
        ;;
esac

# Run deployment
main "$@"
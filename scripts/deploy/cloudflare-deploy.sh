#!/bin/bash
# Cloudflare Deployment Script for Pixelated Empathy

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v wrangler &> /dev/null; then
        log_warn "wrangler CLI not found globally, using local version"
    fi
}

check_auth() {
    log_info "Checking Cloudflare authentication..."
    
    if [ -z "$CLOUDFLARE_API_TOKEN" ] && [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
        log_warn "CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID not set"
        log_info "Run: wrangler login"
        pnpm wrangler login
    fi
}

build_project() {
    log_info "Building project..."
    cd "$PROJECT_ROOT"
    
    # Run type checking
    log_info "Running type check..."
    pnpm typecheck || log_warn "Type check had warnings"
    
    # Build the project
    log_info "Building Astro project..."
    pnpm build
    
    if [ ! -d "dist" ]; then
        log_error "Build failed - dist directory not found"
        exit 1
    fi
    
    log_info "Build completed successfully"
}

setup_secrets() {
    local ENV=$1
    log_info "Setting up secrets for environment: $ENV"
    
    # Read .env file and set secrets
    if [ -f "$PROJECT_ROOT/.env" ]; then
        log_info "Found .env file, setting secrets..."
        
        # List of secrets to set (add more as needed)
        SECRETS=(
            "MONGODB_URI"
            "REDIS_URL"
            "BETTER_AUTH_SECRET"
            "JWT_SECRET"
            "OPENAI_API_KEY"
            "SENTRY_DSN"
            "RESEND_API_KEY"
        )
        
        for SECRET in "${SECRETS[@]}"; do
            VALUE=$(grep "^${SECRET}=" "$PROJECT_ROOT/.env" | cut -d '=' -f2- | tr -d '"')
            if [ -n "$VALUE" ]; then
                echo "$VALUE" | pnpm wrangler secret put "$SECRET" --env "$ENV" 2>/dev/null || true
            fi
        done
        
        log_info "Secrets configured"
    else
        log_warn ".env file not found, skipping secrets setup"
    fi
}

create_kv_namespaces() {
    log_info "Creating KV namespaces..."
    
    # Create CACHE namespace
    pnpm wrangler kv:namespace create "CACHE" || log_warn "CACHE namespace may already exist"
    pnpm wrangler kv:namespace create "CACHE" --preview || log_warn "CACHE preview namespace may already exist"
    
    # Create SESSIONS namespace
    pnpm wrangler kv:namespace create "SESSIONS" || log_warn "SESSIONS namespace may already exist"
    pnpm wrangler kv:namespace create "SESSIONS" --preview || log_warn "SESSIONS preview namespace may already exist"
    
    log_info "KV namespaces created/verified"
}

create_r2_buckets() {
    log_info "Creating R2 buckets..."
    
    pnpm wrangler r2 bucket create pixelated-assets || log_warn "pixelated-assets bucket may already exist"
    pnpm wrangler r2 bucket create pixelated-assets-preview || log_warn "pixelated-assets-preview bucket may already exist"
    pnpm wrangler r2 bucket create pixelated-uploads || log_warn "pixelated-uploads bucket may already exist"
    pnpm wrangler r2 bucket create pixelated-uploads-preview || log_warn "pixelated-uploads-preview bucket may already exist"
    
    log_info "R2 buckets created/verified"
}

deploy() {
    local ENV=${1:-production}
    log_info "Deploying to environment: $ENV"
    
    cd "$PROJECT_ROOT"
    
    # Deploy using wrangler
    if [ "$ENV" = "production" ]; then
        pnpm wrangler deploy --env production
    else
        pnpm wrangler deploy --env "$ENV"
    fi
    
    log_info "Deployment completed successfully!"
}

tail_logs() {
    local ENV=${1:-production}
    log_info "Tailing logs for environment: $ENV"
    
    pnpm wrangler tail --env "$ENV"
}

rollback() {
    local ENV=${1:-production}
    log_info "Rolling back deployment for environment: $ENV"
    
    pnpm wrangler rollback --env "$ENV"
}

show_help() {
    cat << EOF
Cloudflare Deployment Script for Pixelated Empathy

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    deploy [ENV]        Deploy to specified environment (default: production)
    build              Build the project only
    setup              Setup KV namespaces and R2 buckets
    secrets [ENV]      Configure secrets for environment
    logs [ENV]         Tail logs for environment
    rollback [ENV]     Rollback to previous deployment
    help               Show this help message

Environments:
    development        Development environment
    staging           Staging environment
    production        Production environment (default)

Examples:
    $0 deploy staging
    $0 build
    $0 logs production
    $0 setup
    $0 secrets staging

EOF
}

# Main script
main() {
    local COMMAND=${1:-help}
    local ENV=${2:-production}
    
    case $COMMAND in
        deploy)
            check_dependencies
            check_auth
            build_project
            deploy "$ENV"
            ;;
        build)
            check_dependencies
            build_project
            ;;
        setup)
            check_dependencies
            check_auth
            create_kv_namespaces
            create_r2_buckets
            ;;
        secrets)
            check_dependencies
            check_auth
            setup_secrets "$ENV"
            ;;
        logs)
            check_dependencies
            check_auth
            tail_logs "$ENV"
            ;;
        rollback)
            check_dependencies
            check_auth
            rollback "$ENV"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

main "$@"

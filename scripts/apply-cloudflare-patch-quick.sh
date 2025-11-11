#!/bin/bash
# Quick apply Cloudflare patch from .notes/cloudflare-patch directory
# This is a simplified version that uses the patch files in .notes/cloudflare-patch

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PATCH_DIR="$PROJECT_ROOT/.notes/cloudflare-patch"
COMMIT_MESSAGE="${1:-feat: Add Cloudflare Pages compatibility}"

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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Main execution
main() {
    log_info "🚀 Starting Cloudflare Pages Deployment Patch Application"
    log_info "Project root: $PROJECT_ROOT"
    log_info ""
    
    # Check if patch directory exists
    if [ ! -d "$PATCH_DIR" ]; then
        log_error "Patch directory not found: $PATCH_DIR"
        exit 1
    fi
    
    if [ ! -f "$PATCH_DIR/CLOUDFLARE_DEPLOYMENT_PATCH_V3.sh" ]; then
        log_error "Patch script not found: $PATCH_DIR/CLOUDFLARE_DEPLOYMENT_PATCH_V3.sh"
        exit 1
    fi
    
    # Step 1: Add Cloudflare adapter
    log_step "Step 1: Adding Cloudflare adapter..."
    cd "$PROJECT_ROOT"
    pnpm astro add cloudflare -y || {
        log_warn "Cloudflare adapter may already be installed, continuing..."
    }
    
    # Step 2: Apply patch
    log_step "Step 2: Applying Cloudflare deployment patch..."
    export PROJECT_ROOT="$PROJECT_ROOT"
    "$PATCH_DIR/CLOUDFLARE_DEPLOYMENT_PATCH_V3.sh"
    
    # Step 3: Commit changes
    log_step "Step 3: Committing changes..."
    if git diff --quiet && git diff --cached --quiet; then
        log_warn "No changes to commit"
    else
        git add .
        git commit -m "$COMMIT_MESSAGE" || {
            log_warn "Commit failed or no changes to commit"
        }
    fi
    
    log_info ""
    log_info "✅ Cloudflare patch applied successfully!"
    log_info ""
    log_info "Next steps:"
    log_info "1. Review changes: git diff HEAD~1"
    log_info "2. Test build: pnpm build"
    log_info "3. Push to remote: git push"
}

main "$@"


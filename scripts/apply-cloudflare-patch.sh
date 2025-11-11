#!/bin/bash
# Apply Cloudflare Pages Deployment Patch
# This script extracts the patch, applies it, and commits the changes

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
PATCH_FILE="${1:-../cloudflare-pages-patch-v3-complete.tar.gz}"
PATCH_DIR="cloudflare-patch"
COMMIT_MESSAGE="${2:-feat: Add Cloudflare Pages compatibility}"

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

check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v tar &> /dev/null; then
        log_error "tar is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        log_error "git is not installed. Please install it first."
        exit 1
    fi
}

check_patch_file() {
    log_info "Checking patch file..."
    
    # Try multiple possible locations
    local possible_locations=(
        "$PATCH_FILE"
        "$PROJECT_ROOT/$PATCH_FILE"
        "$PROJECT_ROOT/../$PATCH_FILE"
        "$PROJECT_ROOT/.notes/cloudflare-patch"
    )
    
    local found=0
    for location in "${possible_locations[@]}"; do
        if [ -f "$location" ] || [ -d "$location" ]; then
            PATCH_FILE="$location"
            found=1
            break
        fi
    done
    
    if [ $found -eq 0 ]; then
        log_error "Patch file or directory not found: $PATCH_FILE"
        log_info "Looking for patch in .notes/cloudflare-patch..."
        if [ -d "$PROJECT_ROOT/.notes/cloudflare-patch" ]; then
            log_info "Found patch directory: .notes/cloudflare-patch"
            PATCH_DIR="$PROJECT_ROOT/.notes/cloudflare-patch"
            return 0
        fi
        log_info "Usage: $0 [PATCH_FILE] [COMMIT_MESSAGE]"
        log_info "Example: $0 ../cloudflare-pages-patch-v3-complete.tar.gz"
        exit 1
    fi
    
    log_info "Patch file/directory found: $PATCH_FILE"
}

extract_patch() {
    log_step "Step 1: Extracting patch file..."
    cd "$PROJECT_ROOT"
    
    # If it's a directory, use it directly
    if [ -d "$PATCH_FILE" ]; then
        log_info "Using patch directory: $PATCH_FILE"
        PATCH_DIR="$PATCH_FILE"
        return 0
    fi
    
    # If it's a tar file, extract it
    if [ -f "$PATCH_FILE" ]; then
        # Remove existing patch directory if it exists
        if [ -d "$PATCH_DIR" ]; then
            log_warn "Removing existing patch directory: $PATCH_DIR"
            rm -rf "$PATCH_DIR"
        fi
        
        # Extract the patch
        log_info "Extracting $PATCH_FILE..."
        tar -xzf "$PATCH_FILE"
        
        if [ ! -d "$PATCH_DIR" ]; then
            log_error "Patch directory not found after extraction: $PATCH_DIR"
            exit 1
        fi
        
        log_info "Patch extracted successfully"
    fi
}

add_cloudflare_adapter() {
    log_step "Step 2: Adding Cloudflare adapter..."
    cd "$PROJECT_ROOT"
    
    log_info "Running: pnpm astro add cloudflare -y"
    pnpm astro add cloudflare -y || {
        log_warn "Cloudflare adapter may already be installed or installation had warnings, continuing..."
    }
    
    log_info "Cloudflare adapter installation completed"
}

apply_patch() {
    log_step "Step 3: Applying Cloudflare deployment patch..."
    cd "$PROJECT_ROOT"
    
    if [ ! -f "$PATCH_DIR/CLOUDFLARE_DEPLOYMENT_PATCH_V3.sh" ]; then
        log_error "Patch script not found: $PATCH_DIR/CLOUDFLARE_DEPLOYMENT_PATCH_V3.sh"
        exit 1
    fi
    
    # Make patch script executable
    chmod +x "$PATCH_DIR/CLOUDFLARE_DEPLOYMENT_PATCH_V3.sh"
    
    # Run the patch script from project root
    log_info "Running patch script..."
    "$PATCH_DIR/CLOUDFLARE_DEPLOYMENT_PATCH_V3.sh"
    
    log_info "Patch applied successfully"
}

commit_changes() {
    log_step "Step 4: Committing changes..."
    cd "$PROJECT_ROOT"
    
    # Check if there are changes to commit
    if git diff --quiet && git diff --cached --quiet; then
        log_warn "No changes to commit"
        return 0
    fi
    
    # Add all changes
    log_info "Staging changes..."
    git add .
    
    # Commit the changes
    log_info "Committing with message: $COMMIT_MESSAGE"
    git commit -m "$COMMIT_MESSAGE" || {
        log_warn "Commit failed or no changes to commit"
        return 0
    }
    
    log_info "Changes committed successfully"
}

cleanup() {
    log_step "Step 5: Cleaning up..."
    cd "$PROJECT_ROOT"
    
    # Optionally remove patch directory after successful application
    # Uncomment the following lines if you want to clean up extracted tar
    # if [ -d "$PATCH_DIR" ] && [ -f "$PATCH_FILE" ]; then
    #     log_info "Removing patch directory: $PATCH_DIR"
    #     rm -rf "$PATCH_DIR"
    # fi
    
    log_info "Cleanup completed"
}

show_summary() {
    log_info "=========================================="
    log_info "Cloudflare Patch Application Summary"
    log_info "=========================================="
    log_info "Patch source: $PATCH_FILE"
    log_info "Commit message: $COMMIT_MESSAGE"
    log_info "Status: Completed successfully"
    log_info "=========================================="
    log_info ""
    log_info "Next steps:"
    log_info "1. Review the changes: git diff HEAD~1"
    log_info "2. Test the build: pnpm build"
    log_info "3. Push to remote: git push"
    log_info ""
}

# Main execution
main() {
    log_info "🚀 Starting Cloudflare Pages Deployment Patch Application"
    log_info "Project root: $PROJECT_ROOT"
    log_info ""
    
    check_dependencies
    check_patch_file
    extract_patch
    add_cloudflare_adapter
    apply_patch
    commit_changes
    cleanup
    show_summary
    
    log_info "✅ Cloudflare patch applied successfully!"
}

# Run main function
main "$@"

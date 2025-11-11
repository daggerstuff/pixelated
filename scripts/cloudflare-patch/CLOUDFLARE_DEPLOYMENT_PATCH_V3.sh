#!/bin/bash
# Cloudflare Pages Deployment Patch v3.0
# This script applies necessary changes for Cloudflare Pages deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

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

# Check if Cloudflare adapter is configured in astro.config.mjs
check_cloudflare_adapter() {
    local config_file="$PROJECT_ROOT/astro.config.mjs"
    
    if [ ! -f "$config_file" ]; then
        return 1
    fi
    
    # Check for Cloudflare adapter import and usage
    if grep -q "@astrojs/cloudflare" "$config_file" && grep -q "cloudflare()" "$config_file"; then
        return 0
    fi
    
    return 1
}

# Create functions/_middleware.js for Cloudflare Pages
create_middleware() {
    log_step "Creating functions/_middleware.js..."
    
    local functions_dir="$PROJECT_ROOT/functions"
    local middleware_file="$functions_dir/_middleware.js"
    
    # Create functions directory if it doesn't exist
    mkdir -p "$functions_dir"
    
    # Create middleware file if it doesn't exist
    if [ ! -f "$middleware_file" ]; then
        cat > "$middleware_file" << 'EOF'
// Cloudflare Pages Middleware
// This middleware runs on every request to your Cloudflare Pages site

export async function onRequest(context) {
  const { request, next } = context;
  
  // Add security headers
  const response = await next();
  
  // Clone response to modify headers
  const newResponse = new Response(response.body, response);
  
  // Add security headers
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  newResponse.headers.set('X-Frame-Options', 'DENY');
  newResponse.headers.set('X-XSS-Protection', '1; mode=block');
  newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Add CORS headers if needed
  const origin = request.headers.get('Origin');
  if (origin && origin.includes('pixelatedempathy.com')) {
    newResponse.headers.set('Access-Control-Allow-Origin', origin);
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  
  return newResponse;
}
EOF
        log_info "Created functions/_middleware.js"
    else
        log_info "functions/_middleware.js already exists"
    fi
}

# Update astro.config.mjs to use Cloudflare adapter
update_astro_config() {
    log_step "Updating astro.config.mjs..."
    
    local config_file="$PROJECT_ROOT/astro.config.mjs"
    
    if [ ! -f "$config_file" ]; then
        log_error "astro.config.mjs not found"
        return 1
    fi
    
    # Check if Cloudflare adapter is already configured
    if check_cloudflare_adapter; then
        log_info "Cloudflare adapter is already configured in astro.config.mjs"
        return 0
    fi
    
    # Backup the config file
    cp "$config_file" "$config_file.backup"
    
    # Check if we need to replace Node adapter with Cloudflare adapter
    if grep -q "@astrojs/node" "$config_file" && grep -q "node()" "$config_file"; then
        log_info "Replacing Node adapter with Cloudflare adapter..."
        
        # Replace Node adapter import with Cloudflare adapter
        sed -i.bak "s/import node from '@astrojs\/node';/import cloudflare from '@astrojs\/cloudflare';/" "$config_file"
        
        # Replace adapter configuration
        sed -i.bak "s/adapter: node({/adapter: cloudflare({/" "$config_file"
        sed -i.bak "s/mode: 'standalone',//" "$config_file"
        
        # Remove backup file
        rm -f "$config_file.bak"
        
        log_info "Updated astro.config.mjs to use Cloudflare adapter"
    else
        log_warn "No Node adapter found to replace. Please configure Cloudflare adapter manually."
        log_info "Add the following to astro.config.mjs:"
        log_info "  import cloudflare from '@astrojs/cloudflare';"
        log_info "  adapter: cloudflare(),"
    fi
}

# Check and update src/middleware.ts if needed
check_middleware_ts() {
    log_step "Checking src/middleware.ts..."
    
    local middleware_file="$PROJECT_ROOT/src/middleware.ts"
    
    if [ ! -f "$middleware_file" ]; then
        log_warn "src/middleware.ts not found (this is okay for Cloudflare Pages)"
        return 0
    fi
    
    log_info "src/middleware.ts found - Astro middleware will be used"
    log_info "Cloudflare Pages will use functions/_middleware.js for edge middleware"
}

# Add prerender exports to static pages
add_prerender_exports() {
    log_step "Adding prerender exports to static pages..."
    
    local pages_dir="$PROJECT_ROOT/src/pages"
    local count=0
    
    if [ ! -d "$pages_dir" ]; then
        log_warn "src/pages directory not found"
        return 0
    fi
    
    # Find all .astro files in pages directory that don't have prerender export
    while IFS= read -r -d '' file; do
        # Skip if file already has prerender export
        if grep -q "export const prerender" "$file"; then
            continue
        fi
        
        # Skip if file has dynamic routes (has [param] or [...rest] in path)
        if echo "$file" | grep -qE '\[.*\]'; then
            continue
        fi
        
        # Add prerender export at the top of the frontmatter
        # This is a simple approach - you may need to adjust based on your file structure
        if head -n 1 "$file" | grep -q "---"; then
            # File has frontmatter, add export after first ---
            sed -i.bak '1a\
export const prerender = true;
' "$file"
            rm -f "$file.bak"
            count=$((count + 1))
        fi
    done < <(find "$pages_dir" -name "*.astro" -type f -print0)
    
    if [ $count -gt 0 ]; then
        log_info "Added prerender exports to $count static pages"
    else
        log_info "No static pages needed prerender exports (or they already have them)"
    fi
}

# Create CLOUDFLARE_DEPLOYMENT.md documentation
create_documentation() {
    log_step "Creating CLOUDFLARE_DEPLOYMENT.md..."
    
    local doc_file="$PROJECT_ROOT/CLOUDFLARE_DEPLOYMENT.md"
    
    if [ -f "$doc_file" ]; then
        log_info "CLOUDFLARE_DEPLOYMENT.md already exists"
        return 0
    fi
    
    cat > "$doc_file" << 'EOF'
# Cloudflare Pages Deployment Guide

This document describes the Cloudflare Pages deployment configuration for Pixelated Empathy.

## Overview

This project is configured to deploy to Cloudflare Pages using the Astro Cloudflare adapter.

## Configuration

### Adapter

The project uses `@astrojs/cloudflare` adapter configured in `astro.config.mjs`:

```javascript
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  adapter: cloudflare(),
  // ... other config
});
```

### Middleware

Cloudflare Pages uses `functions/_middleware.js` for edge middleware. This middleware:
- Adds security headers
- Handles CORS
- Processes requests before they reach your Astro application

### Static Pages

Static pages should export `prerender = true` to enable static generation:

```astro
---
export const prerender = true;
---
```

### Dynamic Routes

Dynamic routes (SSR) will be handled by Cloudflare Workers automatically.

## Deployment

### Prerequisites

1. Cloudflare account
2. Wrangler CLI installed: `pnpm add -D wrangler`
3. Cloudflare API token with appropriate permissions

### Deployment Steps

1. Build the project:
   ```bash
   pnpm build
   ```

2. Deploy using Wrangler:
   ```bash
   pnpm wrangler pages deploy dist
   ```

3. Or use Cloudflare Dashboard:
   - Connect your GitHub repository
   - Set build command: `pnpm build`
   - Set output directory: `dist`

## Environment Variables

Set environment variables in Cloudflare Pages dashboard or via Wrangler:

```bash
pnpm wrangler pages secret put VARIABLE_NAME
```

## Troubleshooting

### Build Failures

- Ensure all dependencies are installed: `pnpm install`
- Check Node.js version compatibility (requires Node.js 18+)
- Verify Astro configuration is correct

### Runtime Errors

- Check Cloudflare Workers logs in the dashboard
- Verify environment variables are set correctly
- Ensure middleware is configured properly

## Resources

- [Astro Cloudflare Adapter Documentation](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
EOF
    log_info "Created CLOUDFLARE_DEPLOYMENT.md"
}

# Main execution
main() {
    log_info "🚀 Applying Cloudflare Pages Deployment Patch v3.0..."
    log_info ""
    
    create_middleware
    update_astro_config
    check_middleware_ts
    add_prerender_exports
    create_documentation
    
    log_info ""
    log_info "✅ Cloudflare Pages Deployment Patch v3.0 applied successfully!"
    log_info ""
    log_info "Next steps:"
    log_info "1. Review the changes in astro.config.mjs"
    log_info "2. Test the build: pnpm build"
    log_info "3. Deploy to Cloudflare Pages"
}

# Run main function
main "$@"


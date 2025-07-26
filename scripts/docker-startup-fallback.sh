#!/bin/bash

# Docker Startup Fallback Script
# Handles "astro: not found" issues in Azure App Service containers

set -e

echo "🔧 Docker Startup Fallback - Handling binary availability..."

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to ensure PATH includes common binary locations
setup_path() {
    echo "📋 Setting up PATH for container environment..."
    
    # Add common binary paths
    export PATH="/opt/bitnami/node/bin:/app/node_modules/.bin:/usr/local/bin:$PATH"
    
    echo "Updated PATH: $PATH"
}

# Function to create emergency astro wrapper if needed
create_astro_fallback() {
    if ! command_exists astro; then
        echo "⚠️ astro command not found, creating fallback wrapper..."
        
        # Try to find the astro binary/script in various locations
        ASTRO_CANDIDATES=(
            "/app/node_modules/.bin/astro"
            "/app/node_modules/astro/astro.js"
            "/opt/bitnami/node/bin/astro"
        )
        
        FOUND_ASTRO=""
        for candidate in "${ASTRO_CANDIDATES[@]}"; do
            if [ -f "$candidate" ]; then
                FOUND_ASTRO="$candidate"
                echo "✅ Found astro at: $candidate"
                break
            fi
        done
        
        if [ -n "$FOUND_ASTRO" ]; then
            # Create a temporary astro wrapper in a PATH location
            WRAPPER_PATH="/usr/local/bin/astro"
            echo "🔧 Creating astro wrapper at: $WRAPPER_PATH"
            
            cat > "$WRAPPER_PATH" << EOF
#!/bin/bash
# Emergency astro wrapper for Docker container
if [[ "$FOUND_ASTRO" == *.js ]]; then
    exec node "$FOUND_ASTRO" "\$@"
else
    exec "$FOUND_ASTRO" "\$@"
fi
EOF
            chmod +x "$WRAPPER_PATH"
            echo "✅ astro wrapper created successfully"
        else
            echo "❌ Could not find astro binary in any expected location"
            echo "Available files in /app/node_modules/.bin/:"
            ls -la /app/node_modules/.bin/ | head -10 || echo "Directory not accessible"
            return 1
        fi
    else
        echo "✅ astro command already available at: $(which astro)"
    fi
}

# Function to verify critical files exist
verify_build_artifacts() {
    echo "📁 Verifying build artifacts..."
    
    CRITICAL_FILES=(
        "/app/dist/server/entry.mjs"
        "/app/scripts/start-server.js"
        "/app/package.json"
    )
    
    local missing_files=()
    for file in "${CRITICAL_FILES[@]}"; do
        if [ -f "$file" ]; then
            echo "✅ $file exists"
        else
            echo "❌ $file missing"
            missing_files+=("$file")
        fi
    done
    
    if [ ${#missing_files[@]} -gt 0 ]; then
        echo "❌ Critical files are missing. Build may have failed."
        echo "Missing files: ${missing_files[*]}"
        return 1
    fi
}

# Main startup sequence
main() {
    echo "🚀 Starting Docker Startup Fallback sequence..."
    
    # 1. Setup PATH
    setup_path
    
    # 2. Create astro fallback if needed
    create_astro_fallback || {
        echo "❌ Failed to setup astro fallback"
        # Continue anyway - the app might not need astro command directly
    }
    
    # 3. Verify build artifacts
    verify_build_artifacts || {
        echo "❌ Build artifact verification failed"
        exit 1
    }
    
    # 4. Verify pnpm is available
    if command_exists pnpm; then
        echo "✅ pnpm available at: $(which pnpm)"
    else
        echo "❌ pnpm not found, this will likely cause startup failure"
        exit 1
    fi
    
    # 5. Show final environment status
    echo "📋 Final environment status:"
    echo "  - Node version: $(node --version)"
    echo "  - pnpm version: $(pnpm --version)"
    echo "  - astro available: $(command_exists astro && echo "✅ YES" || echo "❌ NO")"
    echo "  - Working directory: $(pwd)"
    echo "  - User: $(whoami)"
    
    # 6. Start the application
    echo "🚀 Starting application with: node scripts/start-server.js"
    exec node scripts/start-server.js
}

# Run main function
main "$@" 
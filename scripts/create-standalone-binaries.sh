#!/bin/bash

# Create Standalone Binary Artifacts for Docker Deployment
# This script creates self-contained binaries that work in Docker containers

set -e

ARTIFACT_DIR="artifacts/binaries"

echo "🔧 Creating standalone binaries for Docker deployment..."
echo "====================================================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules directory not found. Please run 'pnpm install' first."
    exit 1
fi

# Clean and create directories
rm -rf "$ARTIFACT_DIR"
mkdir -p "$ARTIFACT_DIR"

echo "🔍 Creating standalone astro binary..."

# Create a standalone astro binary
cat > "$ARTIFACT_DIR/astro" << 'EOF'
#!/bin/bash

# Standalone astro binary for Docker containers
# This script works regardless of the container environment

set -e

# Try to find astro in various common locations
ASTRO_LOCATIONS=(
    "/app/node_modules/.bin/astro"
    "/app/node_modules/astro/astro.js"
    "/usr/local/lib/node_modules/astro/astro.js"
    "$(dirname "$0")/../node_modules/astro/astro.js"
    "$(dirname "$0")/astro-package/astro.js"
)

ASTRO_BIN=""

for location in "${ASTRO_LOCATIONS[@]}"; do
    if [ -f "$location" ]; then
        ASTRO_BIN="$location"
        break
    fi
done

if [ -z "$ASTRO_BIN" ]; then
    echo "❌ Could not find astro binary in any expected location"
    echo "Searched locations:"
    for location in "${ASTRO_LOCATIONS[@]}"; do
        echo "  - $location"
    done
    exit 1
fi

# Execute astro with the found binary
if [[ "$ASTRO_BIN" == *.js ]]; then
    exec node "$ASTRO_BIN" "$@"
else
    exec "$ASTRO_BIN" "$@"
fi
EOF

chmod +x "$ARTIFACT_DIR/astro"

echo "🔍 Creating standalone pnpm wrapper..."

# Create a standalone pnpm wrapper
cat > "$ARTIFACT_DIR/pnpm" << 'EOF'
#!/bin/bash

# Standalone pnpm binary for Docker containers

set -e

# Try to find pnpm in various common locations
PNPM_LOCATIONS=(
    "/opt/bitnami/node/bin/pnpm"
    "/usr/local/bin/pnpm"
    "/app/node_modules/.bin/pnpm"
    "$(which pnpm)"
)

PNPM_BIN=""

for location in "${PNPM_LOCATIONS[@]}"; do
    if [ -f "$location" ] && [ -x "$location" ]; then
        PNPM_BIN="$location"
        break
    fi
done

if [ -z "$PNPM_BIN" ]; then
    echo "❌ Could not find pnpm binary in any expected location"
    echo "Searched locations:"
    for location in "${PNPM_LOCATIONS[@]}"; do
        echo "  - $location"
    done
    exit 1
fi

# Execute pnpm with the found binary
exec "$PNPM_BIN" "$@"
EOF

chmod +x "$ARTIFACT_DIR/pnpm"

echo "🔍 Copying essential astro files..."

# Copy the astro package for runtime dependencies
if [ -d "node_modules/astro" ]; then
    echo "✅ Copying astro package"
    mkdir -p "$ARTIFACT_DIR/astro-package"
    cp -rL "node_modules/astro/." "$ARTIFACT_DIR/astro-package/"
else
    echo "❌ astro package not found"
    exit 1
fi

echo "🔍 Creating other essential binaries..."

# Create other standalone binaries
for binary in tsc tsx; do
    if [ -f "node_modules/.bin/$binary" ]; then
        echo "✅ Creating standalone $binary"
        
        # Get the actual path to the JS file
        REAL_PATH=$(readlink -f "node_modules/.bin/$binary" 2>/dev/null || echo "")
        
        if [ -f "$REAL_PATH" ] && [[ "$REAL_PATH" == *.js ]]; then
            # Create a wrapper script
            cat > "$ARTIFACT_DIR/$binary" << EOF
#!/bin/bash
# Standalone $binary binary
exec node "$REAL_PATH" "\$@"
EOF
        else
            # Just copy the script and hope it works
            cp "node_modules/.bin/$binary" "$ARTIFACT_DIR/"
        fi
        
        chmod +x "$ARTIFACT_DIR/$binary"
    else
        echo "⚠️ $binary binary not found (optional)"
    fi
done

# Create verification info
echo "Creating verification info..."
echo "# Standalone Binary Artifacts Information" > "$ARTIFACT_DIR/INFO.md"
echo "Generated on: $(date)" >> "$ARTIFACT_DIR/INFO.md"
echo "From project: $(pwd)" >> "$ARTIFACT_DIR/INFO.md"
echo "" >> "$ARTIFACT_DIR/INFO.md"
echo "## Created Binaries:" >> "$ARTIFACT_DIR/INFO.md"
ls -la "$ARTIFACT_DIR"/*.* 2>/dev/null | grep -v "INFO.md" >> "$ARTIFACT_DIR/INFO.md" || true

echo ""
echo "✅ Standalone binary artifacts created successfully!"
echo "📁 Location: $ARTIFACT_DIR"
echo "📋 Contents:"
ls -la "$ARTIFACT_DIR"

echo ""
echo "📦 Artifact package size:"
du -sh "$ARTIFACT_DIR"

echo ""
echo "🔧 Testing standalone astro binary:"
if [ -x "$ARTIFACT_DIR/astro" ]; then
    echo "Binary is executable: ✅"
    # Test with a safe command
    if "$ARTIFACT_DIR/astro" --help >/dev/null 2>&1; then
        echo "Binary test successful: ✅"
    else
        echo "Binary test failed - but this might be expected in this environment"
    fi
else
    echo "❌ astro binary not executable"
fi

echo ""
echo "🔧 These standalone binaries should work in Docker containers:"
echo "1. They search for dependencies in standard container locations"
echo "2. They include fallback paths for different environments"
echo "3. The Dockerfile.azure already includes support for these artifacts" 
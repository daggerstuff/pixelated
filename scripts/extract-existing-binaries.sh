#!/bin/bash

# Extract Binary Artifacts from Existing node_modules
# This script extracts essential binaries from the current node_modules for Docker deployment

set -e

ARTIFACT_DIR="artifacts/binaries"

echo "🔧 Extracting binaries from existing node_modules..."
echo "=================================================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules directory not found. Please run 'pnpm install' first."
    exit 1
fi

# Clean and create directories
rm -rf "$ARTIFACT_DIR"
mkdir -p "$ARTIFACT_DIR"

echo "🔍 Extracting essential binaries..."

# Copy astro binary and its dependencies
if [ -f "node_modules/.bin/astro" ]; then
    echo "✅ Found astro binary"
    cp "node_modules/.bin/astro" "$ARTIFACT_DIR/"
    chmod +x "$ARTIFACT_DIR/astro"
    
    # Copy the actual astro package for runtime dependencies (resolve symlinks)
    if [ -d "node_modules/astro" ]; then
        echo "✅ Found astro package"
        mkdir -p "$ARTIFACT_DIR/astro-package"
        cp -rL "node_modules/astro/." "$ARTIFACT_DIR/astro-package/"
    fi
else
    echo "❌ astro binary not found in node_modules/.bin/"
    exit 1
fi

# Copy pnpm binary if available in node_modules
if [ -f "node_modules/.bin/pnpm" ]; then
    echo "✅ Found pnpm binary in node_modules"
    cp "node_modules/.bin/pnpm" "$ARTIFACT_DIR/"
    chmod +x "$ARTIFACT_DIR/pnpm"
else
    echo "ℹ️ pnpm binary not found in node_modules (using global version)"
fi

# Copy other essential binaries
for binary in tsc tsx; do
    if [ -f "node_modules/.bin/$binary" ]; then
        echo "✅ Found $binary binary"
        cp "node_modules/.bin/$binary" "$ARTIFACT_DIR/"
        chmod +x "$ARTIFACT_DIR/$binary"
    else
        echo "⚠️ $binary binary not found (optional)"
    fi
done

# Create verification info
echo "Creating verification info..."
echo "# Binary Artifacts Information" > "$ARTIFACT_DIR/INFO.md"
echo "Generated on: $(date)" >> "$ARTIFACT_DIR/INFO.md"
echo "From project: $(pwd)" >> "$ARTIFACT_DIR/INFO.md"
echo "" >> "$ARTIFACT_DIR/INFO.md"
echo "## Extracted Binaries:" >> "$ARTIFACT_DIR/INFO.md"
ls -la "$ARTIFACT_DIR"/*.* 2>/dev/null | grep -v "INFO.md" >> "$ARTIFACT_DIR/INFO.md" || true

echo ""
echo "✅ Binary artifacts extracted successfully!"
echo "📁 Location: $ARTIFACT_DIR"
echo "📋 Contents:"
ls -la "$ARTIFACT_DIR"

echo ""
echo "📦 Artifact package size:"
du -sh "$ARTIFACT_DIR"

echo ""
echo "🔧 Testing astro binary:"
if [ -x "$ARTIFACT_DIR/astro" ]; then
    echo "Binary is executable: ✅"
    # Don't run astro --version here as it might require full environment
    echo "To test: $ARTIFACT_DIR/astro --version"
else
    echo "❌ astro binary not executable"
fi

echo ""
echo "🔧 Next steps:"
echo "1. These artifacts are ready to be copied into Docker images"
echo "2. Add them to /usr/local/bin or another PATH location in the container"
echo "3. The Dockerfile.azure already includes support for artifact fallback" 
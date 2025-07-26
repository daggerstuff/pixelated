#!/bin/bash

# Create Binary Artifacts for Azure Docker Deployment
# This script creates a portable binary package that can be copied into Docker containers

set -e

ARTIFACT_DIR="artifacts/binaries"
TEMP_BUILD_DIR="/tmp/pixelated-binary-build"

echo "🔧 Creating binary artifacts for Azure deployment..."
echo "=================================================="

# Clean and create directories
rm -rf "$ARTIFACT_DIR" "$TEMP_BUILD_DIR"
mkdir -p "$ARTIFACT_DIR" "$TEMP_BUILD_DIR"

# Create a minimal Node.js environment for building
cd "$TEMP_BUILD_DIR"

echo "📋 Setting up temporary build environment..."
cp "$OLDPWD/package.json" .
cp "$OLDPWD/pnpm-lock.yaml" .

# Install dependencies to get binaries
echo "📦 Installing dependencies to extract binaries..."
pnpm install --frozen-lockfile

echo "🔍 Extracting essential binaries..."

# Copy astro binary and its dependencies
if [ -f "node_modules/.bin/astro" ]; then
    echo "✅ Found astro binary"
    cp "node_modules/.bin/astro" "$OLDPWD/$ARTIFACT_DIR/"
    
    # Make sure it's executable
    chmod +x "$OLDPWD/$ARTIFACT_DIR/astro"
    
    # Also copy the actual astro package for completeness
    if [ -d "node_modules/astro" ]; then
        cp -r "node_modules/astro" "$OLDPWD/$ARTIFACT_DIR/astro-package/"
    fi
else
    echo "❌ astro binary not found"
    exit 1
fi

# Copy pnpm binary if needed
if [ -f "node_modules/.bin/pnpm" ]; then
    echo "✅ Found pnpm binary"
    cp "node_modules/.bin/pnpm" "$OLDPWD/$ARTIFACT_DIR/"
    chmod +x "$OLDPWD/$ARTIFACT_DIR/pnpm"
fi

# Copy other essential binaries
for binary in tsc tsx; do
    if [ -f "node_modules/.bin/$binary" ]; then
        echo "✅ Found $binary binary"
        cp "node_modules/.bin/$binary" "$OLDPWD/$ARTIFACT_DIR/"
        chmod +x "$OLDPWD/$ARTIFACT_DIR/$binary"
    else
        echo "⚠️ $binary binary not found (optional)"
    fi
done

# Create a startup script that uses the artifact binaries
cat > "$OLDPWD/$ARTIFACT_DIR/start-with-artifacts.sh" << 'EOF'
#!/bin/bash

# Startup script that uses artifact binaries as fallback

set -e

ARTIFACT_BIN_DIR="/app/artifacts/binaries"

echo "🔧 Configuring artifact binaries as fallback..."

# Add artifact binaries to PATH
export PATH="$ARTIFACT_BIN_DIR:$PATH"

# Verify critical binaries are available
echo "🔍 Checking binary availability..."

if command -v astro >/dev/null 2>&1; then
    echo "✅ astro binary available at: $(which astro)"
else
    echo "❌ astro binary still not found after artifact setup"
    echo "Available files in artifact directory:"
    ls -la "$ARTIFACT_BIN_DIR/" || echo "Artifact directory not found"
    exit 1
fi

if command -v pnpm >/dev/null 2>&1; then
    echo "✅ pnpm binary available at: $(which pnpm)"
else
    echo "⚠️ pnpm binary not found in artifacts, using system version"
fi

echo "🚀 Starting application with artifact binaries..."
exec node scripts/start-server.js
EOF

chmod +x "$OLDPWD/$ARTIFACT_DIR/start-with-artifacts.sh"

# Create a verification script
cat > "$OLDPWD/$ARTIFACT_DIR/verify-artifacts.sh" << 'EOF'
#!/bin/bash

echo "🔍 Verifying binary artifacts..."

ARTIFACT_DIR="/app/artifacts/binaries"

for binary in astro pnpm tsc tsx; do
    if [ -f "$ARTIFACT_DIR/$binary" ]; then
        echo "✅ $binary: $(ls -la "$ARTIFACT_DIR/$binary")"
        if [ -x "$ARTIFACT_DIR/$binary" ]; then
            echo "  - Executable: ✅"
        else
            echo "  - Executable: ❌"
        fi
    else
        echo "❌ $binary: Not found"
    fi
done

echo ""
echo "📋 Total artifact size:"
du -sh "$ARTIFACT_DIR" 2>/dev/null || echo "Could not calculate size"

echo ""
echo "🔧 Testing astro binary:"
if [ -x "$ARTIFACT_DIR/astro" ]; then
    "$ARTIFACT_DIR/astro" --version || echo "astro version check failed"
else
    echo "astro binary not executable"
fi
EOF

chmod +x "$OLDPWD/$ARTIFACT_DIR/verify-artifacts.sh"

# Clean up temp directory
cd "$OLDPWD"
rm -rf "$TEMP_BUILD_DIR"

echo ""
echo "✅ Binary artifacts created successfully!"
echo "📁 Location: $ARTIFACT_DIR"
echo "📋 Contents:"
ls -la "$ARTIFACT_DIR"

echo ""
echo "📦 Artifact package size:"
du -sh "$ARTIFACT_DIR"

echo ""
echo "🔧 Next steps:"
echo "1. Add artifacts to Docker image"
echo "2. Update Dockerfile to copy artifacts to /usr/local/bin or /opt/bin"
echo "3. Use start-with-artifacts.sh as fallback startup script" 
#!/bin/bash

# Performance Improvement Quick Start Script
# This script helps you quickly address the performance issues found by Lighthouse CI

set -e

echo "🚀 Pixelated Empathy Performance Improvement Quick Start"
echo "======================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if pnpm is available
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm is required but not installed${NC}"
    exit 1
fi

echo -e "${BLUE}📊 Current Performance Issues (from Lighthouse CI):${NC}"
echo "   • First Contentful Paint: 2.5s (target: 2.0s)"
echo "   • Time to Interactive: 7.1s (target: 3.5s)"
echo "   • Largest Contentful Paint: 7.1s (target: 3.0s)"
echo "   • Image Size: 1.16MB (target: 600KB)"
echo ""

# Step 1: Check and install dependencies
echo -e "${YELLOW}Step 1: Installing optimization dependencies...${NC}"
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found. Run this from the project root.${NC}"
    exit 1
fi

# Check if sharp is installed
if ! pnpm list sharp &> /dev/null; then
    echo "📦 Installing sharp for image optimization..."
    pnpm add -D sharp
else
    echo "✅ Sharp already installed"
fi

# Check if lighthouse is available
if ! command -v lighthouse &> /dev/null; then
    echo "📦 Installing lighthouse CLI globally..."
    pnpm add -g lighthouse
else
    echo "✅ Lighthouse CLI available"
fi

echo ""

# Step 2: Analyze current images
echo -e "${YELLOW}Step 2: Analyzing current images...${NC}"
if [ -d "public" ]; then
    echo "🔍 Scanning for images in public directory..."
    
    # Count and size of images
    IMAGE_COUNT=$(find public -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.gif" -o -name "*.webp" \) | wc -l)
    
    if [ $IMAGE_COUNT -eq 0 ]; then
        echo "ℹ️ No images found in public directory"
    else
        echo "📊 Found $IMAGE_COUNT images"
        
        # Show largest images
        echo "🔥 Largest images (top 5):"
        find public -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.gif" \) -exec ls -lh {} + | sort -k5 -hr | head -5 | awk '{print "   " $9 " (" $5 ")"}'
        
        # Calculate total size
        TOTAL_SIZE=$(find public -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.gif" \) -exec stat -c%s {} + | awk '{sum+=$1} END {printf "%.1f", sum/1024/1024}')
        echo "📏 Total image size: ${TOTAL_SIZE}MB"
    fi
else
    echo "⚠️ Public directory not found"
fi

echo ""

# Step 3: Optimize images
echo -e "${YELLOW}Step 3: Image Optimization${NC}"
echo "🖼️ Starting image optimization..."

if [ -f "scripts/optimize-images.mjs" ]; then
    echo "🔧 Running image optimization script..."
    node scripts/optimize-images.mjs
    
    echo ""
    echo -e "${GREEN}✅ Image optimization complete!${NC}"
    echo "📁 Optimized images are in: public/optimized/"
    echo "📝 Example Astro components: public/optimized/astro-components-example.astro"
else
    echo -e "${RED}❌ Image optimization script not found${NC}"
    echo "Please ensure scripts/optimize-images.mjs exists"
fi

echo ""

# Step 4: Bundle analysis
echo -e "${YELLOW}Step 4: JavaScript Bundle Analysis${NC}"
echo "📦 Analyzing JavaScript bundles..."

# Build the project
echo "🔨 Building project for analysis..."
pnpm build

# Check if dist directory exists
if [ -d "dist" ]; then
    echo "📊 Analyzing bundle size..."
    
    # Show bundle sizes
    echo "📋 Main bundle files:"
    find dist -name "*.js" -type f -exec ls -lh {} + | sort -k5 -hr | head -10 | awk '{print "   " $9 " (" $5 ")"}'
    
    # Total bundle size
    TOTAL_JS_SIZE=$(find dist -name "*.js" -type f -exec stat -c%s {} + | awk '{sum+=$1} END {printf "%.1f", sum/1024/1024}')
    echo "📏 Total JavaScript size: ${TOTAL_JS_SIZE}MB"
    
    # Check for large chunks
    echo ""
    echo "🔍 Looking for optimization opportunities..."
    
    LARGE_FILES=$(find dist -name "*.js" -type f -size +500k)
    if [ ! -z "$LARGE_FILES" ]; then
        echo -e "${RED}⚠️ Large JavaScript files found (>500KB):${NC}"
        echo "$LARGE_FILES" | while read file; do
            size=$(ls -lh "$file" | awk '{print $5}')
            echo "   $file ($size)"
        done
        echo ""
        echo "💡 Consider code splitting or removing unused dependencies"
    else
        echo -e "${GREEN}✅ No excessively large JavaScript files found${NC}"
    fi
else
    echo -e "${RED}❌ Build failed or dist directory not found${NC}"
fi

echo ""

# Step 5: Performance recommendations
echo -e "${YELLOW}Step 5: Performance Recommendations${NC}"
echo ""
echo -e "${BLUE}🎯 Immediate Actions (High Impact):${NC}"
echo "1. 🖼️ Replace large images with optimized WebP versions"
echo "2. 📱 Implement responsive images with multiple sizes"
echo "3. 🚀 Add lazy loading to below-the-fold images"
echo "4. 📦 Remove unused JavaScript dependencies"
echo ""

echo -e "${BLUE}🔧 Technical Improvements:${NC}"
echo "1. Preload critical resources (fonts, CSS)"
echo "2. Implement code splitting for routes"
echo "3. Use dynamic imports for heavy components"
echo "4. Enable compression (gzip/brotli) on server"
echo ""

echo -e "${BLUE}📝 Updated Astro Configuration:${NC}"
echo "Add to astro.config.mjs:"
echo ""
cat << 'EOF'
export default defineConfig({
  image: {
    service: sharpImageService(),
    domains: ['your-domain.com'],
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            ui: ['@/components/ui'],
          }
        }
      }
    }
  }
})
EOF

echo ""

# Step 6: Test performance
echo -e "${YELLOW}Step 6: Testing Performance${NC}"
echo "🧪 To test your improvements:"
echo ""
echo "1. Run Lighthouse locally:"
echo "   pnpm run performance:lighthouse http://localhost:4321"
echo ""
echo "2. Run the monitoring workflow:"
echo "   • Go to GitHub Actions"
echo "   • Run the 'Monitoring' workflow manually"
echo "   • Check the Lighthouse report"
echo ""
echo "3. Monitor in production:"
echo "   • The monitoring workflow runs every 15 minutes"
echo "   • Check for Slack notifications (if configured)"
echo ""

# Step 7: Next steps
echo -e "${GREEN}🎉 Performance optimization setup complete!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Update your components to use optimized images"
echo "2. Implement the responsive image components"
echo "3. Review and remove unused dependencies"
echo "4. Test performance improvements with Lighthouse"
echo "5. Monitor performance over time"
echo ""
echo "📚 For detailed guidance, see: docs/PERFORMANCE_OPTIMIZATION.md"
echo ""
echo -e "${GREEN}✨ Happy optimizing!${NC}"

#!/bin/bash

# Astro Type Bug Diagnostic Script
# Quickly diagnose and fix the "Property 'request' does not exist on type 'AuthAPIContext'" issue

echo "🔍 Astro Type Inheritance Bug Diagnostic"
echo "======================================="
echo

# Check if the main type file exists and has the workaround
TYPE_FILE="src/lib/auth/apiRouteTypes.ts"
if [ -f "$TYPE_FILE" ]; then
    echo "✅ Found type definitions file: $TYPE_FILE"
    
    # Check for problematic Astro imports
    if grep -q "import.*APIContext.*from.*'astro'" "$TYPE_FILE"; then
        echo "❌ ISSUE: Found import from 'astro' - this will cause the bug"
        echo "   Line: $(grep -n "import.*APIContext.*from.*'astro'" "$TYPE_FILE")"
        echo "   FIX: Remove import and use BaseAPIContext pattern"
    else
        echo "✅ No problematic Astro imports found"
    fi
    
    # Check for BaseAPIContext
    if grep -q "interface BaseAPIContext" "$TYPE_FILE"; then
        echo "✅ Found BaseAPIContext interface"
    else
        echo "❌ ISSUE: Missing BaseAPIContext interface"
        echo "   FIX: Add BaseAPIContext with explicit request: Request property"
    fi
    
    # Check for explicit request property
    if grep -q "request: Request" "$TYPE_FILE"; then
        echo "✅ Found explicit request: Request property"
    else
        echo "❌ ISSUE: Missing explicit request: Request property"
        echo "   FIX: Add 'request: Request' to AuthAPIContext interface"
    fi
    
else
    echo "❌ Type definitions file not found: $TYPE_FILE"
    echo "   FIX: Create the file with BaseAPIContext pattern"
fi

echo
echo "🧪 Running TypeScript Check"
echo "==========================="

# Check for TypeScript errors in common API routes
TEST_FILES=(
    "src/pages/api/emotions/session-analysis.ts"
    "src/lib/auth/apiRouteTypes.ts"
)

for file in "${TEST_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "Checking: $file"
        if pnpm exec tsc --noEmit --skipLibCheck "$file" 2>/dev/null; then
            echo "✅ $file compiles without errors"
        else
            echo "❌ $file has TypeScript errors:"
            pnpm exec tsc --noEmit --skipLibCheck "$file" 2>&1 | grep -E "(error|Property.*does not exist)"
        fi
    else
        echo "⚠️  File not found: $file"
    fi
done

echo
echo "🔧 Quick Fix Commands"
echo "===================="
echo "If issues found above, apply these fixes:"
echo
echo "1. See full documentation:"
echo "   cat docs/ASTRO_TYPE_INHERITANCE_BUG.md"
echo
echo "2. Check working example:"
echo "   cat src/lib/auth/apiRouteTypes.ts"
echo
echo "3. Test specific file:"
echo "   pnpm exec tsc --noEmit --skipLibCheck src/pages/api/YOUR_FILE.ts"
echo
echo "4. For new API routes, ensure they use:"
echo "   export const GET = protectRoute()(async ({ locals, request }) => {"
echo "   // ^ This should work without TypeScript errors"
echo

echo "📚 Additional Resources"
echo "======================"
echo "- Full documentation: docs/ASTRO_TYPE_INHERITANCE_BUG.md"
echo "- Known issues list: docs/KNOWN_ISSUES.md" 
echo "- Working example: src/pages/api/emotions/session-analysis.ts"
echo
echo "Done! 🎉"

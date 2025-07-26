#!/bin/bash

# Fix ALL port 8080 references to 3000 across the entire codebase
# This script will systematically replace every instance of 8080 with 3000

echo "🔧 FIXING ALL PORT 8080 REFERENCES TO 3000..."
echo "================================================"

# Function to replace in file with backup
replace_in_file() {
    local file="$1"
    local old="$2"
    local new="$3"
    
    if [ -f "$file" ]; then
        echo "📝 Fixing $file..."
        # Create backup
        cp "$file" "$file.backup"
        # Replace all instances
        sed -i "s/$old/$new/g" "$file"
        echo "   ✅ Updated $file"
    else
        echo "   ⚠️  File not found: $file"
    fi
}

# 1. Fix Dockerfiles
echo "🐳 Fixing Dockerfiles..."
replace_in_file "Dockerfile" "8080" "3000"
replace_in_file "Dockerfile.azure" "8080" "3000"
replace_in_file "Dockerfile.minimal" "8080" "3000"

# 2. Fix package.json
echo "📦 Fixing package.json..."
replace_in_file "package.json" "8080" "3000"

# 3. Fix astro.config.mjs
echo "🚀 Fixing astro.config.mjs..."
replace_in_file "astro.config.mjs" "8080" "3000"

# 4. Fix scripts
echo "📜 Fixing scripts..."
replace_in_file "scripts/start-server.js" "8080" "3000"
replace_in_file "scripts/health-check.js" "8080" "3000"
replace_in_file "scripts/azure-commands.sh" "8080" "3000"
replace_in_file "scripts/docker-pull-azure.sh" "8080" "3000"
replace_in_file "scripts/docker-push-azure.sh" "8080" "3000"
replace_in_file "scripts/force-azure-redeploy.sh" "8080" "3000"
replace_in_file "scripts/deploy-azure-app-service.sh" "8080" "3000"

# 5. Fix Azure pipeline
echo "🔄 Fixing Azure pipeline..."
replace_in_file "azure-pipelines.yml" "8080" "3000"

# 6. Fix ARM/Bicep templates
echo "☁️  Fixing Azure templates..."
replace_in_file "deploy/azure/main.json" "8080" "3000"

# 7. Fix Docker compose files
echo "🐙 Fixing Docker compose..."
replace_in_file "docker-compose.yml" "8080" "3000"
replace_in_file "docker/azure/docker-compose.azure.yml" "8080" "3000"

# 8. Fix nginx configs
echo "🌐 Fixing nginx configs..."
replace_in_file "docker/nginx/nginx.conf" "8080" "3000"
replace_in_file "docker/azure/nginx/nginx.azure.conf" "8080" "3000"

# 9. Fix health check scripts
echo "🏥 Fixing health check scripts..."
replace_in_file "docker/azure/scripts/web-health.sh" "8080" "3000"
replace_in_file "docker/azure/scripts/nginx-health.sh" "8080" "3000"

# 10. Fix Makefile
echo "🔨 Fixing Makefile..."
replace_in_file "Makefile" "8080" "3000"

# 11. Fix CORS configuration
echo "🔒 Fixing CORS config..."
replace_in_file "src/lib/middleware/cors.ts" "8080" "3000"

# 12. Fix documentation
echo "📚 Fixing documentation..."
replace_in_file "docs/AZURE_CONTAINER_REGISTRY.md" "8080" "3000"
replace_in_file "src/content/docs/api/security.md" "8080" "3000"

# 13. Fix bias detection setup
echo "🧠 Fixing bias detection..."
replace_in_file "src/lib/ai/bias-detection/setup.sh" "8080" "3000"

# 14. Fix prometheus config
echo "📊 Fixing prometheus..."
replace_in_file "docker/prometheus/prometheus.yml" "8080" "3000"

# 15. Fix Azure-specific Dockerfiles
echo "☁️  Fixing Azure Dockerfiles..."
replace_in_file "docker/azure/Dockerfile.azure-nginx" "8080" "3000"

# 16. Fix container apps deployment
echo "📱 Fixing container apps..."
replace_in_file "docker/azure/deploy-container-apps.sh" "8080" "3000"

# 17. Fix MCP servers config
echo "🤖 Fixing MCP servers..."
replace_in_file "mcp-servers.json" "8080" "3000"

echo ""
echo "🎉 ALL PORT REFERENCES FIXED!"
echo "================================"
echo "✅ Changed all 8080 references to 3000"
echo "💾 Backup files created with .backup extension"
echo ""
echo "🔍 Verification - searching for remaining 8080 references:"
echo "-----------------------------------------------------------"

# Search for any remaining 8080 references
if command -v grep >/dev/null 2>&1; then
    remaining=$(grep -r "8080" . --exclude-dir=node_modules --exclude-dir=.git --exclude="*.backup" 2>/dev/null | wc -l)
    if [ "$remaining" -eq 0 ]; then
        echo "✅ SUCCESS: No remaining 8080 references found!"
    else
        echo "⚠️  WARNING: Found $remaining remaining 8080 references:"
        grep -r "8080" . --exclude-dir=node_modules --exclude-dir=.git --exclude="*.backup" 2>/dev/null | head -10
    fi
else
    echo "ℹ️  grep not available, manual verification needed"
fi

echo ""
echo "🚀 Ready to commit and deploy with port 3000!"

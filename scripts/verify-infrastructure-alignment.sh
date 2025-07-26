#!/bin/bash
# Infrastructure Alignment Verification Script
# This scecho ""
echo "5. Checking Image Naming..."
check_pattern "azure-pipelines.yml" "imageName.*pixelated-web" "Pipeline uses pixelated-web image name" true
# Note: Bicep doesn't reference specific image names since Container Apps are created dynamically by pipeline verifies that Bicep templates and pipeline are properly aligned

echo "🔍 Verifying Infrastructure Alignment..."
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Function to check if a pattern exists in a file
check_pattern() {
    local file="$1"
    local pattern="$2"
    local description="$3"
    local should_exist="$4" # true/false
    
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ File not found: $file${NC}"
        ((ERRORS++))
        return
    fi
    
    if grep -E "$pattern" "$file" >/dev/null 2>&1; then
        if [ "$should_exist" = "true" ]; then
            echo -e "${GREEN}✅ $description${NC}"
        else
            echo -e "${RED}❌ $description (should NOT exist)${NC}"
            ((ERRORS++))
        fi
    else
        if [ "$should_exist" = "true" ]; then
            echo -e "${RED}❌ $description (missing)${NC}"
            ((ERRORS++))
        else
            echo -e "${GREEN}✅ $description (correctly absent)${NC}"
        fi
    fi
}

echo "1. Checking Container Registry Naming..."
check_pattern "infra/main.bicep" "name: 'pixelatedcr'" "Bicep uses fixed ACR name 'pixelatedcr'" true
check_pattern "azure-pipelines.yml" 'ACR_NAME="pixelatedcr"' "Pipeline uses fixed ACR name 'pixelatedcr'" true
check_pattern "scripts/deploy-infrastructure.sh" 'acr_name="pixelatedcr"' "Deploy script uses fixed ACR name" true
check_pattern "scripts/emergency-deploy.sh" 'ACR_NAME="pixelatedcr"' "Emergency script uses fixed ACR name" true

echo ""
echo "2. Checking Admin User Configuration..."
check_pattern "infra/main.bicep" "adminUserEnabled: true" "Bicep enables ACR admin user" true
check_pattern "scripts/deploy-infrastructure.sh" "admin-enabled true" "Deploy script enables admin user" true
check_pattern "scripts/emergency-deploy.sh" "admin-enabled true" "Emergency script enables admin user" true

echo ""
echo "3. Checking Container App Environment Naming..."
check_pattern "infra/main.bicep" "name: 'pixel-env-" "Bicep uses pixel-env prefix" true
check_pattern "azure-pipelines.yml" "starts_with.*pixel-env" "Pipeline searches for pixel-env prefix" true

echo ""
echo "4. Checking Container App Strategy..."
check_pattern "infra/main.bicep" "Microsoft.App/containerApps" "Bicep does NOT create static Container App" false
check_pattern "azure-pipelines.yml" "containerAppNamePrefix.*Build.BuildId" "Pipeline creates dynamic Container Apps" true
check_pattern "azure-pipelines.yml" "Clean Up Old Container Apps" "Pipeline includes cleanup strategy" true

echo ""
echo "5. Checking Image Naming..."
check_pattern "azure-pipelines.yml" "pixelated-web" "Pipeline uses pixelated-web image name" true
# Note: Bicep doesn't reference specific image names since Container Apps are created dynamically by pipeline

echo ""
echo "6. Checking Resource Cleanup..."
check_pattern "azure-pipelines.yml" "Clean Up Old Container Apps" "Pipeline has cleanup stage" true
check_pattern "azure-pipelines.yml" "Deleting old image tag" "Pipeline cleans up old images" true

echo ""
echo "=================================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed! Infrastructure and pipeline are properly aligned.${NC}"
    echo ""
    echo "Summary of alignment:"
    echo "• Container Registry: Fixed name 'pixelatedcr' with admin enabled"
    echo "• Container Apps: Dynamic per-build creation (pixel-{BuildId})"
    echo "• Environment: Shared 'pixel-env-{suffix}' pattern"
    echo "• Cleanup: Automatic removal of old apps and images"
    echo "• Security: Admin enabled only where needed for pipeline"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS alignment issues that need to be fixed.${NC}"
    echo ""
    echo "Please review the failures above and make necessary corrections."
    exit 1
fi

#!/bin/bash

# Production Deployment Script for Business Strategy CMS

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REDIS_AUDIT="${PROJECT_ROOT}/scripts/check-redis-hardening.sh"

run_redis_hardening_audit() {
  if ! "$REDIS_AUDIT"; then
    echo "Redis hardening audit failed"
    exit 1
  fi
}

echo "🚀 Starting Production Deployment for Business Strategy CMS..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for required tools
command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js is required but not installed.${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}npm is required but not installed.${NC}"; exit 1; }

# Function to deploy to Vercel
deploy_vercel() {
    run_redis_hardening_audit
    echo -e "${YELLOW}🎯 Deploying to Vercel...${NC}"
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        echo -e "${YELLOW}📦 Installing Vercel CLI...${NC}"
        npm install -g vercel
    fi
    
    # Deploy to Vercel
    vercel --prod
    echo -e "${GREEN}✅ Successfully deployed to Vercel!${NC}"
}



# Function to run production tests
run_tests() {
    echo -e "${YELLOW}🧪 Running production tests...${NC}"
    
    # Install dependencies
    npm ci --production=false
    
    # Run tests
    npm run test:all
    
    # Run security checks
    npm run security:check
    
    echo -e "${GREEN}✅ All tests passed!${NC}"
}

# Main deployment logic
main() {
    echo -e "${GREEN}Business Strategy CMS Production Deployment${NC}"
    echo "Select deployment platform:"
    echo "1) Vercel"
    echo "2) Run tests only"
    echo ""
    
    read -p "Enter your choice (1-2): " choice
    
    case $choice in
        1)
            deploy_vercel
            ;;
        2)
            run_tests
            ;;
        *)
            echo -e "${RED}Invalid choice. Please run the script again.${NC}"
            exit 1
            ;;
    esac
}

# Check if running in CI/CD
if [[ "$1" == "--vercel" ]]; then
    deploy_vercel
elif [[ "$1" == "--test" ]]; then
    run_tests
else
    main
fi

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo "📋 Next steps:"
echo "1. Update DNS records to point to your deployment"
echo "2. Set up SSL certificates (Let's Encrypt)"
echo "3. Configure monitoring and alerts"
echo "4. Set up CI/CD pipeline for automatic deployments"
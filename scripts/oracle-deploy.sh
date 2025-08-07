#!/bin/bash

# One-command Oracle Cloud deployment for Pixelated
# This script handles both infrastructure creation and app deployment

set -e

DOMAIN=${1:-""}

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_header() { echo -e "${BLUE}[STEP]${NC} $1"; }

print_header "🚀 Oracle Cloud Full Deployment for Pixelated"
echo ""

# Check if infrastructure already exists
if [[ -f ".oracle_deployment" ]]; then
    print_status "Infrastructure already exists. Deploying app..."
    ./scripts/deploy-app-to-oracle.sh "$DOMAIN"
else
    print_status "Creating infrastructure and deploying app..."
    
    # Create infrastructure
    print_header "Step 1: Creating Oracle Cloud infrastructure..."
    ./scripts/deploy-oracle-automated.sh
    
    echo ""
    print_header "Step 2: Waiting for instance to be ready..."
    sleep 60  # Give cloud-init time to start
    
    # Deploy app
    print_header "Step 3: Deploying application..."
    ./scripts/deploy-app-to-oracle.sh "$DOMAIN"
fi

echo ""
print_status "🎉 Full deployment completed!"
print_status ""
print_status "Usage for future deployments:"
print_status "  ./scripts/oracle-deploy.sh                    # Deploy to IP"
print_status "  ./scripts/oracle-deploy.sh yourdomain.com     # Deploy with domain"

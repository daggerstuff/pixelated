#!/bin/bash

# Production Deployment Script for Business Strategy CMS
# Supports multiple cloud platforms: Vercel, AWS, DigitalOcean

set -e

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

# Function to deploy to AWS
deploy_aws() {
    echo -e "${YELLOW}🎯 Deploying to AWS ECS...${NC}"
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}AWS CLI is required but not installed.${NC}"
        echo "Install it from: https://aws.amazon.com/cli/"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}AWS credentials not configured.${NC}"
        echo "Run: aws configure"
        exit 1
    fi
    
    # Build Docker image
    echo -e "${YELLOW}🐳 Building Docker image...${NC}"
    docker build -t business-strategy-cms -f Dockerfile.prod .
    
    # Tag and push to ECR
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    AWS_REGION=${AWS_REGION:-us-east-1}
    ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/business-strategy-cms"
    
    aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_URI}
    docker tag business-strategy-cms:latest ${ECR_URI}:latest
    docker push ${ECR_URI}:latest
    
    # Deploy to ECS
    aws ecs update-service --cluster business-strategy-cms --service business-strategy-cms --force-new-deployment
    echo -e "${GREEN}✅ Successfully deployed to AWS ECS!${NC}"
}

# Function to deploy to DigitalOcean
deploy_digitalocean() {
    echo -e "${YELLOW}🎯 Deploying to DigitalOcean App Platform...${NC}"
    
    # Check if doctl is installed
    if ! command -v doctl &> /dev/null; then
        echo -e "${RED}doctl is required but not installed.${NC}"
        echo "Install it from: https://docs.digitalocean.com/reference/doctl/"
        exit 1
    fi
    
    # Create app specification
    cat > app.yaml << EOF
name: business-strategy-cms
services:
- name: api
  source_dir: /
  github:
    repo: your-username/business-strategy-cms
    branch: main
  run_command: node src/server.prod.ts
  environment_slug: node-js
  instance_count: 2
  instance_size_slug: basic-xxs
  routes:
  - path: /
  envs:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    scope: RUN_TIME
    value: \${DATABASE_URL}
  - key: JWT_SECRET
    scope: RUN_TIME
    value: \${JWT_SECRET}
  - key: AWS_ACCESS_KEY_ID
    scope: RUN_TIME
    value: \${AWS_ACCESS_KEY_ID}
  - key: AWS_SECRET_ACCESS_KEY
    scope: RUN_TIME
    value: \${AWS_SECRET_ACCESS_KEY}
  - key: AWS_REGION
    scope: RUN_TIME
    value: \${AWS_REGION}
  - key: AWS_S3_BUCKET
    scope: RUN_TIME
    value: \${AWS_S3_BUCKET}
EOF
    
    doctl apps create --spec app.yaml
    echo -e "${GREEN}✅ Successfully deployed to DigitalOcean!${NC}"
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
    echo "1) Vercel (Recommended for serverless)"
    echo "2) AWS ECS (Scalable containers)"
    echo "3) DigitalOcean (Simple and cost-effective)"
    echo "4) Run tests only"
    echo ""
    
    read -p "Enter your choice (1-4): " choice
    
    case $choice in
        1)
            deploy_vercel
            ;;
        2)
            deploy_aws
            ;;
        3)
            deploy_digitalocean
            ;;
        4)
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
elif [[ "$1" == "--aws" ]]; then
    deploy_aws
elif [[ "$1" == "--digitalocean" ]]; then
    deploy_digitalocean
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
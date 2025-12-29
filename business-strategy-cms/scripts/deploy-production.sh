#!/bin/bash

# Business Strategy CMS Production Deployment Script
# This script deploys the application to multiple cloud providers

set -e

echo "🚀 Starting Business Strategy CMS Production Deployment"

# Configuration
PROJECT_NAME="business-strategy-cms"
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ECR_REPOSITORY="${PROJECT_NAME}"
ECS_CLUSTER="${PROJECT_NAME}-cluster"
ECS_SERVICE="${PROJECT_NAME}-service"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check required tools
    command -v aws >/dev/null 2>&1 || error "AWS CLI is required but not installed"
    command -v docker >/dev/null 2>&1 || error "Docker is required but not installed"
    command -v kubectl >/dev/null 2>&1 || warn "kubectl is not installed (optional for EKS)"
    
    # Check AWS credentials
    aws sts get-caller-identity >/dev/null 2>&1 || error "AWS credentials not configured"
    
    log "✅ Prerequisites check passed"
}

# Build and push Docker image
build_and_push() {
    log "Building Docker image..."
    
    # Build production image
    docker build -f docker/Dockerfile.prod -t ${PROJECT_NAME}:latest .
    
    # Tag for ECR
    docker tag ${PROJECT_NAME}:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest
    
    # Login to ECR
    aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
    
    # Create ECR repository if it doesn't exist
    aws ecr describe-repositories --repository-names ${ECR_REPOSITORY} --region ${AWS_REGION} >/dev/null 2>&1 || \
        aws ecr create-repository --repository-name ${ECR_REPOSITORY} --region ${AWS_REGION}
    
    # Push image
    docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest
    
    log "✅ Docker image built and pushed"
}

# Deploy to AWS ECS
deploy_aws_ecs() {
    log "Deploying to AWS ECS..."
    
    # Update ECS service
    aws ecs update-service \
        --cluster ${ECS_CLUSTER} \
        --service ${ECS_SERVICE} \
        --force-new-deployment \
        --region ${AWS_REGION}
    
    log "✅ AWS ECS deployment initiated"
}

# Deploy to Vercel
deploy_vercel() {
    log "Deploying to Vercel..."
    
    # Check if Vercel CLI is installed
    command -v vercel >/dev/null 2>&1 || npm install -g vercel
    
    # Deploy to Vercel
    vercel --prod --confirm
    
    log "✅ Vercel deployment completed"
}

# Deploy to DigitalOcean
deploy_digitalocean() {
    log "Deploying to DigitalOcean App Platform..."
    
    # Create/update DigitalOcean app
    doctl apps create --spec .do/app.yaml --wait
    
    log "✅ DigitalOcean deployment completed"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Create temporary container for migrations
    docker run --rm \
        --env-file .env.production \
        ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest \
        sh -c "npx prisma migrate deploy"
    
    log "✅ Database migrations completed"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Wait for deployment to be ready
    sleep 30
    
    # Check health endpoint
    HEALTH_URL=$(aws ecs describe-services \
        --cluster ${ECS_CLUSTER} \
        --services ${ECS_SERVICE} \
        --region ${AWS_REGION} \
        --query 'services[0].loadBalancers[0].targetGroupArn' \
        --output text | \
        aws elbv2 describe-target-groups \
        --target-group-arn $(cat) \
        --query 'TargetGroups[0].LoadBalancerArns[0]' \
        --output text | \
        aws elbv2 describe-load-balancers \
        --load-balancer-arns $(cat) \
        --query 'LoadBalancers[0].DNSName' \
        --output text)
    
    if curl -f "http://${HEALTH_URL}/health" >/dev/null 2>&1; then
        log "✅ Health check passed"
    else
        error "Health check failed"
    fi
}

# Show deployment status
show_status() {
    log "Deployment status:"
    
    # ECS service status
    aws ecs describe-services \
        --cluster ${ECS_CLUSTER} \
        --services ${ECS_SERVICE} \
        --region ${AWS_REGION} \
        --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}'
    
    # Show service URL
    SERVICE_URL=$(aws elbv2 describe-load-balancers \
        --names ${PROJECT_NAME}-alb \
        --region ${AWS_REGION} \
        --query 'LoadBalancers[0].DNSName' \
        --output text)
    
    log "🌐 Application URL: https://${SERVICE_URL}"
}

# Main deployment function
deploy() {
    local target=${1:-"all"}
    
    log "Starting deployment to: $target"
    
    check_prerequisites
    
    case $target in
        "aws")
            build_and_push
            deploy_aws_ecs
            run_migrations
            health_check
            show_status
            ;;
        "vercel")
            deploy_vercel
            ;;
        "digitalocean")
            deploy_digitalocean
            ;;
        "all")
            build_and_push
            deploy_aws_ecs
            run_migrations
            health_check
            deploy_vercel
            log "✅ Multi-cloud deployment completed"
            ;;
        *)
            error "Invalid target. Use: aws, vercel, digitalocean, or all"
            ;;
    esac
}

# Rollback function
rollback() {
    log "Rolling back to previous version..."
    
    # AWS ECS rollback
    aws ecs list-task-definitions \
        --family-prefix ${PROJECT_NAME} \
        --region ${AWS_REGION} \
        --query "taskDefinitionArns[1]" \
        --output text | \
        xargs aws ecs update-service \
        --cluster ${ECS_CLUSTER} \
        --service ${ECS_SERVICE} \
        --task-definition \
        --region ${AWS_REGION}
    
    log "✅ Rollback completed"
}

# Help function
show_help() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  aws          Deploy to AWS ECS only"
    echo "  vercel       Deploy to Vercel only"
    echo "  digitalocean Deploy to DigitalOcean only"
    echo "  all          Deploy to all platforms (default)"
    echo "  rollback     Rollback to previous version"
    echo "  help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 aws"
    echo "  $0 all"
    echo "  $0 rollback"
}

# Main script
if [ $# -eq 0 ]; then
    deploy "all"
elif [ "$1" = "help" ] || [ "$1" = "-h" ]; then
    show_help
elif [ "$1" = "rollback" ]; then
    rollback
else
    deploy "$1"
fi
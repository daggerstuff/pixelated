#!/bin/bash

# AWS Deployment Script for Pixelated Astro App - Resume from CloudFormation deployment
set -e

echo "🚀 Resuming AWS deployment from CloudFormation deployment..."

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    echo "📄 Loading environment variables from .env file..."
    # Use a safer method to load .env that handles special characters
    set -a
    source .env
    set +a
else
    echo "⚠️  .env file not found - using system environment variables"
fi

# Set AWS Profile to default
export AWS_PROFILE="default"

# Configuration
STACK_NAME="${STACK_NAME:-pixelated-astro}"
REGION="${AWS_REGION:-us-east-1}"
BUCKET_PREFIX="${BUCKET_PREFIX:-pixelated-deploy}"
DOMAIN_NAME="${DOMAIN_NAME:-pixelatedempathy.com}"

# Since deployment.zip is already uploaded, we need the bucket name
# If DEPLOY_BUCKET is not set, we'll try to find it or you can set it manually
if [ -z "$DEPLOY_BUCKET" ]; then
    # Default to the known bucket if not specified
    DEPLOY_BUCKET="pixelated-deploy-us-east-1-1750577212"
    echo "ℹ️  Using default bucket: $DEPLOY_BUCKET"
    echo "   (Set DEPLOY_BUCKET environment variable to override)"
fi

# Environment detection
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "❌ AWS credentials not found in environment variables"
    echo "   Please create a .env file with:"
    echo "   AWS_ACCESS_KEY_ID=your_access_key_here"
    echo "   AWS_SECRET_ACCESS_KEY=your_secret_key_here"
    echo "   Or set these environment variables in your shell"
    exit 1
fi

echo "📋 Configuration:"
echo "  Stack Name: $STACK_NAME"
echo "  Region: $REGION"
echo "  Domain: $DOMAIN_NAME"
echo "  Deployment Bucket: $DEPLOY_BUCKET"
echo ""

# Verify deployment.zip exists in the bucket
echo "🔍 Verifying deployment.zip exists in S3..."
if ! aws s3 ls s3://$DEPLOY_BUCKET/deployment.zip >/dev/null 2>&1; then
    echo "❌ deployment.zip not found in s3://$DEPLOY_BUCKET/"
    echo "   Please ensure deployment.zip is uploaded to the bucket first"
    exit 1
fi
echo "✅ deployment.zip found in S3 bucket"

# Deploy CloudFormation stack
echo "🏗️ Deploying CloudFormation stack..."
aws cloudformation deploy \
    --template-file deploy/aws/cloudformation.yaml \
    --stack-name $STACK_NAME \
    --parameter-overrides \
        DomainName=$DOMAIN_NAME \
        DeploymentBucket=$DEPLOY_BUCKET \
        Environment=production \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
    --region $REGION

# Get outputs
echo "📊 Getting deployment outputs..."
OUTPUTS=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs' \
    --output table)

echo ""
echo "✅ AWS deployment complete!"
echo ""
echo "🌐 Deployment Details:"
echo "$OUTPUTS"
echo ""

# Get the CloudFront distribution URL
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionURL`].OutputValue' \
    --output text)

if [ ! -z "$CLOUDFRONT_URL" ]; then
    echo "🔗 Your site is available at: $CLOUDFRONT_URL"
fi

echo "🎉 AWS deployment completed successfully!"

echo ""
echo "💡 Note: This script resumed from CloudFormation deployment."
echo "   The deployment.zip was already in S3 bucket: $DEPLOY_BUCKET"
echo "   To run the full deployment process, use the original script or rebuild first." 
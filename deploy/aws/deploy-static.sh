#!/bin/bash

# Static AWS Deployment Script for Pixelated Astro App
set -e

echo "Starting AWS static deployment..."

# Configuration
STACK_NAME="${STACK_NAME:-pixelated-static}"
REGION="${AWS_REGION:-us-east-1}"
DOMAIN_NAME="${DOMAIN_NAME:-pixelatedempathy.com}"

# Load environment variables from .env file if it exists
if [[ -f ".env" ]]; then
	echo "Loading environment variables from .env file..."
	set -a
	source .env
	set +a
fi

# Set AWS Profile to default
export AWS_PROFILE="default"

echo "Configuration:"
echo "  Stack Name: ${STACK_NAME}"
echo "  Region: ${REGION}"
echo "  Domain: ${DOMAIN_NAME}"
echo ""

# Check if dist directory exists
if [[ ! -d "dist/client" ]]; then
	echo "dist/client directory not found. Please run 'pnpm build' first."
	exit 1
fi

echo "Build size:"
du -sh dist/

# Deploy CloudFormation stack for S3 + CloudFront
echo "Deploying CloudFormation stack..."
aws cloudformation deploy \
	--template-file deploy/aws/cloudformation-simple-static.yaml \
	--stack-name "${STACK_NAME}" \
	--parameter-overrides \
	DomainName="${DOMAIN_NAME}" \
	Environment=production \
	--capabilities CAPABILITY_IAM \
	--region "${REGION}"

# Get the S3 bucket name from stack outputs
echo "Getting S3 bucket name..."
S3_BUCKET=$(aws cloudformation describe-stacks \
	--stack-name "${STACK_NAME}" \
	--region "${REGION}" \
	--query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
	--output text)

if [[ -z "${S3_BUCKET}" ]]; then
	echo "Could not get S3 bucket name from CloudFormation stack"
	exit 1
fi

echo "S3 Bucket: ${S3_BUCKET}"

# Sync static files to S3
echo "Uploading static files to S3..."
aws s3 sync dist/client/ s3://"${S3_BUCKET}"/ \
	--delete \
	--cache-control "public, max-age=31536000" \
	--exclude "*.html" \
	--region "${REGION}"

# Upload HTML files with shorter cache
echo "Uploading HTML files with shorter cache..."
aws s3 sync dist/client/ s3://"${S3_BUCKET}"/ \
	--delete \
	--cache-control "public, max-age=3600" \
	--include "*.html" \
	--region "${REGION}"

# Get CloudFront distribution ID
echo "Getting CloudFront distribution..."
CLOUDFRONT_ID=$(aws cloudformation describe-stacks \
	--stack-name "${STACK_NAME}" \
	--region "${REGION}" \
	--query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
	--output text)

if [[ ! -z "${CLOUDFRONT_ID}" ]]; then
	echo "Invalidating CloudFront cache..."
	aws cloudfront create-invalidation \
		--distribution-id "${CLOUDFRONT_ID}" \
		--paths "/*" \
		--region "${REGION}"
fi

# Get outputs
echo "Getting deployment outputs..."
OUTPUTS=$(aws cloudformation describe-stacks \
	--stack-name "${STACK_NAME}" \
	--region "${REGION}" \
	--query 'Stacks[0].Outputs' \
	--output table)

echo ""
echo "AWS static deployment complete!"
echo ""
echo "Deployment Details:"
echo "${OUTPUTS}"
echo ""

# Get the CloudFront distribution URL
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
	--stack-name "${STACK_NAME}" \
	--region "${REGION}" \
	--query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionURL`].OutputValue' \
	--output text)

if [[ ! -z "${CLOUDFRONT_URL}" ]]; then
	echo "Your site is available at: ${CLOUDFRONT_URL}"
fi

echo "Static deployment completed successfully!"
echo ""
echo "Next steps for App Runner (dynamic features):"
echo "   1. Set up container registry for dynamic backend"
echo "   2. Configure App Runner for API endpoints"
echo "   3. Update DNS to point API subdomain to App Runner"

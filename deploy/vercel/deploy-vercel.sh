#!/bin/bash

# Vercel Deployment Script for Pixelated Empathy
# This script handles Vercel-specific deployment with optimizations

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
	echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
	echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
	echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
	echo -e "${RED}❌ $1${NC}"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ASTRO_CONFIG="astro.config.vercel.mjs"
BUILD_DIR="dist"

# Environment detection
ENVIRONMENT="${VERCEL_ENV:-development}"
IS_PRODUCTION="${VERCEL_ENV:-false}"

log_info "Starting Vercel deployment process..."
log_info "Environment: ${ENVIRONMENT}"
log_info "Project root: ${PROJECT_ROOT}"

cd "${PROJECT_ROOT}"

# Validate environment
log_info "Validating deployment environment..."

if [[ ! -f "${ASTRO_CONFIG}" ]]; then
	log_error "Vercel Astro config not found: ${ASTRO_CONFIG}"
	exit 1
fi

if [[ ! -f "package.json" ]]; then
	log_error "package.json not found"
	exit 1
fi

if [[ ! -f "vercel.json" ]]; then
	log_error "vercel.json not found"
	exit 1
fi

log_success "Environment validation passed"

# Check Node.js and pnpm versions
log_info "Checking Node.js and pnpm versions..."
NODE_VERSION=$(node --version)
PNPM_VERSION=$(pnpm --version)
log_info "Node.js: ${NODE_VERSION}"
log_info "pnpm: ${PNPM_VERSION}"

# Set environment variables for Vercel build
export NODE_ENV=production
export ASTRO_CONFIG_FILE="${ASTRO_CONFIG}"
export VERCEL_DEPLOYMENT=true

log_info "Environment variables set:"
log_info "  NODE_ENV: ${NODE_ENV}"
log_info "  ASTRO_CONFIG_FILE: ${ASTRO_CONFIG_FILE}"
log_info "  VERCEL_DEPLOYMENT: ${VERCEL_DEPLOYMENT}"

# Clean previous builds
log_info "Cleaning previous builds..."
if [[ -d "${BUILD_DIR}" ]]; then
	rm -rf "${BUILD_DIR}"
	log_success "Cleaned ${BUILD_DIR} directory"
fi

if [[ -d ".astro" ]]; then
	rm -rf ".astro"
	log_success "Cleaned .astro cache directory"
fi

# Install dependencies
log_info "Installing dependencies..."
if pnpm install --no-frozen-lockfile; then
	log_success "Dependencies installed successfully"
else
	log_error "Failed to install dependencies"
	exit 1
fi

# Run linting (non-blocking)
log_info "Running linting..."
if pnpm run lint:ci; then
	log_success "Linting passed"
else
	log_warning "Linting completed with warnings (continuing deployment)"
fi

# Run type checking (non-blocking)
log_info "Running type checking..."
if pnpm run type-check; then
	log_success "Type checking passed"
else
	log_warning "Type checking completed with warnings (continuing deployment)"
fi

# Build the application
log_info "Building application with Vercel configuration..."
BUILD_START_TIME=$(date +%s)

if ASTRO_CONFIG_FILE="${ASTRO_CONFIG}" pnpm build; then
	BUILD_END_TIME=$(date +%s)
	BUILD_DURATION=$((BUILD_END_TIME - BUILD_START_TIME))
	log_success "Build completed successfully in ${BUILD_DURATION}s"
else
	log_error "Build failed"
	exit 1
fi

# Verify build output
log_info "Verifying build output..."
if [[ ! -d "${BUILD_DIR}" ]]; then
	log_error "Build directory not found: ${BUILD_DIR}"
	exit 1
fi

# Check for essential files
if [[ -f "${BUILD_DIR}/index.html" ]]; then
	log_success "Static files generated"
fi

if [[ -d "${BUILD_DIR}/server" ]] && [[ -f "${BUILD_DIR}/server/entry.mjs" ]]; then
	log_success "Server files generated for hybrid mode"
fi

if [[ -d "${BUILD_DIR}/_astro" ]]; then
	log_success "Asset files generated"
	ASSET_COUNT=$(find "${BUILD_DIR}/_astro" -type f | wc -l)
	log_info "Generated ${ASSET_COUNT} asset files"
fi

# Calculate build size
BUILD_SIZE=$(du -sh "${BUILD_DIR}" | cut -f1)
log_info "Build size: ${BUILD_SIZE}"

# Deployment
if [[ "${IS_PRODUCTION}" = "true" ]]; then
	log_info "Deploying to Vercel production..."

	if command -v vercel >/dev/null 2>&1; then
		if vercel deploy --prod --prebuilt; then
			log_success "Production deployment completed successfully"
		else
			log_error "Production deployment failed"
			exit 1
		fi
	else
		log_warning "Vercel CLI not found, skipping deployment"
		log_info "Build artifacts are ready for manual deployment"
	fi
else
	log_info "Deploying to Vercel preview..."

	if command -v vercel >/dev/null 2>&1; then
		if vercel deploy --prebuilt; then
			log_success "Preview deployment completed successfully"
		else
			log_error "Preview deployment failed"
			exit 1
		fi
	else
		log_warning "Vercel CLI not found, skipping deployment"
		log_info "Build artifacts are ready for manual deployment"
	fi
fi

# Post-deployment checks
log_info "Running post-deployment checks..."

# Check if deployment URL is available
if [[ -n "${VERCEL_URL-}" ]]; then
	log_info "Deployment URL: https://${VERCEL_URL}"

	# Simple health check
	if curl -f -s "https://${VERCEL_URL}/api/health/simple" >/dev/null; then
		log_success "Health check passed"
	else
		log_warning "Health check failed (this may be normal for new deployments)"
	fi
fi

log_success "Vercel deployment process completed!"
log_info "Build artifacts are available in: ${BUILD_DIR}"

# Summary
echo ""
echo "📊 Deployment Summary:"
echo "  Environment: ${ENVIRONMENT}"
echo "  Build size: ${BUILD_SIZE}"
echo "  Build duration: ${BUILD_DURATION:-unknown}s"
echo "  Configuration: ${ASTRO_CONFIG}"
if [[ -n "${VERCEL_URL-}" ]]; then
	echo "  Deployment URL: https://${VERCEL_URL}"
fi
echo ""

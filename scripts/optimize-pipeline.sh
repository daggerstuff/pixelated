#!/bin/bash
# Pipeline Optimization Script for Pixelated Empathy
# This script helps optimize the GitLab CI/CD pipeline performance

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

# Check if running in GitLab CI
if [[ "${CI:-}" == "true" ]]; then
    log_info "Running in GitLab CI environment"
    CI_MODE=true
else
    log_info "Running in local development environment"
    CI_MODE=false
fi

# Function to check Docker optimization
check_docker_optimization() {
    log_info "Checking Docker optimization..."
    
    if command -v docker &> /dev/null; then
        # Check Docker version
        DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
        log_info "Docker version: $DOCKER_VERSION"
        
        # Check if BuildKit is enabled
        if [[ "${DOCKER_BUILDKIT:-}" == "1" ]]; then
            log_success "Docker BuildKit is enabled"
        else
            log_warning "Docker BuildKit is not enabled - set DOCKER_BUILDKIT=1"
        fi
        
        # Check Docker daemon configuration
        if docker info | grep -q "Storage Driver: overlay2"; then
            log_success "Using overlay2 storage driver (optimal)"
        else
            log_warning "Not using overlay2 storage driver"
        fi
        
        # Check available disk space
        DISK_USAGE=$(df -h /var/lib/docker 2>/dev/null | awk 'NR==2 {print $5}' | sed 's/%//' || echo "0")
        if [[ $DISK_USAGE -gt 80 ]]; then
            log_warning "Docker disk usage is high: ${DISK_USAGE}%"
        else
            log_success "Docker disk usage is acceptable: ${DISK_USAGE}%"
        fi
    else
        log_error "Docker is not installed or not accessible"
    fi
}

# Function to check Node.js optimization
check_node_optimization() {
    log_info "Checking Node.js optimization..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log_info "Node.js version: $NODE_VERSION"
        
        # Check Node.js memory settings
        if [[ "${NODE_OPTIONS:-}" == *"--max-old-space-size"* ]]; then
            log_success "Node.js memory limit is configured: $NODE_OPTIONS"
        else
            log_warning "Node.js memory limit not configured - consider setting NODE_OPTIONS"
        fi
        
        # Check if pnpm is available
        if command -v pnpm &> /dev/null; then
            PNPM_VERSION=$(pnpm --version)
            log_success "pnpm is available: $PNPM_VERSION"
            
            # Check pnpm store configuration
            if [[ -n "${PNPM_CACHE_FOLDER:-}" ]]; then
                log_success "pnpm cache folder is configured: $PNPM_CACHE_FOLDER"
            else
                log_warning "pnpm cache folder not configured"
            fi
        else
            log_error "pnpm is not available"
        fi
    else
        log_error "Node.js is not installed"
    fi
}

# Function to check cache optimization
check_cache_optimization() {
    log_info "Checking cache optimization..."
    
    # Check if cache directories exist
    CACHE_DIRS=(".pnpm-store" "node_modules" ".astro" "dist")
    
    for dir in "${CACHE_DIRS[@]}"; do
        if [[ -d "$dir" ]]; then
            SIZE=$(du -sh "$dir" 2>/dev/null | cut -f1 || echo "unknown")
            log_info "Cache directory $dir exists (size: $SIZE)"
        else
            log_info "Cache directory $dir does not exist"
        fi
    done
    
    # Check GitLab CI cache configuration
    if [[ "$CI_MODE" == "true" ]]; then
        if [[ -n "${CI_CACHE_KEY:-}" ]]; then
            log_success "GitLab CI cache key is configured: $CI_CACHE_KEY"
        else
            log_warning "GitLab CI cache key not found"
        fi
    fi
}

# Function to check security configuration
check_security_configuration() {
    log_info "Checking security configuration..."
    
    # Check for required environment variables
    REQUIRED_VARS=("SSH_PRIVATE_KEY" "VPS_HOST" "VPS_USER")
    OPTIONAL_VARS=("SENTRY_AUTH_TOKEN" "SENTRY_DSN" "BETTER_AUTH_SECRET")
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [[ -n "${!var:-}" ]]; then
            log_success "Required variable $var is set"
        else
            log_error "Required variable $var is not set"
        fi
    done
    
    for var in "${OPTIONAL_VARS[@]}"; do
        if [[ -n "${!var:-}" ]]; then
            log_success "Optional variable $var is set"
        else
            log_warning "Optional variable $var is not set"
        fi
    done
    
    # Check file permissions
    if [[ -f ".env" ]]; then
        PERMS=$(stat -c "%a" .env 2>/dev/null || stat -f "%A" .env 2>/dev/null || echo "unknown")
        if [[ "$PERMS" == "600" ]]; then
            log_success ".env file has secure permissions (600)"
        else
            log_warning ".env file permissions are not secure: $PERMS (should be 600)"
        fi
    fi
}

# Function to optimize build context
optimize_build_context() {
    log_info "Analyzing build context..."
    
    if [[ -f ".dockerignore" ]]; then
        DOCKERIGNORE_LINES=$(wc -l < .dockerignore)
        log_success ".dockerignore exists with $DOCKERIGNORE_LINES rules"
    else
        log_error ".dockerignore file is missing"
        return 1
    fi
    
    # Count files that would be included in build context
    if command -v docker &> /dev/null; then
        log_info "Analyzing Docker build context size..."
        
        # Create a temporary tar to estimate build context size
        BUILD_CONTEXT_SIZE=$(tar -czf - . --exclude-from=.dockerignore 2>/dev/null | wc -c | awk '{print int($1/1024/1024)"MB"}')
        log_info "Estimated build context size: $BUILD_CONTEXT_SIZE"
        
        if [[ $(echo "$BUILD_CONTEXT_SIZE" | sed 's/MB//') -gt 100 ]]; then
            log_warning "Build context is large (>100MB) - consider optimizing .dockerignore"
        else
            log_success "Build context size is reasonable"
        fi
    fi
}

# Function to check pipeline configuration
check_pipeline_configuration() {
    log_info "Checking pipeline configuration..."
    
    if [[ -f ".gitlab-ci.yml" ]]; then
        log_success "GitLab CI configuration exists"
        
        # Check for common optimization patterns
        if grep -q "cache:" .gitlab-ci.yml; then
            log_success "Pipeline uses caching"
        else
            log_warning "Pipeline doesn't use caching"
        fi
        
        if grep -q "parallel:" .gitlab-ci.yml; then
            log_success "Pipeline uses parallel jobs"
        else
            log_warning "Pipeline doesn't use parallel jobs"
        fi
        
        if grep -q "timeout:" .gitlab-ci.yml; then
            log_success "Pipeline has timeout configurations"
        else
            log_warning "Pipeline doesn't have timeout configurations"
        fi
        
        # Check for resource limits
        if grep -q "KUBERNETES_.*_LIMIT" .gitlab-ci.yml; then
            log_success "Pipeline has resource limits configured"
        else
            log_warning "Pipeline doesn't have resource limits"
        fi
    else
        log_error "GitLab CI configuration file not found"
    fi
    
    # Check for optimized configuration
    if [[ -f ".gitlab-ci.optimized.yml" ]]; then
        log_success "Optimized GitLab CI configuration available"
        log_info "To use optimized configuration, run: mv .gitlab-ci.optimized.yml .gitlab-ci.yml"
    fi
}

# Function to generate optimization report
generate_optimization_report() {
    log_info "Generating optimization report..."
    
    REPORT_FILE="pipeline-optimization-report.md"
    
    cat > "$REPORT_FILE" << EOF
# Pipeline Optimization Report

Generated on: $(date)
Environment: ${CI_MODE:-local}

## Summary

This report analyzes the current pipeline configuration and provides recommendations for optimization.

## Findings

### Docker Optimization
$(check_docker_optimization 2>&1)

### Node.js Optimization
$(check_node_optimization 2>&1)

### Cache Optimization
$(check_cache_optimization 2>&1)

### Security Configuration
$(check_security_configuration 2>&1)

### Build Context
$(optimize_build_context 2>&1)

### Pipeline Configuration
$(check_pipeline_configuration 2>&1)

## Recommendations

1. **Use the optimized GitLab CI configuration**:
   \`\`\`bash
   mv .gitlab-ci.optimized.yml .gitlab-ci.yml
   \`\`\`

2. **Use the optimized Dockerfile**:
   \`\`\`bash
   mv Dockerfile.optimized Dockerfile
   \`\`\`

3. **Configure all required GitLab CI/CD variables** (see security/pipeline-security.md)

4. **Enable Docker BuildKit** in your GitLab runners:
   \`\`\`yaml
   variables:
     DOCKER_BUILDKIT: 1
   \`\`\`

5. **Monitor pipeline performance** and adjust resource limits as needed

## Next Steps

- [ ] Apply optimized configurations
- [ ] Configure required CI/CD variables
- [ ] Test pipeline performance
- [ ] Monitor resource usage
- [ ] Set up alerts for pipeline failures

EOF

    log_success "Optimization report generated: $REPORT_FILE"
}

# Main execution
main() {
    log_info "Starting pipeline optimization analysis..."
    
    check_docker_optimization
    echo
    check_node_optimization
    echo
    check_cache_optimization
    echo
    check_security_configuration
    echo
    optimize_build_context
    echo
    check_pipeline_configuration
    echo
    
    if [[ "${1:-}" == "--report" ]]; then
        generate_optimization_report
    fi
    
    log_success "Pipeline optimization analysis complete!"
    log_info "Run with --report flag to generate a detailed report"
}

# Run main function with all arguments
main "$@"
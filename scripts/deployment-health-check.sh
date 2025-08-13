#!/bin/bash

# Deployment Health Check Script
# =============================

set -e

# Configuration
HEALTH_ENDPOINT="${HEALTH_ENDPOINT:-http://localhost:3000/health}"
MAX_RETRIES="${MAX_RETRIES:-30}"
RETRY_INTERVAL="${RETRY_INTERVAL:-5}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${YELLOW}[HEALTH CHECK]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_health() {
    local retries=0
    
    log_info "Starting health check for $HEALTH_ENDPOINT"
    
    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -f -s "$HEALTH_ENDPOINT" > /dev/null 2>&1; then
            log_success "Health check passed after $((retries + 1)) attempts"
            return 0
        fi
        
        retries=$((retries + 1))
        log_info "Health check failed, attempt $retries/$MAX_RETRIES. Retrying in ${RETRY_INTERVAL}s..."
        sleep $RETRY_INTERVAL
    done
    
    log_error "Health check failed after $MAX_RETRIES attempts"
    return 1
}

# Detailed health check
detailed_health_check() {
    log_info "Running detailed health check..."
    
    # Check if containers are running
    if command -v docker-compose &> /dev/null; then
        log_info "Checking container status..."
        docker-compose ps
    fi
    
    # Check application health endpoint
    if curl -f -s "$HEALTH_ENDPOINT" | jq . 2>/dev/null; then
        log_success "Application health endpoint is responding with valid JSON"
    else
        log_error "Application health endpoint is not responding properly"
        return 1
    fi
    
    # Check database connectivity (if health endpoint provides this info)
    local health_response=$(curl -s "$HEALTH_ENDPOINT" 2>/dev/null || echo "{}")
    local db_status=$(echo "$health_response" | jq -r '.database.status // "unknown"' 2>/dev/null || echo "unknown")
    
    if [ "$db_status" = "connected" ]; then
        log_success "Database connectivity confirmed"
    else
        log_error "Database connectivity issue detected"
    fi
    
    log_success "Detailed health check completed"
}

# Main execution
case "${1:-basic}" in
    "basic")
        check_health
        ;;
    "detailed")
        detailed_health_check
        ;;
    *)
        echo "Usage: $0 [basic|detailed]"
        echo "  basic    - Basic health check (default)"
        echo "  detailed - Detailed health check with container status"
        exit 1
        ;;
esac
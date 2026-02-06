#!/bin/bash
# ============================================================================
# NeMo Microservices Recovery Script
# ============================================================================
# This script monitors and recovers NeMo microservices in case of failure.
# It prioritizes root dependencies like Postgres and MinIO before starting
# higher-level services.
#
# Usage: ./nemo-recovery.sh [options]
# Options:
#   --force: Restart all services regardless of health status
#   --wait: Wait for services to become healthy before proceeding
# ============================================================================

set -e

# Configuration
NEMO_DIR="/home/vivi/nemo-microservices-quickstart_v25.12"
LOG_DIR="/home/vivi/pixelated/logs/nemo"
LOG_FILE="$LOG_DIR/recovery.log"
RETRY_COUNT=3
RETRY_DELAY=5

# Ensure log directory exists
mkdir -p "$LOG_DIR"

log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

check_service_health() {
    local container_name=$1
    local status=$(docker inspect --format '{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "unknown")
    local state=$(docker inspect --format '{{.State.Status}}' "$container_name" 2>/dev/null || echo "missing")
    
    if [[ "$state" == "running" ]]; then
        if [[ "$status" == "healthy" || "$status" == "none" || "$status" == "unknown" ]]; then
            return 0
        fi
    fi
    return 1
}

recover_service() {
    local container_name=$1
    log "INFO" "Recovering service: $container_name..."
    
    for i in $(seq 1 $RETRY_COUNT); do
        log "INFO" "Attempt $i/$RETRY_COUNT to start $container_name"
        docker start "$container_name" > /dev/null 2>&1
        
        sleep $RETRY_DELAY
        
        if check_service_health "$container_name"; then
            log "SUCCESS" "Service $container_name is now operational."
            return 0
        fi
    done
    
    log "ERROR" "Failed to recover service $container_name after $RETRY_COUNT attempts."
    return 1
}

log "INFO" "Starting NeMo recovery check..."

# 1. Infrastructure Layer (Pre-requisites)
INFRA_SERVICES=(
    "nemo-microservices-postgres-1"
    "nemo-microservices-minio-1"
    "nemo-microservices-openbao-1"
    "nemo-microservices-docker-1"
)

for service in "${INFRA_SERVICES[@]}"; do
    if ! check_service_health "$service"; then
        log "WARN" "Infastructure service $service is unhealthy or stopped."
        recover_service "$service"
    else
        log "DEBUG" "Infrastructure service $service is healthy."
    fi
done

# 2. Core Service Layer (Depends on Infra)
# Wait for infra to stay stable for a few seconds
sleep 2

CORE_SERVICES=(
    "nemo-microservices-datastore-1"
    "nemo-microservices-entity-store-1"
    "nemo-microservices-nmp-core-1"
    "nemo-microservices-fluentbit-1"
)

for service in "${CORE_SERVICES[@]}"; do
    if ! check_service_health "$service"; then
        log "WARN" "Core service $service is unhealthy or stopped."
        recover_service "$service"
    else
        log "DEBUG" "Core service $service is healthy."
    fi
done

# 3. Gateway & Application Layer
APP_SERVICES=(
    "nemo-microservices-envoy-gateway-1"
    "nemo-microservices-data-designer-1"
)

for service in "${APP_SERVICES[@]}"; do
    if ! check_service_health "$service"; then
        log "WARN" "Application service $service is unhealthy or stopped."
        recover_service "$service"
    else
        log "DEBUG" "Application service $service is healthy."
    fi
done

log "INFO" "NeMo recovery check completed."
docker ps -a --filter "name=nemo" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | tee -a "$LOG_FILE"

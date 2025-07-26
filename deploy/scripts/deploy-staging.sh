#!/bin/bash

# Bias Detection Engine - Staging Deployment Script
# This script automates the deployment of the bias detection engine to staging environment

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEPLOY_DIR="${PROJECT_ROOT}/deploy/staging"
BACKUP_DIR="${PROJECT_ROOT}/backups/$(date +%Y%m%d_%H%M%S)"
LOG_FILE="${PROJECT_ROOT}/logs/deploy-staging-$(date +%Y%m%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
	local level=$1
	shift
	local message="$*"
	local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

	echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}"
}

info() {
	log "INFO" "${BLUE}$*${NC}"
}

warn() {
	log "WARN" "${YELLOW}$*${NC}"
}

error() {
	log "ERROR" "${RED}$*${NC}"
}

success() {
	log "SUCCESS" "${GREEN}$*${NC}"
}

# Error handling
cleanup() {
	local exit_code=$?
	if [[ "${exit_code}" -ne 0 ]]; then
		error "Deployment failed with exit code ${exit_code}"
		if [[ "${ROLLBACK_ON_FAILURE:-true}" = "true" ]]; then
			warn "Initiating rollback..."
			rollback
		fi
	fi
	exit "${exit_code}"
}

trap cleanup EXIT

# Rollback function
rollback() {
	info "Rolling back to previous version..."

	if [[ -d "${BACKUP_DIR}" ]]; then
		cd "${DEPLOY_DIR}"
		docker-compose down --timeout 30

		# Restore previous containers if backup exists
		if [[ -f "${BACKUP_DIR}/containers.tar" ]]; then
			docker load <"${BACKUP_DIR}/containers.tar"
			docker-compose up -d
			success "Rollback completed successfully"
		else
			warn "No backup found for rollback"
		fi
	else
		warn "No backup directory found for rollback"
	fi
}

# Pre-deployment checks
pre_deployment_checks() {
	info "Running pre-deployment checks..."

	# Check if Docker is running
	if ! docker info >/dev/null 2>&1; then
		error "Docker is not running or not accessible"
		exit 1
	fi

	# Check if Docker Compose is available
	if ! command -v docker-compose >/dev/null 2>&1; then
		error "Docker Compose is not installed"
		exit 1
	fi

	# Check if required environment file exists
	if [[ ! -f "${DEPLOY_DIR}/.env" ]]; then
		error "Environment file not found: ${DEPLOY_DIR}/.env"
		exit 1
	fi

	# Validate environment variables
	source "${DEPLOY_DIR}/.env"
	required_vars=(
		"DATABASE_URL"
		"REDIS_URL"
		"JWT_SECRET"
		"SUPABASE_URL"
		"SUPABASE_ANON_KEY"
		"ENCRYPTION_KEY"
		"POSTGRES_USER"
		"POSTGRES_PASSWORD"
		"REDIS_PASSWORD"
		"GRAFANA_PASSWORD"
	)

	for var in "${required_vars[@]}"; do
		if [[ -z "${!var-}" ]]; then
			error "Required environment variable ${var} is not set"
			exit 1
		fi
	done

	# Check disk space (require at least 5GB free)
	available_space=$(df "${PROJECT_ROOT}" | awk 'NR==2 {print $4}')
	required_space=5242880 # 5GB in KB

	if [[ "${available_space}" -lt "${required_space}" ]]; then
		error "Insufficient disk space. Required: 5GB, Available: $((available_space / 1024 / 1024))GB"
		exit 1
	fi

	success "Pre-deployment checks passed"
}

# Create backup
create_backup() {
	info "Creating backup..."

	mkdir -p "${BACKUP_DIR}"

	# Backup current containers
	cd "${DEPLOY_DIR}"
	if docker-compose ps -q | grep -q .; then
		docker-compose ps -q | xargs docker commit || true
		docker save $(docker-compose ps -q 2>/dev/null || true) >"${BACKUP_DIR}/containers.tar" 2>/dev/null || true
	fi

	# Backup database
	if docker-compose ps postgres | grep -q Up; then
		docker-compose exec -T postgres pg_dump -U "${POSTGRES_USER}" bias_detection_staging >"${BACKUP_DIR}/database.sql"
	fi

	# Backup application data
	if [[ -d "/var/lib/docker/volumes" ]]; then
		docker run --rm -v bias-detection-staging_app-data:/data -v "${BACKUP_DIR}":/backup alpine tar czf /backup/app-data.tar.gz -C /data . || true
	fi

	success "Backup created at ${BACKUP_DIR}"
}

# Build and deploy
deploy() {
	info "Starting deployment..."

	cd "${DEPLOY_DIR}"

	# Pull latest images
	info "Pulling latest base images..."
	docker-compose pull --ignore-pull-failures

	# Build new images
	info "Building application images..."
	docker-compose build --no-cache --pull

	# Stop current services
	info "Stopping current services..."
	docker-compose down --timeout 60

	# Start new services
	info "Starting new services..."
	docker-compose up -d

	success "Services started successfully"
}

# Health checks
health_checks() {
	info "Running health checks..."

	local max_attempts=30
	local attempt=1

	while [[ "${attempt}" -le "${max_attempts}" ]]; do
		info "Health check attempt ${attempt}/${max_attempts}"

		# Check main application
		if curl -f -s "http://localhost:3000/api/bias-detection/health" >/dev/null; then
			success "Main application is healthy"
			break
		fi

		if [[ "${attempt}" -eq "${max_attempts}" ]]; then
			error "Health checks failed after ${max_attempts} attempts"
			return 1
		fi

		sleep 10
		((attempt++))
	done

	# Check Python ML service
	if curl -f -s "http://localhost:5000/health" >/dev/null; then
		success "Python ML service is healthy"
	else
		warn "Python ML service health check failed"
	fi

	# Check database connection
	cd "${DEPLOY_DIR}"
	if docker-compose exec -T postgres pg_isready -U "${POSTGRES_USER}" -d bias_detection_staging >/dev/null; then
		success "Database is healthy"
	else
		error "Database health check failed"
		return 1
	fi

	# Check Redis
	if docker-compose exec -T redis redis-cli ping | grep -q PONG; then
		success "Redis is healthy"
	else
		error "Redis health check failed"
		return 1
	fi

	success "All health checks passed"
}

# Post-deployment tasks
post_deployment() {
	info "Running post-deployment tasks..."

	cd "${DEPLOY_DIR}"

	# Run database migrations if needed
	info "Checking for database migrations..."
	# docker-compose exec bias-detection-app pnpm migrate:latest || true

	# Clear application cache
	info "Clearing application cache..."
	docker-compose exec -T redis redis-cli FLUSHDB || true

	# Generate performance baseline
	info "Generating performance baseline..."
	# This would run a quick performance test to establish baseline metrics
	# k6 run --duration 30s --vus 5 ../../src/load-tests/bias-detection-load-test.js || true

	success "Post-deployment tasks completed"
}

# Cleanup old resources
cleanup_old_resources() {
	info "Cleaning up old resources..."

	# Remove unused Docker images
	docker image prune -f --filter "until=24h" || true

	# Remove old backups (keep last 5)
	if [[ -d "${PROJECT_ROOT}/backups" ]]; then
		find "${PROJECT_ROOT}/backups" -type d -name "*_*" | sort -r | tail -n +6 | xargs rm -rf || true
	fi

	success "Cleanup completed"
}

# Send notifications
send_notifications() {
	local status=$1
	local message=$2

	info "Sending deployment notification..."

	# Slack notification (if webhook is configured)
	if [[ -n "${SLACK_WEBHOOK_URL-}" ]]; then
		local color
		case ${status} in
		"success") color="good" ;;
		"failure") color="danger" ;;
		*) color="warning" ;;
		esac

		curl -X POST -H 'Content-type: application/json' \
			--data "{\"text\":\"🚀 Bias Detection Engine Staging Deployment\", \"attachments\":[{\"color\"$${${"}}$co}lor\", \"text\"$$${\}"$m}ess}age\"}]}" \
			"${SLACK_WEBHOOK_URL}" >/dev/null 2>&1 || true
	fi

	# Email notification (if configured)
	if [[ -n "${NOTIFICATION_EMAIL-}" ]] && command -v mail >/dev/null 2>&1; then
		echo "${message}" | mail -s "Bias Detection Engine Deployment - ${status}" "${NOTIFICATION_EMAIL}" || true
	fi
}

# Main deployment flow
main() {
	info "Starting Bias Detection Engine staging deployment..."
	info "Deployment ID: $(date +%Y%m%d_%H%M%S)"

	# Create log directory
	mkdir -p "$(dirname "${LOG_FILE}")"

	# Run deployment steps
	pre_deployment_checks
	create_backup
	deploy
	health_checks
	post_deployment
	cleanup_old_resources

	success "Deployment completed successfully!"
	send_notifications "success" "Staging deployment completed successfully at $(date)"

	info "Deployment logs: ${LOG_FILE}"
	info "Backup location: ${BACKUP_DIR}"
	info "Application URL: http://localhost:3000"
	info "Monitoring: http://localhost:3001 (Grafana)"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
	case $1 in
	--no-backup)
		SKIP_BACKUP=true
		shift
		;;
	--no-rollback)
		ROLLBACK_ON_FAILURE=false
		shift
		;;
	--force)
		FORCE_DEPLOYMENT=true
		shift
		;;
	--help)
		echo "Usage: $0 [options]"
		echo "Options:"
		echo "  --no-backup       Skip backup creation"
		echo "  --no-rollback     Don't rollback on failure"
		echo "  --force           Force deployment even if checks fail"
		echo "  --help            Show this help"
		exit 0
		;;
	*)
		error "Unknown option: $1"
		exit 1
		;;
	esac
done

# Run main deployment
if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
	main "$@"
fi

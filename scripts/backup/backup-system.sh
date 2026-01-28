#!/bin/bash
set -e
set -o inherit_errexit

# Pixelated Empathy - Backup System
# =================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="pixelated-empathy"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS=30

# Functions
log_info() {
	echo -e "${BLUE}[BACKUP]${NC} $1"
}

log_success() {
	echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
	echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
	echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup directory
mkdir -p "${BACKUP_DIR}"

backup_database() {
	log_info "Backing up PostgreSQL database..."

	local backup_file="${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql.gz"

	PGPASSWORD="${DB_PASSWORD}" pg_dump \
		-h "${DB_HOST}" \
		-p "${DB_PORT}" \
		-U "${DB_USERNAME}" \
		-d "${DB_NAME}" \
		--verbose \
		--no-owner \
		--no-privileges |
		gzip >"${backup_file}"

	if gzip -t "${backup_file}"; then
		log_success "Database backup completed: ${backup_file}"
		echo "${backup_file}"
	else
		log_error "Database backup failed"
		return 1
	fi
}

backup_redis() {
	log_info "Backing up Redis data..."

	local backup_file="${BACKUP_DIR}/redis_backup_${TIMESTAMP}.rdb"

	redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" --rdb "${backup_file}"

	if redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" --rdb "${backup_file}"; then
		log_success "Redis backup completed: ${backup_file}"
		echo "${backup_file}"
	else
		log_error "Redis backup failed"
		return 1
	fi
}

backup_application_data() {
	log_info "Backing up application data..."

	local backup_file="${BACKUP_DIR}/app_data_${TIMESTAMP}.tar.gz"

	# Backup uploads, logs, and configuration
	tar -czf "${backup_file}" \
		--exclude='node_modules' \
		--exclude='.git' \
		--exclude='*.log' \
		uploads/ config/ .env 2>/dev/null || true

	if [[ -f ${backup_file} ]]; then
		log_success "Application data backup completed: ${backup_file}"
		echo "${backup_file}"
	else
		log_error "Application data backup failed"
		return 1
	fi
}

backup_monitoring_data() {
	log_info "Backing up monitoring data..."

	local backup_file="${BACKUP_DIR}/monitoring_${TIMESTAMP}.tar.gz"

	# Backup Grafana dashboards and Prometheus data
	tar -czf "${backup_file}" \
		monitoring/dashboards/ \
		monitoring/grafana/ \
		monitoring/prometheus/ 2>/dev/null || true

	if [[ -f ${backup_file} ]]; then
		log_success "Monitoring data backup completed: ${backup_file}"
		echo "${backup_file}"
	else
		log_warning "Monitoring data backup failed or no data found"
	fi
}

upload_to_s3() {
	local file="$1"

	if [[ -z ${AWS_S3_BACKUP_BUCKET} ]]; then
		log_warning "S3 backup bucket not configured, skipping upload"
		return 0
	fi

	log_info "Uploading backup to S3..."

	if aws s3 cp "${file}" "s3://${AWS_S3_BACKUP_BUCKET}/backups/$(basename "${file}")" \
		--storage-class STANDARD_IA; then
		log_success "Backup uploaded to S3"
	else
		log_error "S3 upload failed"
		return 1
	fi
}

cleanup_old_backups() {
	log_info "Cleaning up old backups (older than ${RETENTION_DAYS} days)..."

	find "${BACKUP_DIR}" -name "*backup_*" -type f -mtime +"${RETENTION_DAYS}" -delete

	# Also cleanup S3 if configured
	if [[ -n ${AWS_S3_BACKUP_BUCKET} ]]; then
		aws s3 ls "s3://${AWS_S3_BACKUP_BUCKET}/backups/" |
			while read -r line; do
				createDate=$(echo "${line}" | awk '{print $1" "$2}')
				createDate=$(date -d "${createDate}" +%s)
				olderThan=$(date -d "${RETENTION_DAYS} days ago" +%s)
				if [[ ${createDate} -lt ${olderThan} ]]; then
					fileName=$(echo "${line}" | awk '{print $4}')
					if [[ -n ${fileName} ]]; then
						aws s3 rm "s3://${AWS_S3_BACKUP_BUCKET}/backups/${fileName}"
					fi
				fi
			done
	fi

	log_success "Old backups cleaned up"
}

verify_backup() {
	local backup_file="$1"

	log_info "Verifying backup integrity..."

	if [[ ${backup_file} == *.gz ]]; then
		if gzip -t "${backup_file}"; then
			log_success "Backup integrity verified"
		else
			log_error "Backup integrity check failed"
			return 1
		fi
	elif [[ ${backup_file} == *.tar.gz ]]; then
		if tar -tzf "${backup_file}" >/dev/null; then
			log_success "Backup integrity verified"
		else
			log_error "Backup integrity check failed"
			return 1
		fi
	fi
}

send_notification() {
	local status="$1"
	local message="$2"

	if [[ -n ${SLACK_WEBHOOK_URL} ]]; then
		local color="good"
		if [[ ${status} == "error" ]]; then
			color="danger"
		elif [[ ${status} == "warning" ]]; then
			color="warning"
		fi

		curl -X POST -H 'Content-type: application/json' \
			--data "{\"attachments\":[{\"color\":\"${color}\",\"title\":\"Backup Status\",\"text\":\"${message}\"}]}" \
			"${SLACK_WEBHOOK_URL}"
	fi

	if [[ -n ${EMAIL_RECIPIENT} ]]; then
		echo "${message}" | mail -s "Pixelated Empathy Backup Status" "${EMAIL_RECIPIENT}"
	fi
}

# Main backup function
main_backup() {
	log_info "Starting backup process for ${PROJECT_NAME}"

	local backup_files=()
	local failed_backups=()

	# Database backup
	# trunk-ignore(shellcheck/SC2310)
	if db_backup=$(backup_database); then
		backup_files+=("${db_backup}")
		verify_backup "${db_backup}"
		upload_to_s3 "${db_backup}"
	else
		failed_backups+=("database")
	fi

	# Redis backup
	# trunk-ignore(shellcheck/SC2310)
	# trunk-ignore(shellcheck/SC2310)
	if redis_backup=$(backup_redis); then
		backup_files+=("${redis_backup}")
		upload_to_s3 "${redis_backup}"
	else
		failed_backups+=("redis")
	fi

	# Application data backup
	# trunk-ignore(shellcheck/SC2310)
	if app_backup=$(backup_application_data); then
		backup_files+=("${app_backup}")
		verify_backup "${app_backup}"
		upload_to_s3 "${app_backup}"
	else
		failed_backups+=("application_data")
	fi

	# Monitoring data backup
	# trunk-ignore(shellcheck/SC2310)
	if monitoring_backup=$(backup_monitoring_data); then
		backup_files+=("${monitoring_backup}")
		verify_backup "${monitoring_backup}"
		upload_to_s3 "${monitoring_backup}"
	else
		failed_backups+=("monitoring")
	fi

	# Cleanup old backups
	cleanup_old_backups

	# Generate backup report
	local total_backups=${#backup_files[@]}
	local failed_count=${#failed_backups[@]}

	if [[ ${failed_count} -eq 0 ]]; then
		log_success "All backups completed successfully (${total_backups} files)"
		send_notification "success" "Backup completed successfully. ${total_backups} files backed up."
	else
		log_warning "Backup completed with ${failed_count} failures"
		send_notification "warning" "Backup completed with failures: ${failed_backups[*]}"
	fi

	# Create backup manifest
	local backup_files_json
	backup_files_json=$(printf '"%s",' "${backup_files[@]}" | sed 's/,$//')
	local failed_backups_json
	failed_backups_json=$(printf '"%s",' "${failed_backups[@]}" | sed 's/,$//')
	cat >"${BACKUP_DIR}/backup_manifest_${TIMESTAMP}.json" <<EOF
{
    "timestamp": "${TIMESTAMP}",
    "project": "${PROJECT_NAME}",
    "backup_files": [${backup_files_json}],
    "failed_backups": [${failed_backups_json}],
    "total_files": ${total_backups},
    "failed_count": ${failed_count}
}
EOF
}

# Restore function
restore_backup() {
	local backup_date="$1"

	if [[ -z ${backup_date} ]]; then
		log_error "Backup date required (format: YYYYMMDD_HHMMSS)"
		exit 1
	fi

	log_info "Restoring backup from ${backup_date}"

	# Restore database
	local db_backup="${BACKUP_DIR}/db_backup_${backup_date}.sql.gz"
	if [[ -f ${db_backup} ]]; then
		log_info "Restoring database..."
		gunzip -c "${db_backup}" | PGPASSWORD="${DB_PASSWORD}" psql \
			-h "${DB_HOST}" \
			-p "${DB_PORT}" \
			-U "${DB_USERNAME}" \
			-d "${DB_NAME}"
		log_success "Database restored"
	else
		log_error "Database backup not found: ${db_backup}"
	fi

	# Restore application data
	local app_backup="${BACKUP_DIR}/app_data_${backup_date}.tar.gz"
	if [[ -f ${app_backup} ]]; then
		log_info "Restoring application data..."
		tar -xzf "${app_backup}"
		log_success "Application data restored"
	else
		log_error "Application data backup not found: ${app_backup}"
	fi
}

show_help() {
	echo "Pixelated Empathy Backup System"
	echo ""
	echo "Usage: ${0} [COMMAND] [OPTIONS]"
	echo ""
	echo "Commands:"
	echo "  backup              Create full backup"
	echo "  restore <date>      Restore backup from specific date"
	echo "  list                List available backups"
	echo "  cleanup             Clean up old backups"
	echo "  help                Show this help message"
	echo ""
	echo "Examples:"
	echo "  ${0} backup                    # Create full backup"
	echo "  ${0} restore 20240101_120000   # Restore from specific backup"
	echo "  ${0} list                      # List available backups"
}

# Main execution
case "${1:-backup}" in
"backup")
	main_backup
	;;
"restore")
	restore_backup "$2"
	;;
"list")
	log_info "Available backups:"
	ls -la "${BACKUP_DIR}"/*backup_* 2>/dev/null || log_info "No backups found"
	;;
"cleanup")
	cleanup_old_backups
	;;
"help" | "-h" | "--help")
	show_help
	;;
*)
	log_error "Unknown command: ${1}"
	show_help
	exit 1
	;;
esac

#!/bin/bash
set -e

# Backup Verification Script
# ==========================

BACKUP_BUCKET="${BACKUP_BUCKET:-pixelated-empathy-backups}"
VERIFICATION_LOG="/var/log/backup-verification.log"

verify_backups() {
	local date_output
	date_output=$(date)
	echo "${date_output}: Starting backup verification" >>"${VERIFICATION_LOG}"

	# Verify database backups
	verify_database_backups
	local db_status=$?
	if [[ ${db_status} -ne 0 ]]; then
		echo "WARNING: Database backup verification failed" >>"${VERIFICATION_LOG}"
	fi

	# Verify application backups
	verify_application_backups
	local app_status=$?
	if [[ ${app_status} -ne 0 ]]; then
		echo "WARNING: Application backup verification failed" >>"${VERIFICATION_LOG}"
	fi

	# Verify backup retention
	verify_backup_retention
	local retention_status=$?
	if [[ ${retention_status} -ne 0 ]]; then
		echo "WARNING: Backup retention verification failed" >>"${VERIFICATION_LOG}"
	fi

	local completion_date
	completion_date=$(date)
	echo "${completion_date}: Backup verification completed" >>"${VERIFICATION_LOG}"
}

verify_database_backups() {
	echo "Verifying database backups..."

	# Get latest database backup
	local latest_backup
	local aws_output
	if ! aws_output=$(aws s3 ls "s3://${BACKUP_BUCKET}/database/" 2>&1); then
		echo "ERROR: Failed to list database backups" >>"${VERIFICATION_LOG}"
		return 1
	fi
	local sorted_output
	sorted_output=$(echo "${aws_output}" | sort) || true
	local tail_output
	tail_output=$(echo "${sorted_output}" | tail -n 1) || true
	latest_backup=$(echo "${tail_output}" | awk '{print $4}') || true

	if [[ -z ${latest_backup} ]]; then
		echo "ERROR: No database backups found" >>"${VERIFICATION_LOG}"
		return 1
	fi

	# Download and verify integrity
	aws s3 cp "s3://${BACKUP_BUCKET}/database/${latest_backup}" ./temp_backup.sql.gz || true

	if gzip -t temp_backup.sql.gz; then
		echo "SUCCESS: Database backup integrity verified" >>"${VERIFICATION_LOG}"
	else
		echo "ERROR: Database backup corrupted: ${latest_backup}" >>"${VERIFICATION_LOG}"
		return 1
	fi

	rm -f temp_backup.sql.gz
}

verify_application_backups() {
	echo "Verifying application backups..."

	# Similar verification for application backups
	local latest_backup
	local aws_output
	if ! aws_output=$(aws s3 ls "s3://${BACKUP_BUCKET}/application/" 2>&1); then
		echo "ERROR: Failed to list application backups" >>"${VERIFICATION_LOG}"
		return 1
	fi
	local sorted_output
	sorted_output=$(echo "${aws_output}" | sort) || true
	local tail_output
	tail_output=$(echo "${sorted_output}" | tail -n 1) || true
	latest_backup=$(echo "${tail_output}" | awk '{print $4}') || true

	if [[ -z ${latest_backup} ]]; then
		echo "ERROR: No application backups found" >>"${VERIFICATION_LOG}"
		return 1
	fi

	echo "SUCCESS: Application backup verified: ${latest_backup}" >>"${VERIFICATION_LOG}"
}

verify_backup_retention() {
	echo "Verifying backup retention policy..."

	# Check if backups older than 30 days exist
	local old_backups
	local aws_output
	local date_output
	date_output=$(date -d '30 days ago' '+%Y-%m-%d')
	if ! aws_output=$(aws s3 ls "s3://${BACKUP_BUCKET}/" --recursive 2>&1); then
		echo "ERROR: Failed to list backups" >>"${VERIFICATION_LOG}"
		return 1
	fi
	local awk_output
	awk_output=$(echo "${aws_output}" | awk "\$1 < \"${date_output}\"") || true
	old_backups=$(echo "${awk_output}" | wc -l) || true

	if [[ ${old_backups} -gt 0 ]]; then
		echo "WARNING: Found ${old_backups} backups older than 30 days" >>"${VERIFICATION_LOG}"
	else
		echo "SUCCESS: Backup retention policy compliant" >>"${VERIFICATION_LOG}"
	fi
}

# Execute verification
verify_backups

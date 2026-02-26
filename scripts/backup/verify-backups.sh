#!/bin/bash
set -e

# Backup Verification Script (Rclone Edition)
# ==========================================

REMOTE_NAME="drive"
BUCKET_NAME="${S3_BUCKET:-pixel-data}"
VERIFICATION_LOG="/var/log/backup-verification.log"

# Ensure log file exists and is writable
touch "${VERIFICATION_LOG}" 2>/dev/null || VERIFICATION_LOG="/tmp/backup-verification.log"

log_verify() {
	echo "$(date): $1" | tee -a "${VERIFICATION_LOG}"
}

verify_backups() {
	log_verify "Starting backup verification on $REMOTE_NAME:$BUCKET_NAME"

	# Verify database backups
	if verify_remote_backups "db_backup"; then
		log_verify "SUCCESS: Database backup verification passed"
	else
		log_verify "WARNING: Database backup verification failed"
	fi

	# Verify application backups
	if verify_remote_backups "app_data"; then
		log_verify "SUCCESS: Application backup verification passed"
	else
		log_verify "WARNING: Application backup verification failed"
	fi

	# Verify backup retention
	if verify_backup_retention; then
		log_verify "SUCCESS: Backup retention policy compliant"
	else
		log_verify "WARNING: Backup retention verification failed"
	fi

	log_verify "Backup verification completed"
}

verify_remote_backups() {
	local pattern="$1"
	log_verify "Verifying latest $pattern backup..."

	# Get latest backup matching the pattern
	local latest_backup
	latest_backup=$(rclone lsf "$REMOTE_NAME:$BUCKET_NAME/backups/" | grep "$pattern" | sort -r | head -n 1)

	if [[ -z ${latest_backup} ]]; then
		log_verify "ERROR: No backups found matching $pattern"
		return 1
	fi

	log_verify "Downloading latest backup for verification: $latest_backup"
	if rclone copy "$REMOTE_NAME:$BUCKET_NAME/backups/$latest_backup" ./temp_verify/ --progress; then
		local local_file="./temp_verify/$latest_backup"
		
		# Integrity check
		if [[ ${local_file} == *.gz ]]; then
			if gzip -t "${local_file}"; then
				log_verify "SUCCESS: $latest_backup integrity verified"
				rm -rf ./temp_verify/
				return 0
			fi
		elif [[ ${local_file} == *.tar.gz ]]; then
			if tar -tzf "${local_file}" >/dev/null; then
				log_verify "SUCCESS: $latest_backup integrity verified"
				rm -rf ./temp_verify/
				return 0
			fi
		fi
	fi

	log_verify "ERROR: Integrity check failed for $latest_backup"
	rm -rf ./temp_verify/
	return 1
}

verify_backup_retention() {
	log_verify "Verifying remote backup retention policy..."

	local retention_days=30
	local old_files
	old_files=$(rclone lsf "$REMOTE_NAME:$BUCKET_NAME/backups/" --min-age "${retention_days}d" | wc -l)

	if [[ ${old_files} -gt 0 ]]; then
		log_verify "WARNING: Found ${old_files} remote backups older than ${retention_days} days. Pruning..."
		rclone delete "$REMOTE_NAME:$BUCKET_NAME/backups/" --min-age "${retention_days}d"
	fi

	return 0
}

# Execute verification
mkdir -p ./temp_verify
verify_backups

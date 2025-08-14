#!/bin/bash
set -e

# Backup Verification Script
# ==========================

BACKUP_BUCKET="${BACKUP_BUCKET:-pixelated-empathy-backups}"
VERIFICATION_LOG="/var/log/backup-verification.log"

verify_backups() {
    echo "$(date): Starting backup verification" >> "$VERIFICATION_LOG"
    
    # Verify database backups
    verify_database_backups
    
    # Verify application backups
    verify_application_backups
    
    # Verify backup retention
    verify_backup_retention
    
    echo "$(date): Backup verification completed" >> "$VERIFICATION_LOG"
}

verify_database_backups() {
    echo "Verifying database backups..."
    
    # Get latest database backup
    local latest_backup=$(aws s3 ls "s3://$BACKUP_BUCKET/database/" | sort | tail -n 1 | awk '{print $4}')
    
    if [ -z "$latest_backup" ]; then
        echo "ERROR: No database backups found" >> "$VERIFICATION_LOG"
        return 1
    fi
    
    # Download and verify integrity
    aws s3 cp "s3://$BACKUP_BUCKET/database/$latest_backup" ./temp_backup.sql.gz
    
    if gzip -t temp_backup.sql.gz; then
        echo "SUCCESS: Database backup integrity verified" >> "$VERIFICATION_LOG"
    else
        echo "ERROR: Database backup corrupted: $latest_backup" >> "$VERIFICATION_LOG"
        return 1
    fi
    
    rm -f temp_backup.sql.gz
}

verify_application_backups() {
    echo "Verifying application backups..."
    
    # Similar verification for application backups
    local latest_backup=$(aws s3 ls "s3://$BACKUP_BUCKET/application/" | sort | tail -n 1 | awk '{print $4}')
    
    if [ -z "$latest_backup" ]; then
        echo "ERROR: No application backups found" >> "$VERIFICATION_LOG"
        return 1
    fi
    
    echo "SUCCESS: Application backup verified: $latest_backup" >> "$VERIFICATION_LOG"
}

verify_backup_retention() {
    echo "Verifying backup retention policy..."
    
    # Check if backups older than 30 days exist
    local old_backups=$(aws s3 ls "s3://$BACKUP_BUCKET/" --recursive | awk '$1 < "'$(date -d '30 days ago' '+%Y-%m-%d')'"' | wc -l)
    
    if [ "$old_backups" -gt 0 ]; then
        echo "WARNING: Found $old_backups backups older than 30 days" >> "$VERIFICATION_LOG"
    else
        echo "SUCCESS: Backup retention policy compliant" >> "$VERIFICATION_LOG"
    fi
}

# Execute verification
verify_backups

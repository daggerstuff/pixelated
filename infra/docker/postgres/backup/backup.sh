#!/bin/bash
# Pixelated Empathy - PostgreSQL Emergency Backup Script
# This script creates emergency backups of all databases with point-in-time recovery capability

set -euo pipefail

# Configuration
BACKUP_ROOT="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"
LOG_FILE="/var/log/postgres_backup.log"

# Database connection details
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-pixelated}"
DB_PASSWORD="${POSTGRES_PASSWORD:-dev_password_change_in_prod}"

# Backup retention (days)
RETENTION_DAYS=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    echo -e "${RED}ERROR: $1${NC}" >&2
    log "ERROR: $1"
    exit 1
}

# Success message
success() {
    echo -e "${GREEN}SUCCESS: $1${NC}"
    log "SUCCESS: $1"
}

# Warning message
warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
    log "WARNING: $1"
}

# Create backup directory
create_backup_dir() {
    log "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR" || error_exit "Failed to create backup directory"

    # Create subdirectories for different backup types
    mkdir -p "$BACKUP_DIR/schemas"
    mkdir -p "$BACKUP_DIR/data"
    mkdir -p "$BACKUP_DIR/logs"
}

# Test database connectivity
test_db_connection() {
    log "Testing database connectivity..."

    # Set PGPASSWORD environment variable for authentication
    export PGPASSWORD="$DB_PASSWORD"

    # Test connection
    if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -t 10; then
        error_exit "Cannot connect to PostgreSQL database"
    fi

    success "Database connectivity test passed"
}

# Get list of databases to backup
get_databases() {
    log "Getting list of databases to backup..."

    export PGPASSWORD="$DB_PASSWORD"

    # Get all databases except system databases
    DATABASES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -t -c \
        "SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres');" | \
        sed '/^$/d' | sed 's/^[ \t]*//;s/[ \t]*$//')

    if [ -z "$DATABASES" ]; then
        warning "No user databases found to backup"
        return 1
    fi

    log "Databases to backup: $DATABASES"
    echo "$DATABASES"
}

# Create schema-only backup
backup_schemas() {
    local db="$1"
    log "Creating schema backup for database: $db"

    export PGPASSWORD="$DB_PASSWORD"

    # Create schema-only backup (no data)
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        --schema-only \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists \
        --verbose \
        -f "$BACKUP_DIR/schemas/${db}_schema.sql" \
        "$db" 2>> "$BACKUP_DIR/logs/${db}_schema.log"

    if [ $? -eq 0 ]; then
        success "Schema backup completed for $db"
    else
        error_exit "Schema backup failed for $db"
    fi
}

# Create full data backup
backup_data() {
    local db="$1"
    log "Creating data backup for database: $db"

    export PGPASSWORD="$DB_PASSWORD"

    # Create compressed data backup
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists \
        --compress=9 \
        --format=custom \
        --verbose \
        -f "$BACKUP_DIR/data/${db}_data.dump" \
        "$db" 2>> "$BACKUP_DIR/logs/${db}_data.log"

    if [ $? -eq 0 ]; then
        success "Data backup completed for $db"
    else
        error_exit "Data backup failed for $db"
    fi
}

# Create point-in-time recovery backup
backup_wal() {
    log "Creating WAL archive for point-in-time recovery..."

    export PGPASSWORD="$DB_PASSWORD"

    # Create base backup for PITR
    pg_basebackup -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        -D "$BACKUP_DIR/wal_base" \
        -F tar \
        -z \
        -P \
        --wal-method=stream \
        --write-recovery-conf 2>> "$BACKUP_DIR/logs/wal_base.log"

    if [ $? -eq 0 ]; then
        success "WAL base backup completed for PITR"
    else
        warning "WAL base backup failed - PITR may not be available"
    fi
}

# Create backup manifest
create_manifest() {
    local databases="$1"
    log "Creating backup manifest..."

    cat > "$BACKUP_DIR/BACKUP_MANIFEST.txt" << EOF
Pixelated Empathy Database Backup Manifest
==========================================

Backup Timestamp: $TIMESTAMP
Backup Directory: $BACKUP_DIR
Server: $DB_HOST:$DB_PORT
User: $DB_USER

Databases Backed Up:
$(echo "$databases" | sed 's/^/- /')

Backup Contents:
- schemas/: Schema-only backups (SQL format)
- data/: Full data backups (Custom compressed format)
- wal_base/: Base backup for Point-in-Time Recovery (if available)
- logs/: Backup operation logs

Restoration Instructions:
1. Ensure PostgreSQL is running
2. Create target databases if they don't exist
3. Restore schemas: psql -f schemas/<db>_schema.sql <target_db>
4. Restore data: pg_restore -d <target_db> data/<db>_data.dump
5. For PITR: Follow PostgreSQL documentation for WAL recovery

Backup created by: $(whoami)@$(hostname)
System: $(uname -a)
EOF

    success "Backup manifest created"
}

# Clean up old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."

    # Find and remove old backup directories
    find "$BACKUP_ROOT" -maxdepth 1 -type d -name "20*" -mtime +$RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null || true

    local cleaned_count=$(find "$BACKUP_ROOT" -maxdepth 1 -type d -name "20*" -mtime +$RETENTION_DAYS | wc -l)
    if [ "$cleaned_count" -gt 0 ]; then
        success "Cleaned up $cleaned_count old backup(s)"
    else
        log "No old backups to clean up"
    fi
}

# Calculate backup statistics
calculate_stats() {
    log "Calculating backup statistics..."

    local total_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    local schema_count=$(find "$BACKUP_DIR/schemas" -name "*.sql" 2>/dev/null | wc -l)
    local data_count=$(find "$BACKUP_DIR/data" -name "*.dump" 2>/dev/null | wc -l)

    cat >> "$BACKUP_DIR/BACKUP_MANIFEST.txt" << EOF

Backup Statistics:
==================
Total Backup Size: $total_size
Schema Files: $schema_count
Data Files: $data_count
Duration: $(($(date +%s) - START_TIME)) seconds
EOF

    success "Backup statistics calculated"
}

# Main backup function
main() {
    log "=== Starting Pixelated Empathy Database Backup ==="
    START_TIME=$(date +%s)

    # Validate environment
    if [ -z "$DB_PASSWORD" ]; then
        error_exit "Database password not set. Please set POSTGRES_PASSWORD environment variable."
    fi

    # Create backup directory
    create_backup_dir

    # Test database connectivity
    test_db_connection

    # Get databases to backup
    DATABASES=$(get_databases)
    if [ $? -ne 0 ]; then
        warning "No databases to backup, but continuing with WAL backup if possible"
    fi

    # Backup each database
    if [ -n "$DATABASES" ]; then
        for db in $DATABASES; do
            log "--- Processing database: $db ---"
            backup_schemas "$db"
            backup_data "$db"
        done
    fi

    # Create WAL backup for PITR (optional)
    backup_wal

    # Create backup manifest
    create_manifest "$DATABASES"

    # Calculate statistics
    calculate_stats

    # Clean up old backups
    cleanup_old_backups

    local duration=$(($(date +%s) - START_TIME))
    success "=== Database backup completed successfully in ${duration}s ==="
    success "Backup location: $BACKUP_DIR"
    success "Total size: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)"

    # Print important information
    echo ""
    echo "=== BACKUP SUMMARY ==="
    echo "Location: $BACKUP_DIR"
    echo "Databases: $(echo "$DATABASES" | wc -w)"
    echo "Size: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)"
    echo "Duration: ${duration}s"
    echo ""
    echo "=== EMERGENCY RECOVERY ==="
    echo "If you need to restore from this backup:"
    echo "1. Stop the application"
    echo "2. Run: docker/postgres/backup/restore.sh $TIMESTAMP"
    echo "3. Start the application"
    echo ""
}

# Run main function
main "$@"
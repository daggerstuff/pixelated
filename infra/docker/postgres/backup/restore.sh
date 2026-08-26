#!/bin/bash
# Pixelated Empathy - PostgreSQL Emergency Restore Script
# This script restores databases from emergency backups

set -euo pipefail

# Configuration
BACKUP_ROOT="/backups"
LOG_FILE="/var/log/postgres_restore.log"

# Database connection details
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-pixelated}"
DB_PASSWORD="${POSTGRES_PASSWORD:-dev_password_change_in_prod}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Info message
info() {
    echo -e "${BLUE}INFO: $1${NC}"
    log "INFO: $1"
}

# Test database connectivity
test_db_connection() {
    log "Testing database connectivity..."

    export PGPASSWORD="$DB_PASSWORD"

    if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -t 10; then
        error_exit "Cannot connect to PostgreSQL database"
    fi

    success "Database connectivity test passed"
}

# List available backups
list_backups() {
    echo "Available backups:"
    echo "=================="

    if [ ! -d "$BACKUP_ROOT" ]; then
        error_exit "Backup directory $BACKUP_ROOT does not exist"
    fi

    local count=0
    for backup_dir in "$BACKUP_ROOT"/20*/; do
        if [ -d "$backup_dir" ] && [ -f "$backup_dir/BACKUP_MANIFEST.txt" ]; then
            echo "$(basename "$backup_dir") - $(stat -c%s "$backup_dir" | numfmt --to=iec-i --suffix=B)"
            ((count++))
        fi
    done

    if [ $count -eq 0 ]; then
        error_exit "No valid backups found in $BACKUP_ROOT"
    fi
}

# Validate backup directory
validate_backup() {
    local backup_timestamp="$1"
    local backup_dir="$BACKUP_ROOT/$backup_timestamp"

    if [ ! -d "$backup_dir" ]; then
        error_exit "Backup directory $backup_dir does not exist"
    fi

    if [ ! -f "$backup_dir/BACKUP_MANIFEST.txt" ]; then
        error_exit "Backup manifest not found in $backup_dir"
    fi

    if [ ! -d "$backup_dir/schemas" ] || [ ! -d "$backup_dir/data" ]; then
        error_exit "Backup directory structure is incomplete"
    fi

    success "Backup validation passed for $backup_timestamp"
}

# Show backup manifest
show_manifest() {
    local backup_timestamp="$1"
    local backup_dir="$BACKUP_ROOT/$backup_timestamp"

    echo ""
    echo "=== BACKUP MANIFEST ==="
    echo "Backup: $backup_timestamp"
    echo "Location: $backup_dir"
    echo ""
    cat "$backup_dir/BACKUP_MANIFEST.txt"
    echo ""
}

# Create databases if they don't exist
create_databases() {
    local backup_dir="$1"

    log "Checking for databases to create..."

    export PGPASSWORD="$DB_PASSWORD"

    # Get list of databases from schema files
    for schema_file in "$backup_dir/schemas"/*_schema.sql; do
        if [ -f "$schema_file" ]; then
            db_name=$(basename "$schema_file" _schema.sql)

            # Check if database exists
            if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -t -c \
                "SELECT 1 FROM pg_database WHERE datname = '$db_name';" | grep -q 1; then

                log "Creating database: $db_name"
                psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
                    "CREATE DATABASE $db_name;" 2>> "$LOG_FILE"

                if [ $? -eq 0 ]; then
                    success "Database $db_name created"
                else
                    error_exit "Failed to create database $db_name"
                fi
            else
                warning "Database $db_name already exists"
            fi
        fi
    done
}

# Restore database schema
restore_schema() {
    local backup_dir="$1"
    local db_name="$2"

    local schema_file="$backup_dir/schemas/${db_name}_schema.sql"

    if [ ! -f "$schema_file" ]; then
        warning "Schema file not found for database $db_name"
        return 1
    fi

    log "Restoring schema for database: $db_name"

    export PGPASSWORD="$DB_PASSWORD"

    # Restore schema (this will drop existing objects and recreate them)
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        -d "$db_name" \
        -f "$schema_file" \
        2>> "$LOG_FILE"

    if [ $? -eq 0 ]; then
        success "Schema restored for $db_name"
    else
        error_exit "Schema restore failed for $db_name"
    fi
}

# Restore database data
restore_data() {
    local backup_dir="$1"
    local db_name="$2"

    local data_file="$backup_dir/data/${db_name}_data.dump"

    if [ ! -f "$data_file" ]; then
        warning "Data file not found for database $db_name"
        return 1
    fi

    log "Restoring data for database: $db_name"

    export PGPASSWORD="$DB_PASSWORD"

    # Restore data using pg_restore
    pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        -d "$db_name" \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists \
        --verbose \
        "$data_file" \
        2>> "$LOG_FILE"

    if [ $? -eq 0 ]; then
        success "Data restored for $db_name"
    else
        error_exit "Data restore failed for $db_name"
    fi
}

# Restore all databases
restore_all_databases() {
    local backup_dir="$1"

    log "Starting restore of all databases..."

    # Get list of databases from schema files
    for schema_file in "$backup_dir/schemas"/*_schema.sql; do
        if [ -f "$schema_file" ]; then
            db_name=$(basename "$schema_file" _schema.sql)

            log "--- Restoring database: $db_name ---"

            # Restore schema first
            restore_schema "$backup_dir" "$db_name"

            # Then restore data
            restore_data "$backup_dir" "$db_name"
        fi
    done
}

# Restore specific database
restore_single_database() {
    local backup_dir="$1"
    local db_name="$2"

    log "Restoring single database: $db_name"

    # Restore schema first
    restore_schema "$backup_dir" "$db_name"

    # Then restore data
    restore_data "$backup_dir" "$db_name"
}

# Verify restore
verify_restore() {
    local backup_dir="$1"

    log "Verifying restore..."

    export PGPASSWORD="$DB_PASSWORD"

    # Get list of restored databases
    for schema_file in "$backup_dir/schemas"/*_schema.sql; do
        if [ -f "$schema_file" ]; then
            db_name=$(basename "$schema_file" _schema.sql)

            # Test connection to database
            if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db_name" -c "SELECT 1;" &>/dev/null; then
                success "Database $db_name is accessible"

                # Get basic statistics
                table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db_name" -t -c \
                    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
                success "Database $db_name has $table_count tables"
            else
                error_exit "Database $db_name is not accessible after restore"
            fi
        fi
    done
}

# Main restore function
main() {
    echo ""
    echo "=== Pixelated Empathy Database Restore ==="
    echo ""

    # Check arguments
    if [ $# -lt 1 ]; then
        echo "Usage: $0 <backup_timestamp> [database_name]"
        echo ""
        echo "Examples:"
        echo "  $0 20231201_143022           # Restore all databases"
        echo "  $0 20231201_143022 pixelated_bias  # Restore specific database"
        echo ""
        list_backups
        exit 1
    fi

    local backup_timestamp="$1"
    local specific_db="${2:-}"

    # Validate environment
    if [ -z "$DB_PASSWORD" ]; then
        error_exit "Database password not set. Please set POSTGRES_PASSWORD environment variable."
    fi

    # Validate backup
    validate_backup "$backup_timestamp"
    local backup_dir="$BACKUP_ROOT/$backup_timestamp"

    # Show manifest
    show_manifest "$backup_timestamp"

    # Confirm restore
    echo ""
    echo -e "${YELLOW}WARNING: This will overwrite existing databases!${NC}"
    if [ -n "$specific_db" ]; then
        echo "This will restore database: $specific_db"
    else
        echo "This will restore ALL databases from the backup"
    fi
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "Restore cancelled."
        exit 0
    fi

    log "=== Starting database restore ==="
    local start_time=$(date +%s)

    # Test database connectivity
    test_db_connection

    # Create databases if needed
    create_databases "$backup_dir"

    # Perform restore
    if [ -n "$specific_db" ]; then
        restore_single_database "$backup_dir" "$specific_db"
    else
        restore_all_databases "$backup_dir"
    fi

    # Verify restore
    verify_restore "$backup_dir"

    local duration=$(($(date +%s) - start_time))
    success "=== Database restore completed successfully in ${duration}s ==="

    # Print completion message
    echo ""
    echo "=== RESTORE COMPLETED ==="
    echo "Databases have been restored from: $backup_timestamp"
    echo "Duration: ${duration}s"
    echo ""
    echo "Next steps:"
    echo "1. Verify application functionality"
    echo "2. Check logs for any issues"
    echo "3. Update application configuration if needed"
    echo ""

    log "=== Restore process completed ==="
}

# Handle special commands
case "${1:-}" in
    "--list"|"-l")
        list_backups
        exit 0
        ;;
    "--help"|"-h")
        echo "Usage: $0 <backup_timestamp> [database_name]"
        echo ""
        echo "Commands:"
        echo "  --list, -l    List available backups"
        echo "  --help, -h    Show this help"
        echo ""
        echo "Examples:"
        echo "  $0 20231201_143022           # Restore all databases"
        echo "  $0 20231201_143022 pixelated_bias  # Restore specific database"
        echo "  $0 --list                     # List available backups"
        exit 0
        ;;
esac

# Run main function
main "$@"
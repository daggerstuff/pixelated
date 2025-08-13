#!/bin/bash

# Deployment Rollback Script
# ==========================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[ROLLBACK]${NC} $1"
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

# Configuration
BACKUP_DIR="./deployment-backups"
COMPOSE_FILE="docker-compose.yml"

create_backup() {
    log_info "Creating deployment backup..."
    
    mkdir -p "$BACKUP_DIR"
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="$BACKUP_DIR/backup_$timestamp.tar.gz"
    
    # Backup current deployment
    tar -czf "$backup_file" \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=logs \
        . || {
        log_error "Failed to create backup"
        return 1
    }
    
    log_success "Backup created: $backup_file"
    echo "$backup_file"
}

list_backups() {
    log_info "Available backups:"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log_warning "No backup directory found"
        return 1
    fi
    
    local backups=($(ls -t "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null || true))
    
    if [ ${#backups[@]} -eq 0 ]; then
        log_warning "No backups found"
        return 1
    fi
    
    for i in "${!backups[@]}"; do
        local backup="${backups[$i]}"
        local basename=$(basename "$backup")
        local timestamp=$(echo "$basename" | sed 's/backup_\(.*\)\.tar\.gz/\1/')
        local readable_date=$(date -d "${timestamp:0:8} ${timestamp:9:2}:${timestamp:11:2}:${timestamp:13:2}" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$timestamp")
        echo "  $((i+1)). $basename ($readable_date)"
    done
}

rollback_to_backup() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi
    
    log_info "Rolling back to backup: $(basename "$backup_file")"
    
    # Stop current services
    log_info "Stopping current services..."
    docker-compose down || true
    
    # Create current state backup before rollback
    local current_backup=$(create_backup)
    log_info "Current state backed up to: $current_backup"
    
    # Extract backup
    log_info "Extracting backup..."
    tar -xzf "$backup_file" || {
        log_error "Failed to extract backup"
        return 1
    }
    
    # Start services
    log_info "Starting services from backup..."
    docker-compose up -d || {
        log_error "Failed to start services after rollback"
        return 1
    }
    
    # Health check
    sleep 10
    if ./scripts/deployment-health-check.sh; then
        log_success "Rollback completed successfully"
    else
        log_warning "Rollback completed but health check failed"
    fi
}

rollback_previous() {
    log_info "Rolling back to previous deployment..."
    
    local backups=($(ls -t "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null || true))
    
    if [ ${#backups[@]} -eq 0 ]; then
        log_error "No backups available for rollback"
        return 1
    fi
    
    rollback_to_backup "${backups[0]}"
}

show_help() {
    echo "Deployment Rollback Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  backup              Create a backup of current deployment"
    echo "  list                List available backups"
    echo "  rollback [FILE]     Rollback to specific backup file"
    echo "  previous            Rollback to previous deployment"
    echo "  help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 backup                                    # Create backup"
    echo "  $0 list                                      # List backups"
    echo "  $0 rollback ./deployment-backups/backup_*.tar.gz  # Rollback to specific backup"
    echo "  $0 previous                                  # Rollback to previous"
}

# Main execution
case "${1:-help}" in
    "backup")
        create_backup
        ;;
    "list")
        list_backups
        ;;
    "rollback")
        if [ -n "$2" ]; then
            rollback_to_backup "$2"
        else
            log_error "Please specify backup file"
            show_help
            exit 1
        fi
        ;;
    "previous")
        rollback_previous
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
#!/bin/bash

# Backup Manager Component
# Handles intelligent backup creation, preservation, archiving, and rollback command generation
# Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 7.1, 7.2, 7.3

# Configuration
BACKUP_BASE_DIR="${BACKUP_BASE_DIR:-/root}"
PROJECT_DIR="${PROJECT_DIR:-/root/pixelated}"
BACKUP_CURRENT_NAME="pixelated-backup"
BACKUP_ARCHIVE_PREFIX="pixelated-backup"
MAX_BACKUPS=3
BACKUP_METADATA_FILE="${BACKUP_BASE_DIR}/.backup_metadata.json"
TEST_MODE="${TEST_MODE:-false}" # Skip service management in test mode

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${GREEN}[BACKUP]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[BACKUP WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[BACKUP ERROR]${NC} $1"; }
log_debug() { echo -e "${BLUE}[BACKUP DEBUG]${NC} $1"; }

# Generate timestamp for backup naming
generate_timestamp() {
	date +"%Y%m%d_%H%M%S"
}

# Generate commit hash for backup metadata
get_current_commit_hash() {
	if [[ -d "${PROJECT_DIR}/.git" ]]; then
		if cd "${PROJECT_DIR}" 2>/dev/null; then
			git rev-parse --short HEAD 2>/dev/null || echo "unknown"
		else
			echo "unknown"
		fi
	else
		echo "no-git"
	fi
}

# Initialize backup metadata file
init_backup_metadata() {
	if [[ ! -f ${BACKUP_METADATA_FILE} ]]; then
		log_info "Initializing backup metadata file at ${BACKUP_METADATA_FILE}"

		# Create directory if it doesn't exist
		local metadata_dir
		metadata_dir=$(dirname "${BACKUP_METADATA_FILE}")
		if [[ ! -d ${metadata_dir} ]]; then
			mkdir -p "${metadata_dir}" 2>/dev/null || {
				log_error "Cannot create metadata directory: ${metadata_dir}"
				return 1
			}
		fi

		# Create metadata file
		if ! cat >"${BACKUP_METADATA_FILE}" <<'EOF'; then
{
  "current_backup": null,
  "archived_backups": [],
  "last_deployment": null,
  "backup_count": 0
}
EOF
			log_error "Cannot create metadata file: ${BACKUP_METADATA_FILE}"
			return 1
		fi
		log_debug "Metadata file created successfully"
	fi
}

# Read backup metadata
read_backup_metadata() {
	if ! init_backup_metadata; then
		log_error "Failed to initialize backup metadata"
		echo '{"current_backup": null, "archived_backups": [], "last_deployment": null, "backup_count": 0}'
		return 1
	fi

	if [[ -r ${BACKUP_METADATA_FILE} ]]; then
		cat "${BACKUP_METADATA_FILE}"
	else
		log_error "Cannot read metadata file: ${BACKUP_METADATA_FILE}"
		echo '{"current_backup": null, "archived_backups": [], "last_deployment": null, "backup_count": 0}'
		return 1
	fi
}

# Update backup metadata
update_backup_metadata() {
	local metadata="$1"

	# Validate JSON before writing
	if echo "${metadata}" | jq . >/dev/null 2>&1; then
		echo "${metadata}" >"${BACKUP_METADATA_FILE}"
		log_debug "Updated backup metadata"
	else
		log_error "Invalid JSON metadata, not updating file"
		log_debug "Attempted to write: ${metadata}"
		return 1
	fi
}

# Add backup entry to metadata
add_backup_to_metadata() {
	local backup_path="$1"
	local backup_type="$2" # "current" or "archived"
	local commit_hash="$3"
	local timestamp="$4"

	local metadata
	if ! metadata=$(read_backup_metadata); then
		log_error "Failed to read backup metadata"
		return 1
	fi

	local new_entry
	new_entry="{
        \"path\": \"${backup_path}\",
        \"type\": \"${backup_type}\",
        \"commit_hash\": \"${commit_hash}\",
        \"timestamp\": \"${timestamp}\",
        \"created_at\": \"$(date -Iseconds)\"
    }"

	# Validate new entry JSON
	if ! echo "${new_entry}" | jq . >/dev/null 2>&1; then
		log_error "Invalid JSON in new backup entry"
		return 1
	fi

	if [[ ${backup_type} == "current" ]]; then
		if ! metadata=$(echo "${metadata}" | jq --argjson entry "${new_entry}" '.current_backup = $entry' 2>/dev/null); then
			log_error "Failed to update metadata with jq"
			return 1
		fi
	else
		if ! metadata=$(echo "${metadata}" | jq --argjson entry "${new_entry}" '.archived_backups += [$entry] | .backup_count = (.archived_backups | length)' 2>/dev/null); then
			log_error "Failed to update metadata with jq"
			return 1
		fi
	fi

	update_backup_metadata "${metadata}"
}

# Remove backup entry from metadata
remove_backup_from_metadata() {
	local backup_path="$1"
	local metadata
	metadata=$(read_backup_metadata)

	# Remove from archived backups
	metadata=$(echo "${metadata}" | jq --arg path "${backup_path}" '.archived_backups = (.archived_backups | map(select(.path != $path))) | .backup_count = (.archived_backups | length)')

	# Clear current backup if it matches
	metadata=$(echo "${metadata}" | jq --arg path "${backup_path}" 'if .current_backup.path == $path then .current_backup = null else . end')

	update_backup_metadata "${metadata}"
}

# Preserve current backup until deployment verification
# Requirements: 3.1, 3.2
preserve_current_backup() {
	log_info "Preserving current backup until deployment verification"

	local current_backup_path="${BACKUP_BASE_DIR}/${BACKUP_CURRENT_NAME}"

	# Check if project directory exists
	if [[ ! -d ${PROJECT_DIR} ]]; then
		log_warning "Project directory ${PROJECT_DIR} does not exist, nothing to preserve"
		return 0
	fi

	# Check if current backup already exists
	if [[ -d ${current_backup_path} ]]; then
		log_info "Current backup already exists at ${current_backup_path}"

		# Check if it's from a previous deployment that wasn't verified
		local metadata
		metadata=$(read_backup_metadata)
		local current_backup_info
		current_backup_info=$(echo "${metadata}" | jq -r '.current_backup')

		if [[ ${current_backup_info} != "null" ]]; then
			log_info "Previous backup found, will be preserved until new deployment is verified"
			return 0
		fi
	fi

	# Create new backup by moving current project
	log_info "Creating backup of current project at ${current_backup_path}"

	# Stop services before backup (skip in test mode)
	if [[ ${TEST_MODE} != "true" ]]; then
		log_info "Stopping services for safe backup creation"
		systemctl stop caddy 2>/dev/null || log_warning "Could not stop caddy (may not be running)"
		docker stop pixelated-app 2>/dev/null || log_warning "Could not stop pixelated-app container (may not be running)"
	else
		log_debug "Skipping service management (test mode)"
	fi

	# Remove existing backup if it exists
	if [[ -d ${current_backup_path} ]]; then
		log_info "Removing existing backup directory"
		rm -rf "${current_backup_path}"
	fi

	# Move current project to backup location
	if mv "${PROJECT_DIR}" "${current_backup_path}"; then
		local commit_hash
		commit_hash=$(get_current_commit_hash)
		local timestamp
		timestamp=$(generate_timestamp)

		add_backup_to_metadata "${current_backup_path}" "current" "${commit_hash}" "${timestamp}"
		log_info "✅ Current backup preserved successfully"
		log_info "Backup location: ${current_backup_path}"
		log_info "Commit hash: ${commit_hash}"
		return 0
	else
		log_error "❌ Failed to preserve current backup"
		return 1
	fi
}

# Archive current backup with timestamp-based naming
# Requirements: 3.3, 3.4
archive_current_backup() {
	log_info "Archiving current backup with timestamp-based naming"

	local current_backup_path="${BACKUP_BASE_DIR}/${BACKUP_CURRENT_NAME}"

	# Check if current backup exists
	if [[ ! -d ${current_backup_path} ]]; then
		log_warning "No current backup to archive at ${current_backup_path}"
		return 0
	fi

	# Generate timestamped archive name
	local timestamp
	timestamp=$(generate_timestamp)
	local commit_hash
	commit_hash=$(get_current_commit_hash)
	local archive_name="${BACKUP_ARCHIVE_PREFIX}_${timestamp}_${commit_hash}"
	local archive_path="${BACKUP_BASE_DIR}/${archive_name}"

	log_info "Archiving backup to: ${archive_path}"

	# Move current backup to timestamped archive
	if mv "${current_backup_path}" "${archive_path}"; then
		# Update metadata
		remove_backup_from_metadata "${current_backup_path}"
		add_backup_to_metadata "${archive_path}" "archived" "${commit_hash}" "${timestamp}"

		log_info "✅ Backup archived successfully as ${archive_name}"

		# Clean up old backups if we exceed the limit
		cleanup_old_backups

		return 0
	else
		log_error "❌ Failed to archive current backup"
		return 1
	fi
}

# Clean up old backups to maintain retention policy
# Requirements: 3.4
cleanup_old_backups() {
	log_info "Cleaning up old backups (maintaining up to ${MAX_BACKUPS} backups)"

	local metadata
	metadata=$(read_backup_metadata)
	local backup_count
	backup_count=$(echo "${metadata}" | jq -r '.backup_count')

	if [[ ${backup_count} -le ${MAX_BACKUPS} ]]; then
		log_info "Backup count (${backup_count}) within limit (${MAX_BACKUPS}), no cleanup needed"
		return 0
	fi

	log_info "Backup count (${backup_count}) exceeds limit (${MAX_BACKUPS}), cleaning up oldest backups"

	# Get sorted list of archived backups (oldest first)
	local backups_to_remove
	backups_to_remove=$(
		echo "${metadata}" | jq -r --arg max "${MAX_BACKUPS}" '
        .archived_backups 
        | sort_by(.timestamp) 
        | .[0:(length - ($max | tonumber))] 
        | .[].path'
	)

	# Remove oldest backups
	while IFS= read -r backup_path; do
		if [[ -n ${backup_path} && ${backup_path} != "null" ]]; then
			log_info "Removing old backup: ${backup_path}"

			if rm -rf "${backup_path}"; then
				remove_backup_from_metadata "${backup_path}"
				log_info "✅ Removed old backup: $(basename "${backup_path}")"
			else
				log_error "❌ Failed to remove old backup: ${backup_path}"
			fi
		fi
	done <<<"${backups_to_remove}"

	# Check disk space and provide warnings
	check_disk_space_warnings
}

# Check disk space and provide warnings for space-limited scenarios
check_disk_space_warnings() {
	local available_space
	local df_output
	if ! df_output=$(df "${BACKUP_BASE_DIR}"); then
		log_warning "Unable to check disk space for ${BACKUP_BASE_DIR}"
		return 0
	fi
	available_space=$(echo "${df_output}" | awk 'NR==2 {print $4}')
	local available_gb=$((available_space / 1024 / 1024))

	if [[ ${available_gb} -lt 5 ]]; then
		log_warning "⚠️  Low disk space: ${available_gb}GB available"
		log_warning "Consider reducing MAX_BACKUPS or cleaning up manually"

		if [[ ${available_gb} -lt 2 ]]; then
			log_error "❌ Critical disk space: ${available_gb}GB available"
			log_error "Backup operations may fail due to insufficient space"
		fi
	else
		log_debug "Disk space check: ${available_gb}GB available"
	fi
}

# Generate specific rollback commands for different scenarios
# Requirements: 3.5, 7.1, 7.2, 7.3
generate_rollback_commands() {
	local rollback_type="${1:-all}" # "filesystem", "container", "registry", or "all"

	log_info "Generating rollback commands (type: ${rollback_type})"

	local metadata
	metadata=$(read_backup_metadata)
	local current_backup
	current_backup=$(echo "${metadata}" | jq -r '.current_backup.path // empty')
	local latest_archived
	latest_archived=$(echo "${metadata}" | jq -r '.archived_backups | sort_by(.timestamp) | reverse | .[0].path // empty')

	local rollback_commands_file
	rollback_commands_file="/tmp/rollback_commands_$(generate_timestamp).sh"

	cat >"${rollback_commands_file}" <<'ROLLBACK_HEADER'
#!/bin/bash
# Generated Rollback Commands
# Execute these commands to rollback the deployment

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[ROLLBACK]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[ROLLBACK WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ROLLBACK ERROR]${NC} $1"; }

ROLLBACK_HEADER

	# Filesystem rollback commands
	if [[ ${rollback_type} == "filesystem" || ${rollback_type} == "all" ]]; then
		cat >>"${rollback_commands_file}" <<FILESYSTEM_ROLLBACK

# ============================================================================
# FILESYSTEM ROLLBACK
# ============================================================================

filesystem_rollback() {
    print_status "Performing filesystem rollback..."
    
    # Stop current services
    print_status "Stopping services..."
    sudo systemctl stop caddy 2>/dev/null || print_warning "Could not stop caddy"
    sudo docker stop pixelated-app 2>/dev/null || print_warning "Could not stop pixelated-app"
    
FILESYSTEM_ROLLBACK

		if [[ -n ${current_backup} && -d ${current_backup} ]]; then
			cat >>"${rollback_commands_file}" <<CURRENT_BACKUP_ROLLBACK
    # Rollback to current backup (most recent)
    print_status "Rolling back to current backup: ${current_backup}"
    
    if [[ -d "${PROJECT_DIR}" ]]; then
        print_status "Moving failed deployment to /root/pixelated-failed-\$(date +%Y%m%d_%H%M%S)"
        sudo mv "${PROJECT_DIR}" "/root/pixelated-failed-\$(date +%Y%m%d_%H%M%S)"
    fi
    
    print_status "Restoring from current backup..."
    sudo cp -a "${current_backup}" "${PROJECT_DIR}"
    
CURRENT_BACKUP_ROLLBACK
		elif [[ -n ${latest_archived} && -d ${latest_archived} ]]; then
			cat >>"${rollback_commands_file}" <<ARCHIVED_BACKUP_ROLLBACK
    # Rollback to latest archived backup
    print_status "Rolling back to latest archived backup: ${latest_archived}"
    
    if [[ -d "${PROJECT_DIR}" ]]; then
        print_status "Moving failed deployment to /root/pixelated-failed-\$(date +%Y%m%d_%H%M%S)"
        sudo mv "${PROJECT_DIR}" "/root/pixelated-failed-\$(date +%Y%m%d_%H%M%S)"
    fi
    
    print_status "Restoring from archived backup..."
    sudo cp -a "${latest_archived}" "${PROJECT_DIR}"
    
ARCHIVED_BACKUP_ROLLBACK
		else
			cat >>"${rollback_commands_file}" <<NO_BACKUP_ROLLBACK
    print_error "❌ No filesystem backup available for rollback"
    print_error "Available backups:"
    ls -la /root/pixelated-backup* 2>/dev/null || print_error "No backup directories found"
    return 1
    
NO_BACKUP_ROLLBACK
		fi

		cat >>"${rollback_commands_file}" <<FILESYSTEM_RESTART
    # Restart services
    print_status "Restarting services..."
    cd "${PROJECT_DIR}" || exit 1
    
    # Rebuild container if needed
    print_status "Rebuilding container from restored code..."
    docker build -t pixelated-empathy:rollback .
    
    # Start container
    docker run -d \\
        --name pixelated-app \\
        --restart unless-stopped \\
        -p 4321:4321 \\
        -e NODE_ENV=production \\
        -e PORT=4321 \\
        pixelated-empathy:rollback
    
    # Restart caddy
    sudo systemctl start caddy
    
    print_status "✅ Filesystem rollback completed"
}

FILESYSTEM_RESTART
	fi

	# Container rollback commands
	if [[ ${rollback_type} == "container" || ${rollback_type} == "all" ]]; then
		cat >>"${rollback_commands_file}" <<CONTAINER_ROLLBACK

# ============================================================================
# CONTAINER ROLLBACK
# ============================================================================

container_rollback() {
    print_status "Performing container rollback..."
    
    # Stop current container
    print_status "Stopping current container..."
    docker stop pixelated-app 2>/dev/null || print_warning "Container not running"
    docker rm pixelated-app 2>/dev/null || print_warning "Container not found"
    
    # Find previous container image
    PREVIOUS_IMAGE=\$(docker images pixelated-empathy --format "table {{.Repository}}:{{.Tag}}" | grep -v "latest" | head -n 1)
    
    if [[ -n "\$PREVIOUS_IMAGE" ]]; then
        print_status "Rolling back to previous image: \$PREVIOUS_IMAGE"
        
        docker run -d \\
            --name pixelated-app \\
            --restart unless-stopped \\
            -p 4321:4321 \\
            -e NODE_ENV=production \\
            -e PORT=4321 \\
            "\$PREVIOUS_IMAGE"
        
        print_status "✅ Container rollback completed"
    else
        print_error "❌ No previous container image found"
        print_status "Available images:"
        docker images pixelated-empathy
        return 1
    fi
}

CONTAINER_ROLLBACK
	fi

	# Registry rollback commands
	if [[ ${rollback_type} == "registry" || ${rollback_type} == "all" ]]; then
		cat >>"${rollback_commands_file}" <<REGISTRY_ROLLBACK

# ============================================================================
# REGISTRY ROLLBACK
# ============================================================================

registry_rollback() {
    print_status "Performing registry-based rollback..."
    
    # List available registry images
    print_status "Fetching available registry images..."
    
    # Note: This requires registry access and authentication
    REGISTRY_URL="git.pixelatedempathy.com/pixelated-empathy"
    
    print_status "Available registry images (you may need to authenticate):"
    docker search "\$REGISTRY_URL" 2>/dev/null || {
        print_warning "Could not list registry images automatically"
        print_status "Manual registry rollback steps:"
        print_status "1. List available tags: docker search \$REGISTRY_URL"
        print_status "2. Pull desired version: docker pull \$REGISTRY_URL:<tag>"
        print_status "3. Run container: docker run -d --name pixelated-app -p 4321:4321 \$REGISTRY_URL:<tag>"
        return 1
    }
    
    print_status "To complete registry rollback:"
    print_status "1. Choose a previous tag from the list above"
    print_status "2. Run: docker pull \$REGISTRY_URL:<chosen-tag>"
    print_status "3. Stop current container: docker stop pixelated-app && docker rm pixelated-app"
    print_status "4. Start rollback container: docker run -d --name pixelated-app -p 4321:4321 \$REGISTRY_URL:<chosen-tag>"
}

REGISTRY_ROLLBACK
	fi

	# Main execution logic
	cat >>"${rollback_commands_file}" <<MAIN_EXECUTION

# ============================================================================
# MAIN EXECUTION
# ============================================================================

print_status "Pixelated Empathy Deployment Rollback Script"
print_status "Generated on: \$(date)"
print_status ""

case "\${1:-all}" in
    "filesystem")
        filesystem_rollback
        ;;
    "container")
        container_rollback
        ;;
    "registry")
        registry_rollback
        ;;
    "all")
        print_status "Attempting rollback in order of preference:"
        print_status "1. Filesystem rollback (fastest, most reliable)"
        print_status "2. Container rollback (if filesystem fails)"
        print_status "3. Registry rollback (manual steps provided)"
        print_status ""
        
        if filesystem_rollback; then
            print_status "✅ Filesystem rollback successful"
        elif container_rollback; then
            print_status "✅ Container rollback successful"
        else
            print_status "⚠️  Automatic rollback failed, trying registry rollback..."
            registry_rollback
        fi
        ;;
    *)
        print_status "Usage: \$0 [filesystem|container|registry|all]"
        print_status ""
        print_status "Rollback options:"
        print_status "  filesystem - Restore from filesystem backup (fastest)"
        print_status "  container  - Use previous container image"
        print_status "  registry   - Pull from container registry"
        print_status "  all        - Try all methods in order (default)"
        exit 1
        ;;
esac

MAIN_EXECUTION

	chmod +x "${rollback_commands_file}"

	log_info "✅ Rollback commands generated: ${rollback_commands_file}"
	log_info ""
	log_info "To execute rollback:"
	log_info "  All methods: bash ${rollback_commands_file}"
	log_info "  Filesystem only: bash ${rollback_commands_file} filesystem"
	log_info "  Container only: bash ${rollback_commands_file} container"
	log_info "  Registry only: bash ${rollback_commands_file} registry"

	# Return only the script path (for programmatic use)
	echo "${rollback_commands_file}"
}

# List all available backups with metadata
list_backups() {
	log_info "Available backups:"

	local metadata
	if ! metadata=$(read_backup_metadata); then
		log_error "Failed to read backup metadata"
		return 1
	fi

	# Debug: show raw metadata
	log_debug "Raw metadata: ${metadata}"

	# Show current backup
	local current_backup_exists
	if ! current_backup_exists=$(echo "${metadata}" | jq -r '.current_backup != null' 2>/dev/null); then
		log_error "Failed to parse metadata with jq"
		log_debug "Metadata content: ${metadata}"
		return 1
	fi

	if [[ ${current_backup_exists} == "true" ]]; then
		local path
		path=$(echo "${metadata}" | jq -r '.current_backup.path')
		local commit
		commit=$(echo "${metadata}" | jq -r '.current_backup.commit_hash')
		local timestamp
		timestamp=$(echo "${metadata}" | jq -r '.current_backup.timestamp')
		local created
		created=$(echo "${metadata}" | jq -r '.current_backup.created_at')

		echo -e "${GREEN}Current Backup:${NC}"
		echo "  Path: ${path}"
		echo "  Commit: ${commit}"
		echo "  Timestamp: ${timestamp}"
		echo "  Created: ${created}"
		echo ""
	fi

	# Show archived backups
	local archived_count
	if ! archived_count=$(echo "${metadata}" | jq -r '.archived_backups | length' 2>/dev/null); then
		log_error "Failed to get archived backup count"
		return 1
	fi

	if [[ ${archived_count} -gt 0 ]]; then
		echo -e "${BLUE}Archived Backups (${archived_count}):${NC}"
		echo "${metadata}" | jq -r '.archived_backups | sort_by(.timestamp) | reverse | .[] | "  \(.timestamp) - \(.commit_hash) - \(.path)"'
	else
		echo -e "${YELLOW}No archived backups found${NC}"
	fi

	# Show disk usage
	echo ""
	echo -e "${BLUE}Disk Usage:${NC}"
	local disk_usage
	if ! disk_usage=$(du -sh "${BACKUP_BASE_DIR}"/pixelated-backup* 2>/dev/null); then
		echo "  No backup directories found"
		return 0
	fi
	echo "${disk_usage}" | sort -hr
}

# Verify backup integrity
verify_backup_integrity() {
	local backup_path="$1"

	if [[ -z ${backup_path} ]]; then
		log_error "Backup path required for integrity verification"
		return 1
	fi

	if [[ ! -d ${backup_path} ]]; then
		log_error "Backup directory does not exist: ${backup_path}"
		return 1
	fi

	log_info "Verifying backup integrity: ${backup_path}"

	# Check essential files and directories
	local essential_items=(
		"package.json"
		"astro.config.mjs"
		"src"
		"public"
		"Dockerfile"
	)

	local missing_items=()
	for item in "${essential_items[@]}"; do
		if [[ ! -e "${backup_path}/${item}" ]]; then
			missing_items+=("${item}")
		fi
	done

	if [[ ${#missing_items[@]} -gt 0 ]]; then
		log_error "❌ Backup integrity check failed"
		log_error "Missing essential items: ${missing_items[*]}"
		return 1
	fi

	# Check if it's a git repository
	if [[ -d "${backup_path}/.git" ]]; then
		log_info "✅ Git repository found in backup"
		cd "${backup_path}" || return 1
		local porcelain_status
		if ! porcelain_status=$(git status --porcelain 2>/dev/null); then
			log_warning "Unable to get git status for backup"
			porcelain_status=""
		fi
		local git_status
		git_status=$(printf '%s' "${porcelain_status}" | wc -l)
		log_info "Git status: ${git_status} modified files"
	else
		log_warning "⚠️  No git repository in backup"
	fi

	# Check backup size
	local du_output
	if ! du_output=$(du -sh "${backup_path}" 2>/dev/null); then
		log_warning "Unable to determine backup size"
		du_output=""
	fi
	local backup_size
	backup_size=$(echo "${du_output}" | cut -f1)
	log_info "Backup size: ${backup_size}"

	log_info "✅ Backup integrity verification completed"
	return 0
}

# Main function for testing
main() {
	local action="${1:-help}"

	case "${action}" in
	"preserve")
		preserve_current_backup
		;;
	"archive")
		archive_current_backup
		;;
	"cleanup")
		cleanup_old_backups
		;;
	"rollback")
		generate_rollback_commands "${2:-all}"
		;;
	"list")
		list_backups
		;;
	"verify")
		verify_backup_integrity "$2"
		;;
	"help" | *)
		echo "Backup Manager Component"
		echo ""
		echo "Usage: $0 <action> [options]"
		echo ""
		echo "Actions:"
		echo "  preserve  - Preserve current backup until deployment verification"
		echo "  archive   - Archive current backup with timestamp"
		echo "  cleanup   - Clean up old backups (maintain retention policy)"
		echo "  rollback  - Generate rollback commands [filesystem|container|registry|all]"
		echo "  list      - List all available backups with metadata"
		echo "  verify    - Verify backup integrity <backup_path>"
		echo "  help      - Show this help message"
		;;
	esac
}

# Execute main function if script is run directly
if [[ ${BASH_SOURCE[0]} == "${0}" ]]; then
	main "$@"
fi

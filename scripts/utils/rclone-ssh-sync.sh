#!/usr/bin/env bash
set -e

# Rclone SSH Sync Script for Remote Server
# Syncs pixelated repository to remote server via SSH/SFTP
# Excludes .git and node_modules directories, never overwrites existing files

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
REMOTE_NAME="planet"
REMOTE_HOST="146.71.78.184"
REMOTE_USER="vivi"
LOCAL_DIR="/home/vivi/pixelated"
REMOTE_BASE_PATH="~/pixelated"
EXCLUSION_LIST_FILE="$(dirname "$0")/rclone-exclusions-list.txt"
LOG_DIR="/tmp/rclone-ssh-sync-$$"
ERROR_LOG="${LOG_DIR}/errors.log"

# SSH Key configuration - can be overridden via environment or command line
SSH_KEY="${SSH_KEY:-${PLANET_KEY:-}}"
if [ -z "$SSH_KEY" ]; then
  # Try common SSH key locations
  for key_path in ~/.ssh/planet ~/.ssh/id_rsa ~/.ssh/id_ed25519; do
    if [ -f "$key_path" ]; then
      SSH_KEY="$key_path"
      break
    fi
  done
fi

# Track if we're interrupted
INTERRUPTED=false
RCLONE_PID=""

# Logging functions
print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { echo -e "${BLUE}[STEP]${NC} $1"; }
print_speed() { echo -e "${CYAN}[SPEED]${NC} $1"; }

# Cleanup function
cleanup() {
  if [ "$INTERRUPTED" = true ]; then
    echo ""
    print_warning "Interrupt received. Cleaning up..."
    if [ -n "$RCLONE_PID" ]; then
      print_status "Stopping rclone process (PID: $RCLONE_PID)..."
      kill "$RCLONE_PID" 2>/dev/null || true
      wait "$RCLONE_PID" 2>/dev/null || true
    fi
    print_status "Partial files are saved on remote with .partial suffix"
    print_status "You can resume by running the script again - rclone will automatically continue from where it left off."
  fi
  
  # Clean up temporary files
  rm -rf "${LOG_DIR}" 2>/dev/null || true
}

# Graceful shutdown handler
handle_interrupt() {
  INTERRUPTED=true
  cleanup
  exit 130
}

# Error handling
set -o pipefail
trap 'handle_interrupt' INT TERM
trap 'cleanup' EXIT

# Check if rclone is installed
if ! command -v rclone &> /dev/null; then
  print_error "rclone is not installed. Please install it first."
  exit 1
fi

# Create log directory
mkdir -p "${LOG_DIR}"

# Check SSH key exists
check_ssh_key() {
  if [ -z "$SSH_KEY" ] || [ ! -f "$SSH_KEY" ]; then
    print_error "SSH key not found."
    print_status "Please provide SSH key via:"
    print_status "  - Environment variable: export PLANET_KEY=~/.ssh/planet"
    print_status "  - Command line: --ssh-key=~/.ssh/planet"
    print_status ""
    print_status "Or ensure key exists at one of these locations:"
    print_status "  - ~/.ssh/planet"
    print_status "  - ~/.ssh/id_rsa"
    print_status "  - ~/.ssh/id_ed25519"
    exit 1
  fi
  
  # Check key permissions (should be 600 or 400)
  local key_perms=$(stat -c "%a" "$SSH_KEY" 2>/dev/null || stat -f "%A" "$SSH_KEY" 2>/dev/null)
  if [ "$key_perms" != "600" ] && [ "$key_perms" != "400" ] && [ "$key_perms" != "100" ]; then
    print_warning "SSH key permissions are $key_perms (should be 600 or 400)"
    print_status "Consider running: chmod 600 $SSH_KEY"
  fi
  
  print_status "Using SSH key: $SSH_KEY"
}

# Check if remote exists, create if not
check_or_create_remote() {
  print_header "Checking rclone remote configuration..."
  
  if rclone listremotes 2>/dev/null | grep -q "^${REMOTE_NAME}:$"; then
    print_status "Remote '${REMOTE_NAME}' already configured"
    
    # Test the remote
    if rclone lsd "${REMOTE_NAME}:" &>/dev/null; then
      print_status "Remote connection test successful"
      return 0
    else
      print_warning "Remote exists but connection test failed. Reconfiguring..."
    fi
  fi
  
  print_status "Configuring rclone remote '${REMOTE_NAME}'..."
  print_status "Remote details:"
  print_status "  Type: SFTP"
  print_status "  Host: ${REMOTE_HOST}"
  print_status "  User: ${REMOTE_USER}"
  print_status "  Key: ${SSH_KEY}"
  print_status ""
  
  # Configure remote using rclone config create (non-interactive)
  if rclone config create "${REMOTE_NAME}" sftp \
    host "${REMOTE_HOST}" \
    user "${REMOTE_USER}" \
    key_file "${SSH_KEY}" \
    shell_type "unix" \
    md5sum_command "md5sum" \
    sha1sum_command "sha1sum" 2>&1 | tee "${LOG_DIR}/remote-config.log"; then
    print_status "Remote '${REMOTE_NAME}' configured successfully"
  else
    print_error "Failed to configure remote. Please configure manually:"
    print_status "  rclone config"
    print_status "  Then select 'n' for new remote, name it '${REMOTE_NAME}', choose 'sftp'"
    exit 1
  fi
  
  # Test the connection
  if rclone lsd "${REMOTE_NAME}:" &>/dev/null; then
    print_status "Remote connection test successful"
  else
    print_warning "Remote configured but connection test failed"
    print_status "Please verify SSH access manually: ssh -i $SSH_KEY ${REMOTE_USER}@${REMOTE_HOST}"
  fi
}

# Generate exclusion list
generate_exclusion_list() {
  print_header "Generating exclusion list..."
  
  local script_dir="$(cd "$(dirname "$0")" && pwd)"
  local exclusion_file="${script_dir}/rclone-exclusions-list.txt"
  
  print_status "Scanning repository for .git and node_modules directories..."
  
  # Temporarily disable exit on error for this function
  set +e
  
  # Create exclusion list file with header
  cat > "${exclusion_file}" <<EOF
# Rclone SSH Sync Exclusion List
# Generated: $(date -Iseconds)
# Repository: ${LOCAL_DIR}
# 
# This file lists all directories excluded from sync:
#   - All .git directories (including submodules)
#   - All node_modules directories
#
# Format: One path per line, relative to repository root
# Empty lines and lines starting with # are ignored

EOF

  local git_count=0
  local node_modules_count=0
  
  # Find all .git directories (but not .gitignore files)
  print_status "Finding .git directories..."
  while IFS= read -r -d '' git_dir; do
    # Get relative path from repo root
    local rel_path="${git_dir#${LOCAL_DIR}/}"
    echo "${rel_path}" >> "${exclusion_file}"
    git_count=$((git_count + 1))
  done < <(find "${LOCAL_DIR}" -type d -name ".git" -print0 2>/dev/null || true)
  
  # Find all node_modules directories
  print_status "Finding node_modules directories..."
  while IFS= read -r -d '' nm_dir; do
    # Get relative path from repo root
    local rel_path="${nm_dir#${LOCAL_DIR}/}"
    echo "${rel_path}" >> "${exclusion_file}"
    node_modules_count=$((node_modules_count + 1))
  done < <(find "${LOCAL_DIR}" -type d -name "node_modules" -print0 2>/dev/null || true)
  
  # Add summary at the end
  cat >> "${exclusion_file}" <<EOF

# Summary
# Total .git directories: ${git_count}
# Total node_modules directories: ${node_modules_count}
# Total excluded directories: $((git_count + node_modules_count))
EOF

  # Re-enable exit on error
  set -e
  
  print_status "Exclusion list generated: ${exclusion_file}"
  print_status "  - ${git_count} .git directories"
  print_status "  - ${node_modules_count} node_modules directories"
  print_status "  - Total: $((git_count + node_modules_count)) directories"
}

# Main sync function
sync_files() {
  local dry_run="${1:-false}"
  local remote_path="${2:-${REMOTE_BASE_PATH}}"
  
  if [ "$dry_run" = "true" ]; then
    print_header "Dry run - showing what would be synced"
  else
    print_header "Starting sync to remote server"
  fi
  
  print_status "Source: ${LOCAL_DIR}"
  print_status "Destination: ${REMOTE_NAME}:${remote_path}"
  print_status "Strategy: Never overwrite existing files (--ignore-existing)"
  print_status ""
  
  # Build exclusion patterns - use array for proper argument passing
  local exclude_patterns=(
    "--exclude"
    "**/.git/**"
    "--exclude"
    "**/.git"
    "--exclude"
    "**/node_modules/**"
    "--exclude"
    "**/node_modules"
  )
  
  print_status "Excluding:"
  print_status "  - All .git directories and contents"
  print_status "  - All node_modules directories and contents"
  print_status ""
  
  if [ "$dry_run" = "true" ]; then
    print_status "DRY RUN MODE - No files will be transferred"
    print_status ""
  fi
  
  # Build rclone command
  local rclone_subcmd="copy"
  if [ "$dry_run" = "true" ]; then
    rclone_subcmd="copy"
  fi
  
  # Use rclone copy with ignore-existing to never overwrite
  # This will only copy files that don't exist on the destination
  print_status "Starting transfer..."
  print_status "Press Ctrl+C to safely stop (uploads will be resumed on next run)"
  echo ""
  
  # Build rclone command arguments
  local rclone_args=(
    "${rclone_subcmd}"
    "${LOCAL_DIR}"
    "${REMOTE_NAME}:${remote_path}"
    "${exclude_patterns[@]}"
    "--ignore-existing"
    "--progress"
    "--stats=5s"
    "--stats-one-line-date"
    "--stats-log-level=NOTICE"
    "--transfers=8"
    "--checkers=16"
    "--buffer-size=64M"
    "--log-level=INFO"
    "--log-file=${LOG_DIR}/rclone.log"
  )
  
  # Add dry-run flag if requested
  if [ "$dry_run" = "true" ]; then
    rclone_args+=( "--dry-run" )
  fi
  
  # Run rclone in background to allow interrupt handling
  rclone "${rclone_args[@]}" 2>&1 | tee "${LOG_DIR}/sync.log" &
  RCLONE_PID=$!
  
  # Wait for rclone to complete
  wait $RCLONE_PID
  local exit_code=$?
  
  # Check exit code
  case $exit_code in
    0)
      if [ "$dry_run" != "true" ]; then
        print_status ""
        print_status "Sync completed successfully!"
        rm -rf "${LOG_DIR}" 2>/dev/null || true
      fi
      ;;
    1)
      print_error "Sync failed with a fatal error"
      print_status "Check log: ${LOG_DIR}/rclone.log"
      return 1
      ;;
    *)
      if [ "$dry_run" != "true" ]; then
        print_warning "Sync interrupted or had non-fatal errors (exit code: $exit_code)"
        print_status "Partial files with .partial suffix on remote will be resumed automatically on next run"
        print_status "Check log: ${LOG_DIR}/rclone.log"
      fi
      ;;
  esac
  
  return $exit_code
}

# Show help
show_help() {
  cat <<EOF
Usage: $0 [OPTIONS]

Rclone SSH Sync Script - Sync pixelated repository to remote server via SSH/SFTP

OPTIONS:
  --dry-run, -n              Show what would be synced without actually transferring
  --generate-exclusions      Only generate exclusion list, don't sync
  --remote-path=PATH         Remote destination path (default: ${REMOTE_BASE_PATH})
  --ssh-key=KEY              Path to SSH key file
  --help, -h                 Show this help message

ENVIRONMENT VARIABLES:
  PLANET_KEY                 Path to SSH key file (default: tries ~/.ssh/planet, ~/.ssh/id_rsa, ~/.ssh/id_ed25519)
  SSH_KEY                    Path to SSH key file (same as PLANET_KEY)

FEATURES:
  - Safe sync: Never overwrites existing files (--ignore-existing)
  - Smart exclusions: Automatically excludes all .git and node_modules directories
  - Progress tracking: Shows upload speed and transfer progress
  - Graceful shutdown: Press Ctrl+C to safely stop (can resume later)
  - Exclusion list: Generates list of excluded paths for reference

NOTES:
  - All gitignored files and folders ARE synced (only .git and node_modules are excluded)
  - Existing files on remote are never overwritten
  - Missing files are copied to fill in the structure
  - Partial folder structures are supported (only missing files are added)

EXAMPLES:
  # Generate exclusion list only
  $0 --generate-exclusions

  # Dry run to see what would be synced
  $0 --dry-run

  # Sync to default location
  $0

  # Sync to custom remote path
  $0 --remote-path=~/backup/pixelated

  # Use custom SSH key
  $0 --ssh-key=~/.ssh/my_key

EOF
}

# Parse command line arguments
parse_arguments() {
  local dry_run=false
  local generate_exclusions=false
  local remote_path="${REMOTE_BASE_PATH}"
  
  while [[ $# -gt 0 ]]; do
    case $1 in
      --dry-run|-n)
        dry_run=true
        shift
        ;;
      --generate-exclusions)
        generate_exclusions=true
        shift
        ;;
      --remote-path=*)
        remote_path="${1#*=}"
        shift
        ;;
      --ssh-key=*)
        SSH_KEY="${1#*=}"
        shift
        ;;
      --help|-h)
        show_help
        exit 0
        ;;
      *)
        print_error "Unknown option: $1"
        show_help
        exit 1
        ;;
    esac
  done
  
  # Execute based on flags
  if [ "$generate_exclusions" = "true" ]; then
    generate_exclusion_list
    exit 0
  fi
  
  # Check SSH key before proceeding
  check_ssh_key
  
  # Check or create remote
  check_or_create_remote
  
  # Generate exclusion list (always, for reference)
  generate_exclusion_list
  
  # Sync files
  sync_files "$dry_run" "$remote_path"
}

# Main execution
main() {
  print_header "Rclone SSH Sync for Pixelated Repository"
  print_status "Target: ${REMOTE_USER}@${REMOTE_HOST}"
  print_status ""
  
  parse_arguments "$@"
}

# Run main function
main "$@"

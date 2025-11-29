#!/usr/bin/env bash
set -e

# Rclone SSH Sync Script for Remote Server
# Syncs pixelated repository to remote server via SSH/SFTP
# Excludes .git and node_modules directories, never overwrites existing files

# ANSI Color codes (256-color support)
# Pink/Magenta tones (like gum's 212)
PINK='\033[38;5;212m'
# Purple/Blue tones (like gum's 57)
PURPLE='\033[38;5;57m'
# Green (like gum's 10)
GREEN='\033[38;5;10m'
# Yellow/Orange (like gum's 11)
YELLOW='\033[38;5;11m'
# Red (like gum's 9)
RED='\033[38;5;9m'
# White/Bright
WHITE='\033[38;5;255m'
# Standard colors for fallback
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'  # No Color
BOLD='\033[1m'
RESET='\033[0m'

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

# Beautiful ANSI-based styling functions (no external dependencies)
# These create gum-like output using pure ANSI escape codes

# Box drawing characters
BOX_HORIZ='─'
BOX_VERT='│'
BOX_CORNER_TL='┌'
BOX_CORNER_TR='┐'
BOX_CORNER_BL='└'
BOX_CORNER_BR='┘'
BOX_ROUND_TL='╭'
BOX_ROUND_TR='╮'
BOX_ROUND_BL='╰'
BOX_ROUND_BR='╯'

# Create a styled box (like gum style --border rounded)
style_box() {
  local border_color="$1"
  local text_color="$2"
  local padding_top="$3"
  local padding_sides="$4"
  local margin_top="$5"
  shift 5
  local content=("$@")
  
  # Margin
  if [ "$margin_top" -gt 0 ]; then
    for i in $(seq 1 "$margin_top"); do
      echo ""
    done
  fi
  
  # Calculate width (longest line + padding)
  local max_width=0
  for line in "${content[@]}"; do
    local len=${#line}
    if [ $len -gt $max_width ]; then
      max_width=$len
    fi
  done
  local box_width=$((max_width + (padding_sides * 2)))
  
  # Top border
  echo -ne "${border_color}"
  echo -n "${BOX_ROUND_TL}"
  for i in $(seq 1 $box_width); do
    echo -n "${BOX_HORIZ}"
  done
  echo -n "${BOX_ROUND_TR}"
  echo -e "${NC}"
  
  # Top padding
  for i in $(seq 1 "$padding_top"); do
    echo -ne "${border_color}${BOX_VERT}${NC}"
    printf "%${box_width}s" ""
    echo -ne "${border_color}${BOX_VERT}${NC}"
    echo ""
  done
  
  # Content
  for line in "${content[@]}"; do
    echo -ne "${border_color}${BOX_VERT}${NC}"
    printf "%${padding_sides}s" ""
    echo -ne "${text_color}${line}${NC}"
    local line_len=${#line}
    local remaining=$((box_width - padding_sides - line_len))
    printf "%${remaining}s" ""
    echo -ne "${border_color}${BOX_VERT}${NC}"
    echo ""
  done
  
  # Bottom padding
  for i in $(seq 1 "$padding_top"); do
    echo -ne "${border_color}${BOX_VERT}${NC}"
    printf "%${box_width}s" ""
    echo -ne "${border_color}${BOX_VERT}${NC}"
    echo ""
  done
  
  # Bottom border
  echo -ne "${border_color}"
  echo -n "${BOX_ROUND_BL}"
  for i in $(seq 1 $box_width); do
    echo -n "${BOX_HORIZ}"
  done
  echo -n "${BOX_ROUND_BR}"
  echo -e "${NC}"
}

# Create a double-bordered box (like gum style --border double)
style_box_double() {
  local border_color="$1"
  local text_color="$2"
  local padding_top="$3"
  local padding_sides="$4"
  local margin_top="$5"
  local align="$6"  # "center" or "left"
  shift 6
  local content=("$@")
  
  # Margin
  if [ "$margin_top" -gt 0 ]; then
    for i in $(seq 1 "$margin_top"); do
      echo ""
    done
  fi
  
  # Calculate width
  local max_width=0
  for line in "${content[@]}"; do
    local len=${#line}
    if [ $len -gt $max_width ]; then
      max_width=$len
    fi
  done
  local box_width=$((max_width + (padding_sides * 2)))
  
  # Double border characters
  local DB_HORIZ='═'
  local DB_VERT='║'
  local DB_CORNER_TL='╔'
  local DB_CORNER_TR='╗'
  local DB_CORNER_BL='╚'
  local DB_CORNER_BR='╝'
  
  # Top border
  echo -ne "${border_color}"
  echo -n "${DB_CORNER_TL}"
  for i in $(seq 1 $box_width); do
    echo -n "${DB_HORIZ}"
  done
  echo -n "${DB_CORNER_TR}"
  echo -e "${NC}"
  
  # Top padding
  for i in $(seq 1 "$padding_top"); do
    echo -ne "${border_color}${DB_VERT}${NC}"
    printf "%${box_width}s" ""
    echo -ne "${border_color}${DB_VERT}${NC}"
    echo ""
  done
  
  # Content
  for line in "${content[@]}"; do
    echo -ne "${border_color}${DB_VERT}${NC}"
    if [ "$align" = "center" ]; then
      local line_len=${#line}
      local total_padding=$((box_width - line_len))
      local left_pad=$((total_padding / 2))
      local right_pad=$((total_padding - left_pad))
      printf "%${left_pad}s" ""
      echo -ne "${text_color}${BOLD}${line}${NC}"
      printf "%${right_pad}s" ""
    else
      printf "%${padding_sides}s" ""
      echo -ne "${text_color}${line}${NC}"
      local line_len=${#line}
      local remaining=$((box_width - padding_sides - line_len))
      printf "%${remaining}s" ""
    fi
    echo -ne "${border_color}${DB_VERT}${NC}"
    echo ""
  done
  
  # Bottom padding
  for i in $(seq 1 "$padding_top"); do
    echo -ne "${border_color}${DB_VERT}${NC}"
    printf "%${box_width}s" ""
    echo -ne "${border_color}${DB_VERT}${NC}"
    echo ""
  done
  
  # Bottom border
  echo -ne "${border_color}"
  echo -n "${DB_CORNER_BL}"
  for i in $(seq 1 $box_width); do
    echo -n "${DB_HORIZ}"
  done
  echo -n "${DB_CORNER_BR}"
  echo -e "${NC}"
}

# Spinner function (simple animated spinner)
spinner() {
  local title="$1"
  shift
  local cmd=("$@")
  
  local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  local pid
  
  # Run command in background
  "${cmd[@]}" > /dev/null 2>&1 &
  pid=$!
  
  # Show spinner while command runs
  while kill -0 $pid 2>/dev/null; do
    local temp=${spinstr#?}
    printf "\r${PURPLE}%s${NC} ${title} " "${spinstr:0:1}"
    spinstr=$temp${spinstr%"$temp"}
    sleep 0.1
  done
  
  # Clear spinner line
  printf "\r\033[K"
  
  # Wait for command and return its exit code
  wait $pid
  return $?
}

# Logging functions with beautiful styling
print_status() { 
  echo -e "${GREEN}ℹ${NC} ${GREEN}$1${NC}"
}

print_warning() { 
  echo -e "${YELLOW}⚠${NC} ${YELLOW}$1${NC}"
}

print_error() { 
  echo -e "${RED}✗${NC} ${RED}$1${NC}"
}

print_success() { 
  echo -e "${GREEN}✓${NC} ${GREEN}$1${NC}"
}

print_header() { 
  style_box "$PINK" "$PINK" 1 2 1 "$1"
}

print_info_box() {
  style_box "$PURPLE" "$WHITE" 1 2 1 "$@"
}

print_success_box() {
  style_box "$GREEN" "$GREEN" 1 2 1 "$@"
}

print_warning_box() {
  style_box "$YELLOW" "$WHITE" 1 2 1 "$@"
}

print_error_box() {
  style_box "$RED" "$WHITE" 1 2 1 "$@"
}

print_title() {
  style_box_double "$PINK" "$PINK" 1 2 1 "center" "$@"
}

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
  print_error_box "Install rclone: https://rclone.org/install/"
  exit 1
fi

# Create log directory
mkdir -p "${LOG_DIR}"

# Check SSH key exists
check_ssh_key() {
  if [ -z "$SSH_KEY" ] || [ ! -f "$SSH_KEY" ]; then
    print_error "SSH key not found."
    print_warning_box \
      "Please provide SSH key via:" \
      "" \
      "  • Environment variable: export PLANET_KEY=~/.ssh/planet" \
      "  • Command line: --ssh-key=~/.ssh/planet" \
      "" \
      "Or ensure key exists at:" \
      "  • ~/.ssh/planet" \
      "  • ~/.ssh/id_rsa" \
      "  • ~/.ssh/id_ed25519"
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
    spinner "Testing remote connection..." rclone lsd "${REMOTE_NAME}:" &>/dev/null
    if [ $? -eq 0 ]; then
      print_success "Remote connection test successful"
      return 0
    else
      print_warning "Remote exists but connection test failed. Reconfiguring..."
    fi
  fi
  
  print_status "Configuring rclone remote '${REMOTE_NAME}'..."
  
  print_info_box \
    "Remote Details:" \
    "  Type: SFTP" \
    "  Host: ${REMOTE_HOST}" \
    "  User: ${REMOTE_USER}" \
    "  Key: ${SSH_KEY}"
  
  # Configure remote using rclone config create (non-interactive)
  spinner "Configuring remote '${REMOTE_NAME}'..." \
    rclone config create "${REMOTE_NAME}" sftp \
      host "${REMOTE_HOST}" \
      user "${REMOTE_USER}" \
      key_file "${SSH_KEY}" \
      shell_type "unix" \
      md5sum_command "md5sum" \
      sha1sum_command "sha1sum" > "${LOG_DIR}/remote-config.log" 2>&1
  
  if [ $? -eq 0 ]; then
    print_success "Remote '${REMOTE_NAME}' configured successfully"
  else
    print_error "Failed to configure remote. Please configure manually:"
    print_warning_box \
      "Run: rclone config" \
      "Then select 'n' for new remote, name it '${REMOTE_NAME}', choose 'sftp'"
    exit 1
  fi
  
  # Test the connection
  spinner "Testing remote connection..." rclone lsd "${REMOTE_NAME}:" &>/dev/null
  if [ $? -eq 0 ]; then
    print_success "Remote connection test successful"
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
  
  print_info_box \
    "Exclusion list generated: ${exclusion_file}" \
    "" \
    "  • ${git_count} .git directories" \
    "  • ${node_modules_count} node_modules directories" \
    "  • Total: $((git_count + node_modules_count)) directories"
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
  # Key changes from original:
  # - Use --stats-one-line (not --stats-one-line-date) for in-place updates
  # - Reduced checkers to 4 to slow file discovery (prevents size from growing)
  # - Use --fast-list to scan ahead efficiently
  local rclone_args=(
    "${rclone_subcmd}"
    "${LOCAL_DIR}"
    "${REMOTE_NAME}:${remote_path}"
    "${exclude_patterns[@]}"
    "--ignore-existing"
    "--progress"
    "--stats=5s"
    "--stats-one-line"
    "--stats-log-level=NOTICE"
    "--transfers=8"
    "--checkers=4"
    "--fast-list"
    "--buffer-size=64M"
    "--log-level=NOTICE"
    "--log-file=${LOG_DIR}/rclone.log"
  )
  
  # Add dry-run flag if requested
  if [ "$dry_run" = "true" ]; then
    rclone_args+=( "--dry-run" )
  fi
  
  print_status "Progress updates every 5 seconds (stats update in place)"
  print_status "Current file shown during individual file transfers"
  print_status "Detailed log: ${LOG_DIR}/rclone.log"
  print_status ""
  print_status "Note: Total size may increase as rclone discovers files during scan"
  print_status "This is normal - reduced checkers (4) helps stabilize estimates"
  echo ""
  
  # Run rclone directly to preserve carriage returns for in-place progress updates
  # rclone's --log-file handles detailed logging automatically
  # Using --stats-one-line (not --stats-one-line-date) prevents new line accumulation
  rclone "${rclone_args[@]}" &
  RCLONE_PID=$!
  
  # Wait for rclone to complete
  wait $RCLONE_PID
  local exit_code=$?
  
  echo ""
  
  # Check exit code
  case $exit_code in
    0)
      if [ "$dry_run" != "true" ]; then
        echo ""
        print_success_box "✓ Sync completed successfully!"
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
        print_warning_box \
          "Partial files with .partial suffix on remote will be resumed automatically on next run" \
          "Check log: ${LOG_DIR}/rclone.log"
      fi
      ;;
  esac
  
  return $exit_code
}

# Show help
show_help() {
  if [ "$USE_GUM" = "true" ]; then
    gum style --border double --border-foreground 212 --padding "1 2" --margin "1 0" \
      --align center --foreground 212 --bold \
      "Rclone SSH Sync Script" \
      "Sync pixelated repository to remote server via SSH/SFTP"
    echo ""
    gum style --border rounded --border-foreground 57 --padding "1 2" --margin "1 0" \
      --foreground 255 "OPTIONS:" \
      "  --dry-run, -n              Show what would be synced without actually transferring" \
      "  --generate-exclusions      Only generate exclusion list, don't sync" \
      "  --remote-path=PATH         Remote destination path (default: ${REMOTE_BASE_PATH})" \
      "  --ssh-key=KEY              Path to SSH key file" \
      "  --help, -h                 Show this help message"
    echo ""
    gum style --border rounded --border-foreground 57 --padding "1 2" --margin "1 0" \
      --foreground 255 "ENVIRONMENT VARIABLES:" \
      "  PLANET_KEY                 Path to SSH key file" \
      "  SSH_KEY                    Path to SSH key file (same as PLANET_KEY)"
    echo ""
    gum style --border rounded --border-foreground 10 --padding "1 2" --margin "1 0" \
      --foreground 255 "FEATURES:" \
      "  ✅ Safe sync: Never overwrites existing files" \
      "  ✅ Smart exclusions: Auto-excludes .git and node_modules" \
      "  ✅ Progress tracking: Shows upload speed and progress" \
      "  ✅ Graceful shutdown: Ctrl+C to safely stop (can resume)" \
      "  ✅ Exclusion list: Generates list for reference"
    echo ""
    gum format --type markdown <<EOF
**EXAMPLES:**

\`\`\`bash
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
\`\`\`

**NOTES:**
- All gitignored files and folders ARE synced (only .git and node_modules excluded)
- Existing files on remote are never overwritten
- Missing files are copied to fill in the structure
EOF
  else
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
  fi
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
  if [ "$USE_GUM" = "true" ]; then
    gum style --border double --border-foreground 212 --padding "1 2" --margin "1 0" \
      --align center --foreground 212 --bold \
      "🚀 Rclone SSH Sync" \
      "Pixelated Repository" \
      "" \
      "Target: ${REMOTE_USER}@${REMOTE_HOST}"
  else
    print_header "Rclone SSH Sync for Pixelated Repository"
    print_status "Target: ${REMOTE_USER}@${REMOTE_HOST}"
  fi
  echo ""
  
  parse_arguments "$@"
}

# Run main function
main "$@"

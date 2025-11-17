#!/usr/bin/env bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
# Set your rclone remote name here (e.g., "gdrive:", "s3:", "dropbox:", etc.)
# Check for positional argument first, then fall back to environment variable
if [ -n "$1" ] && [[ ! "$1" =~ ^- ]]; then
    REMOTE_NAME="$1"
elif [ -n "$RCLONE_REMOTE" ]; then
    REMOTE_NAME="$RCLONE_REMOTE"
else
    REMOTE_NAME=""
fi
LOCAL_DIR="/home/vivi/pixelated"
REMOTE_DIR="${REMOTE_NAME}pixelated"  # Adjust path on remote as needed
PARTIAL_DIR="/tmp/rclone-partial-$$"  # Temporary directory for partial uploads
INVENTORY_FILE="/tmp/rclone-inventory-$$.txt"  # Temporary file for inventory
ERROR_LOG="/tmp/rclone-errors-$$.log"  # Temporary file for error output

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
        print_warning "⚠️  Interrupt received. Cleaning up..."
        if [ -n "$RCLONE_PID" ]; then
            print_status "Stopping rclone process (PID: $RCLONE_PID)..."
            kill "$RCLONE_PID" 2>/dev/null || true
            wait "$RCLONE_PID" 2>/dev/null || true
        fi
        print_status "Partial files are saved on remote with .partial suffix"
        print_status "You can resume by running the script again - rclone will automatically continue from where it left off."
    fi
    
    # Clean up temporary files
    rm -f "${INVENTORY_FILE}" 2>/dev/null || true
    rm -f "${ERROR_LOG}" 2>/dev/null || true
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

# Remote presence and existence checks are performed later in main() after parsing options

# Create log directory for tracking
setup_partial_dir() {
    mkdir -p "${PARTIAL_DIR}"
    print_status "Log directory: ${PARTIAL_DIR}"
    print_status "Note: Partial files are automatically handled by rclone on the remote"
}

# Quick inventory check - see what needs syncing
run_inventory() {
    local skip_inventory="${1:-false}"
    
    if [ "$skip_inventory" = "true" ]; then
        print_warning "Skipping inventory check (use --inventory to force)"
        return 0
    fi
    
    print_header "📊 Running quick inventory check..."
    print_status "Comparing local and remote file sizes (this may take a moment)..."
    print_status "Press Ctrl+C to skip inventory and proceed directly to sync"
    echo ""
    
    # Use timeout to prevent hanging (5 minute max)
    # Show progress during check
    local check_exit=0
    
    # Run check with timeout and show a heartbeat so users see activity
    # Note: rclone check exits with code 1 if differences are found, which is normal
    # Suppress verbose "file not in Local file system" errors to keep output clean
    if command -v timeout &> /dev/null; then
        timeout 300 rclone check "${LOCAL_DIR}" "${REMOTE_DIR}" \
            --size-only \
            --exclude "/ai/**" \
            --exclude "/ai/" \
            --exclude "/node_modules/**" \
            --exclude "/.venv/**" \
            --fast-list \
            --max-backlog=100000 \
            --combined="${INVENTORY_FILE}" \
            --stats=10s \
            --stats-one-line-date \
            --stats-log-level=NOTICE \
            --log-level=NOTICE 2> >(grep -v "file not in Local file system" > "${ERROR_LOG}" 2>/dev/null || true) &
    else
        # Fallback if timeout command not available
        rclone check "${LOCAL_DIR}" "${REMOTE_DIR}" \
            --size-only \
            --exclude "/ai/**" \
            --exclude "/ai/" \
            --exclude "/node_modules/**" \
            --exclude "/.venv/**" \
            --fast-list \
            --max-backlog=100000 \
            --combined="${INVENTORY_FILE}" \
            --stats=10s \
            --stats-one-line-date \
            --stats-log-level=NOTICE \
            --log-level=NOTICE 2> >(grep -v "file not in Local file system" > "${ERROR_LOG}" 2>/dev/null || true) &
    fi
    local rclone_check_pid=$!
    local elapsed=0
    while kill -0 "$rclone_check_pid" 2>/dev/null; do
        print_status "Inventory running... elapsed ${elapsed}s"
        sleep 10
        elapsed=$((elapsed + 10))
    done
    wait "$rclone_check_pid" || check_exit=$?
    
    # Handle timeout or interruption
    if [ $check_exit -eq 124 ] || [ $check_exit -eq 130 ]; then
        print_warning "Inventory check timed out or was interrupted"
        print_status "Proceeding with sync (will check files during transfer)..."
        rm -f "${INVENTORY_FILE}" 2>/dev/null || true
        return 0
    fi
    
    # Count differences using the combined file (preferred for structured results)
    local missing_count=0
    local differ_count=0
    local match_count=0
    
    # Also try to count from combined file if available (for detailed breakdown)
    if [ -f "${INVENTORY_FILE}" ] && [ -s "${INVENTORY_FILE}" ]; then
        # The combined file uses + prefix for missing files, - for extra, ! for differ
        local file_missing=$(grep -c "^+" "${INVENTORY_FILE}" 2>/dev/null || echo "0")
        local file_differ=$(grep -c "^!" "${INVENTORY_FILE}" 2>/dev/null || echo "0")
        local file_match=$(grep -c "^=" "${INVENTORY_FILE}" 2>/dev/null || echo "0")
        
        # Use combined file counts if output didn't give us numbers
        if [ "$missing_count" = "0" ] && [ "$file_missing" != "0" ]; then
            missing_count=$file_missing
        fi
        if [ "$differ_count" = "0" ] && [ "$file_differ" != "0" ]; then
            differ_count=$file_differ
        fi
        if [ "$match_count" = "0" ] && [ "$file_match" != "0" ]; then
            match_count=$file_match
        fi
    fi
    
    # Strip any whitespace/newlines and ensure numeric
    missing_count=$(echo "$missing_count" | tr -d '[:space:]' | grep -E '^[0-9]+$' || echo "0")
    differ_count=$(echo "$differ_count" | tr -d '[:space:]' | grep -E '^[0-9]+$' || echo "0")
    match_count=$(echo "$match_count" | tr -d '[:space:]' | grep -E '^[0-9]+$' || echo "0")
    
    local total_to_sync=$((missing_count + differ_count))
    
    echo ""
    print_status "Inventory Results:"
    if [ "$match_count" -gt 0 ]; then
        print_status "  ✅ Files already synced: ${match_count}"
    fi

    # Compute extra (present only on remote)
    local extra_count=0
    if [ -f "${INVENTORY_FILE}" ] && [ -s "${INVENTORY_FILE}" ]; then
        extra_count=$(grep -c "^-" "${INVENTORY_FILE}" 2>/dev/null || echo "0")
        extra_count=$(echo "$extra_count" | tr -d '[:space:]' | grep -E '^[0-9]+$' || echo "0")
    fi

    # Show detailed breakdown
    if [ "$missing_count" -gt 0 ]; then
        print_warning "  ➕ Missing on remote: ${missing_count}"
    fi
    if [ "$differ_count" -gt 0 ]; then
        print_warning "  ❗ Size differs: ${differ_count}"
    fi
    if [ "$extra_count" -gt 0 ]; then
        print_warning "  ➖ Extra on remote: ${extra_count}"
    fi

    # Decide if we should proceed to sync
    if [ $check_exit -ne 0 ] || [ "$missing_count" -gt 0 ] || [ "$differ_count" -gt 0 ] || [ "$extra_count" -gt 0 ]; then
        echo ""
        return 0
    else
        print_status "  ✅ All files are already synced!"
        echo ""
        return 1
    fi
}


# Main sync function with safe resume and progress
sync_files() {
    local skip_inventory="${1:-false}"
    local mirror_mode="${2:-false}"
    
    if [ "$mirror_mode" = "true" ]; then
        print_header "🪞 Mirroring files to remote (will delete extra files on remote)"
    else
        print_header "📁 Syncing files to remote (size-only mode with safe resume)"
    fi
    print_status "Source: ${LOCAL_DIR}"
    print_status "Destination: ${REMOTE_DIR}"
    print_status "Excluding: ai/, node_modules/, .venv/"
    print_status ""
    print_status "💡 Performance Tips:"
    print_status "  - Use --skip-inventory to start syncing immediately"
    print_status "  - Large transfers may take hours - the script can be safely interrupted"
    print_status "  - Progress is saved - resume anytime by running the script again"
    print_status ""
    
    # Setup partial directory for safe resume
    setup_partial_dir
    
    # Run inventory first (unless skipped)
    if [ "$skip_inventory" != "true" ]; then
        print_status "💡 Tip: Use --skip-inventory to bypass this check and start syncing immediately"
        print_status ""
        if ! run_inventory; then
            print_status "✅ Everything is already synced. No files to transfer."
            return 0
        fi
    else
        print_status "Skipping inventory check - starting sync immediately..."
    fi
    
    print_header "🚀 Starting transfer..."
    print_status "Press Ctrl+C to safely stop (uploads will be resumed on next run)"
    echo ""
    print_status "📊 Transfer Statistics:"
    print_status "  - Progress updates every 5 seconds"
    print_status "  - Log file: ${PARTIAL_DIR}/rclone.log"
    print_status "  - Multiple files transfer in parallel for faster throughput"
    print_status ""
    
    # Use rclone copy with safety features optimized for Google Drive:
    # Rclone automatically handles partial files with .partial suffix on remote for safe resume
    # --size-only: Only transfer if sizes differ (removes need for --check-first)
    # --fast-list: Faster directory listing (Google Drive supports this)
    # --progress: Show per-file progress
    # --stats: Show transfer stats including speed
    # --stats-one-line-date: Compact stats with date
    # --transfers: Higher parallel transfers for Google Drive (API allows more)
    # --checkers: Higher parallel checkers for faster comparison
    # Google Drive specific optimizations:
    # --drive-chunk-size: Larger chunks for better throughput
    # --drive-upload-cutoff: Use resumable uploads for larger files
    # --tpslimit: Limit transactions per second to avoid rate limits
    # --tpslimit-burst: Allow bursts for better performance
    
    # Detect if this is Google Drive and apply optimizations
    local is_gdrive=false
    if echo "${REMOTE_DIR}" | grep -q "^gdrive:"; then
        is_gdrive=true
        print_status "Detected Google Drive - applying performance optimizations..."
    fi
    
    # Choose copy (additive) or sync (mirror) based on mode
    local rclone_cmd="copy"
    if [ "$mirror_mode" = "true" ]; then
        rclone_cmd="sync"
        print_warning "⚠️  Mirror mode: Files on remote not present locally will be DELETED"
        print_status ""
    fi
    
    if [ "$is_gdrive" = "true" ]; then
        # Google Drive optimized settings for large transfers
        # More aggressive settings for better throughput while staying within API limits
        rclone ${rclone_cmd} "${LOCAL_DIR}" "${REMOTE_DIR}" \
            --size-only \
            --exclude "/ai/**" \
            --exclude "/ai/" \
            --exclude "/node_modules/**" \
            --exclude "/.venv/**" \
            --fast-list \
            --progress \
            --stats=5s \
            --stats-one-line-date \
            --stats-log-level=NOTICE \
            --transfers=32 \
            --checkers=64 \
            --buffer-size=256M \
            --drive-chunk-size=128M \
            --drive-upload-cutoff=64M \
            --drive-server-side-across-configs \
            --drive-use-trash=false \
            --tpslimit=20 \
            --tpslimit-burst=40 \
            --use-mmap \
            --low-level-retries=10 \
            --retries=3 \
            --log-level=INFO \
            --log-file="${PARTIAL_DIR}/rclone.log" &
    else
        # Generic settings for other remotes
        rclone ${rclone_cmd} "${LOCAL_DIR}" "${REMOTE_DIR}" \
            --size-only \
            --exclude "/ai/**" \
            --exclude "/ai/" \
            --exclude "/node_modules/**" \
            --exclude "/.venv/**" \
            --fast-list \
            --progress \
            --stats=5s \
            --stats-one-line-date \
            --stats-log-level=NOTICE \
            --transfers=8 \
            --checkers=16 \
            --buffer-size=64M \
            --use-mmap \
            --log-level=INFO \
            --log-file="${PARTIAL_DIR}/rclone.log" &
    fi
    
    RCLONE_PID=$!
    wait $RCLONE_PID
    local exit_code=$?
    
    # Check exit code
    case $exit_code in
        0)
            print_status ""
            print_status "✅ Sync completed successfully!"
            # Clean up partial dir on success
            rm -rf "${PARTIAL_DIR}" 2>/dev/null || true
            ;;
        1)
            print_error "❌ Sync failed with a fatal error"
            print_status "Check log: ${PARTIAL_DIR}/rclone.log"
            return 1
            ;;
        *)
        print_warning "⚠️  Sync interrupted or had non-fatal errors (exit code: $exit_code)"
        print_status "Partial files with .partial suffix on remote will be resumed automatically on next run"
        print_status "Check log: ${PARTIAL_DIR}/rclone.log"
            ;;
    esac
    
    return $exit_code
}

# Show what would be transferred (dry run)
dry_run() {
    print_header "🔍 Dry run - showing what would be transferred"
    print_status "Source: ${LOCAL_DIR}"
    print_status "Destination: ${REMOTE_DIR}"
    print_status ""
    
    # Run inventory for dry run
    run_inventory
    
    print_header "📋 Files that would be transferred (dry run):"
    rclone copy "${LOCAL_DIR}" "${REMOTE_DIR}" \
        --size-only \
        --exclude "/ai/**" \
        --exclude "/ai/" \
        --exclude "/node_modules/**" \
        --exclude "/.venv/**" \
        --dry-run \
        --fast-list \
        --progress \
        --stats=5s \
        --stats-one-line-date \
        --transfers=8 \
        --checkers=16
}

# Show help
show_help() {
    echo "Usage: $0 [REMOTE_NAME] [OPTIONS]"
    echo ""
    echo "Arguments:"
    echo "  REMOTE_NAME         Optional rclone remote name (e.g., 'gdrive:', 's3:', 'dropbox:')"
    echo "                      If not provided, uses RCLONE_REMOTE environment variable"
    echo ""
    echo "Options:"
    echo "  --dry-run, -n       Show what would be transferred without actually transferring"
    echo "  --inventory, -i     Only run inventory check, don't transfer"
    echo "  --skip-inventory   Skip inventory check and proceed directly to sync"
    echo "  --mirror            Mirror mode: delete files on remote that don't exist locally"
    echo "                      (default: copy mode, only adds/updates files)"
    echo "  --help, -h          Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  RCLONE_REMOTE       Your rclone remote name (e.g., 'gdrive:', 's3:', 'dropbox:')"
    echo "                      Used if not provided as argument"
    echo ""
    echo "Features:"
    echo "  - Safe resume: Partial uploads are saved and can be resumed"
    echo "  - Size-only: Only transfers files with different sizes"
    echo "  - Progress tracking: Shows upload speed and transfer progress"
    echo "  - Graceful shutdown: Press Ctrl+C to safely stop (can resume later)"
    echo "  - Optional inventory check (can skip if slow)"
    echo "  - Mirror mode: Use --mirror to make remote exactly match local (deletes extras)"
    echo ""
    echo "Note: If inventory check is slow, use --skip-inventory to bypass it"
    echo ""
}

# Main execution
main() {
    print_header "🚀 Starting rclone sync"
    print_status "Remote: ${REMOTE_NAME}"
    print_status ""
    
    # Parse arguments
    # Skip the first argument if it's a remote name (already processed above)
    local skip_inventory=false
    local mirror_mode=false
    local arg=""
    
    # Collect all flags (handle multiple flags)
    local args=()
    if [ -n "$1" ] && [[ ! "$1" =~ ^- ]]; then
        # First arg is remote name, collect remaining args
        shift
        args=("$@")
    else
        # All args are flags
        args=("$@")
    fi
    
    # Process flags
    for flag in "${args[@]}"; do
        case "$flag" in
            --skip-inventory)
                skip_inventory=true
                ;;
            --mirror)
                mirror_mode=true
                ;;
        esac
    done
    
    # Get the main action flag (last one, or first if only one)
    if [ ${#args[@]} -gt 0 ]; then
        arg="${args[-1]}"
    else
        arg=""
    fi
    
    # Require remote name for all operations except help
    if [ -z "$REMOTE_NAME" ] && [[ ! "$arg" =~ ^(--help|-h)$ ]]; then
        print_error "Remote name not provided."
        print_status "Please provide it as an argument: $0 <remote_name>:"
        print_status "Or set it as an environment variable: export RCLONE_REMOTE='gdrive:'"
        print_status ""
        print_status "Available remotes:"
        rclone listremotes 2>/dev/null || print_warning "No remotes configured. Run 'rclone config' first."
        exit 1
    fi
    
    # Verify remote exists unless showing help
    if [[ ! "$arg" =~ ^(--help|-h)$ ]] && [ -n "$REMOTE_NAME" ]; then
        if ! rclone listremotes | grep -q "^${REMOTE_NAME}"; then
            print_error "Remote '${REMOTE_NAME}' not found in rclone configuration."
            print_status "Available remotes:"
            rclone listremotes
            exit 1
        fi
    fi
    
    case "$arg" in
        --dry-run|-n)
            dry_run
            ;;
        --inventory|-i)
            run_inventory
            ;;
        --skip-inventory|--mirror|"")
            # These trigger sync, mirror mode handled via variable
            sync_files "$skip_inventory" "$mirror_mode"
            ;;
        --help|-h)
            show_help
            ;;
        *)
            # Only show error if it's actually a flag/option (starts with --)
            if [[ "$arg" =~ ^-- ]]; then
                print_error "Unknown option: $arg"
                show_help
                exit 1
            else
                # If it's not a flag, just run sync (might be a second positional arg we ignore)
                sync_files "$skip_inventory" "$mirror_mode"
            fi
            ;;
    esac
}

# Run main function
main "$@"

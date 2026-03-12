#!/usr/bin/env bash
#
# Portable Home Backup Installer
# Deploys the home directory backup system to any server
# 
# Usage:
#   curl -fsSL https://your-server/deploy-home-backup.sh | bash
#   OR
#   ./deploy-home-backup.sh
#
# Prerequisites:
#   - rclone installed and configured with a remote (e.g., 'drive')
#   - systemd-based system
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration defaults
RCLONE_REMOTE="${RCLONE_REMOTE:-drive}"
BACKUP_DIR="${BACKUP_DIR:-backups/home}"
MAX_BACKUPS="${MAX_BACKUPS:-3}"
BACKUP_TIMES="${BACKUP_TIMES:-06:00,18:00}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
SYSTEMD_DIR="${SYSTEMD_DIR:-$HOME/.config/systemd/user}"

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    log_error "This script should NOT be run as root. Run as your regular user."
    exit 1
fi

# Banner
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           HOME DIRECTORY BACKUP INSTALLER                    ║"
echo "║           Streams to Google Drive with Rotation              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
log_info "Checking prerequisites..."

# Check for rclone
if ! command -v rclone &> /dev/null; then
    log_error "rclone is not installed."
    echo ""
    echo "Install rclone with one of:"
    echo "  curl https://rclone.org/install.sh | sudo bash"
    echo "  sudo apt install rclone"
    echo "  sudo dnf install rclone"
    echo "  brew install rclone"
    exit 1
fi
log_success "rclone found: $(rclone version | head -1)"

# Check for systemd
if ! command -v systemctl &> /dev/null; then
    log_error "systemctl not found. This script requires systemd."
    exit 1
fi
log_success "systemd available"

# Check if rclone is configured
if ! rclone listremotes 2>/dev/null | grep -q "^${RCLONE_REMOTE}:$"; then
    log_error "rclone remote '${RCLONE_REMOTE}' not found."
    echo ""
    echo "Available remotes:"
    rclone listremotes 2>/dev/null || echo "  (none configured)"
    echo ""
    echo "Configure rclone first:"
    echo "  rclone config"
    echo ""
    echo "Or set the correct remote:"
    echo "  RCLONE_REMOTE=yourremote ./deploy-home-backup.sh"
    exit 1
fi
log_success "rclone remote '${RCLONE_REMOTE}' is configured"

# Test rclone connection
log_info "Testing rclone connection..."
if ! rclone lsd "${RCLONE_REMOTE}:" &> /dev/null; then
    log_error "Cannot connect to rclone remote '${RCLONE_REMOTE}'. Check your configuration."
    exit 1
fi
log_success "rclone connection successful"

# Create installation directory
log_info "Creating installation directory: ${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}"

# Create the backup script
log_info "Installing backup script..."
cat > "${INSTALL_DIR}/backup-home.sh" << 'BACKUP_SCRIPT'
#!/usr/bin/env bash
#
# Home Directory Backup Script
# Backs up home folder to Google Drive with rotation
# Streams directly to GDrive to avoid local storage issues
#

set -euo pipefail

# Configuration - can be overridden via environment variables
BACKUP_SOURCE="${BACKUP_SOURCE:-$HOME}"
BACKUP_REMOTE="${BACKUP_REMOTE:-drive:backups/home}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="home_backup_${TIMESTAMP}.tar.gz"
MAX_BACKUPS="${MAX_BACKUPS:-3}"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting home directory backup"
log "Source: ${BACKUP_SOURCE}"
log "Backup name: ${BACKUP_NAME}"

# Create the tar.gz archive and stream directly to Google Drive
log "Creating archive and streaming to Google Drive..."

# Use tar with exclusions - stream directly to rclone
tar --create \
    --gzip \
    --directory="${BACKUP_SOURCE}" \
    --exclude="node_modules" \
    --exclude=".venv" \
    --exclude="venv" \
    --exclude="__pycache__" \
    --exclude=".npm" \
    --exclude=".yarn" \
    --exclude=".pnpm-store" \
    --exclude=".cache" \
    --exclude=".local/share/Trash" \
    --exclude=".pytest_cache" \
    --exclude=".mypy_cache" \
    --exclude=".ruff_cache" \
    --exclude=".idea" \
    --exclude=".vscode-server" \
    --exclude=".mozilla" \
    --exclude=".thunderbird" \
    --exclude=".config/google-chrome" \
    --exclude=".config/chromium" \
    --exclude="*.tar.gz" \
    --exclude="*.tar.bz2" \
    --exclude="*.tar.xz" \
    --exclude="*.zip" \
    --exclude="*.7z" \
    --exclude="*.rar" \
    --exclude="*.pyc" \
    --exclude="*.pyo" \
    --exclude="*.log" \
    --exclude="*.tmp" \
    --exclude="*.qcow2" \
    --exclude="*.vmdk" \
    --exclude="*.vdi" \
    --exclude=".conda" \
    --exclude=".vagrant" \
    --exclude=".docker" \
    --one-file-system \
    --ignore-failed-read \
    . 2>&1 | rclone rcat "${BACKUP_REMOTE}/${BACKUP_NAME}" \
        --progress \
        --transfers 1 \
        --timeout 600s \
        --retries 3 \
        --low-level-retries 10

log "Upload complete"

# Rotate old backups - keep only MAX_BACKUPS
log "Rotating old backups (keeping ${MAX_BACKUPS} most recent)..."

# List all backup files sorted by name (oldest first)
BACKUP_FILES=$(rclone lsf "${BACKUP_REMOTE}" --files-only | grep "home_backup_" | sort)

# Count backups
BACKUP_COUNT=$(echo "${BACKUP_FILES}" | grep -c . || true)
log "Found ${BACKUP_COUNT} existing backups"

# Delete old backups if we have more than MAX_BACKUPS
if [[ ${BACKUP_COUNT} -gt ${MAX_BACKUPS} ]]; then
    # Calculate how many to delete
    DELETE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
    log "Need to delete ${DELETE_COUNT} old backup(s)"
    
    # Get the oldest backups to delete
    OLD_BACKUPS=$(echo "${BACKUP_FILES}" | head -n ${DELETE_COUNT})
    
    for backup in ${OLD_BACKUPS}; do
        log "Deleting old backup: ${backup}"
        rclone delete "${BACKUP_REMOTE}/${backup}"
    done
    
    log "Rotation complete"
else
    log "No rotation needed (${BACKUP_COUNT} <= ${MAX_BACKUPS})"
fi

# List current backups
log "Current backups:"
rclone lsf "${BACKUP_REMOTE}" --files-only | grep "home_backup_" | sort -r

# Get backup size from rclone
BACKUP_SIZE=$(rclone size "${BACKUP_REMOTE}/${BACKUP_NAME}" | grep -oP 'Total size: \K.*' || echo "unknown")

log "Backup completed successfully!"
log "Backup file: ${BACKUP_NAME}"
log "Size: ${BACKUP_SIZE}"
log "Location: ${BACKUP_REMOTE}/${BACKUP_NAME}"
BACKUP_SCRIPT

chmod +x "${INSTALL_DIR}/backup-home.sh"
log_success "Backup script installed to ${INSTALL_DIR}/backup-home.sh"

# Create systemd user directory
log_info "Creating systemd user directory: ${SYSTEMD_DIR}"
mkdir -p "${SYSTEMD_DIR}"

# Parse backup times
FIRST_TIME=$(echo "${BACKUP_TIMES}" | cut -d',' -f1)
SECOND_TIME=$(echo "${BACKUP_TIMES}" | cut -d',' -f2)

# Create systemd service file
log_info "Installing systemd service..."
cat > "${SYSTEMD_DIR}/home-backup.service" << SERVICE_FILE
[Unit]
Description=Home Directory Backup to Google Drive
Documentation=man:backup-home(1)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=${INSTALL_DIR}/backup-home.sh
Environment="BACKUP_REMOTE=${RCLONE_REMOTE}:${BACKUP_DIR}"
Environment="MAX_BACKUPS=${MAX_BACKUPS}"
TimeoutStartSec=4h
TimeoutStopSec=5min

# Nice settings for background operation
Nice=19
IOSchedulingClass=idle

[Install]
WantedBy=default.target
SERVICE_FILE
log_success "Service file installed"

# Create systemd timer file
log_info "Installing systemd timer..."
cat > "${SYSTEMD_DIR}/home-backup.timer" << TIMER_FILE
[Unit]
Description=Twice-daily home directory backup timer
Documentation=man:backup-home(1)

[Timer]
# Run twice daily at specified times with randomization
OnCalendar=*-*-* ${FIRST_TIME}:00
OnCalendar=*-*-* ${SECOND_TIME}:00
RandomizedDelaySec=1800
Persistent=true

[Install]
WantedBy=timers.target
TIMER_FILE
log_success "Timer file installed"

# Reload systemd
log_info "Reloading systemd daemon..."
systemctl --user daemon-reload

# Enable the timer
log_info "Enabling backup timer..."
systemctl --user enable home-backup.timer

# Create backup directory on remote
log_info "Creating backup directory on remote: ${RCLONE_REMOTE}:${BACKUP_DIR}"
rclone mkdir "${RCLONE_REMOTE}:${BACKUP_DIR}" 2>/dev/null || true

# Summary
echo ""
echo "════════════════════════════════════════════════════════════════"
echo -e "${GREEN}INSTALLATION COMPLETE!${NC}"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Configuration:"
echo "  • Remote:        ${RCLONE_REMOTE}:${BACKUP_DIR}"
echo "  • Max backups:   ${MAX_BACKUPS}"
echo "  • Schedule:      ${FIRST_TIME} and ${SECOND_TIME} daily"
echo "  • Script:        ${INSTALL_DIR}/backup-home.sh"
echo ""
echo "Commands:"
echo "  • Start backup now:     systemctl --user start home-backup.service"
echo "  • View backup status:   systemctl --user status home-backup.service"
echo "  • View timer status:    systemctl --user list-timers home-backup.timer"
echo "  • View logs:            journalctl --user -u home-backup.service"
echo "  • List remote backups:  rclone ls ${RCLONE_REMOTE}:${BACKUP_DIR}"
echo ""
echo "To run a test backup now, run:"
echo "  systemctl --user start home-backup.service"
echo ""

# Ask if user wants to run a test backup
read -p "Run a test backup now? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "Starting test backup..."
    systemctl --user start home-backup.service
    log_info "Backup started. Monitor with: systemctl --user status home-backup.service"
fi

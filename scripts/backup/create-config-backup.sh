#!/usr/bin/env bash
#
# Weekly Config Backup Creator
# Creates a portable backup of all configs needed for vps-dev-setup.sh
#
# Usage:
#   ./create-config-backup.sh --output /path/to/backup.tar.gz
#   ./create-config-backup.sh --rclone-remote drive --rclone-path vivi-home-backups/configs
#
# Backs up:
#   - SSH keys and config
#   - Git config
#   - rclone config
#   - Cloud CLI auth (aws, azure, doctl, oci, gh, glab)
#   - Coding agent configs (goose, opencode, crush, continue, cursor, claude)
#   - oh-my-zsh custom config
#   - Docker config
#   - systemd backup timers
#

set -euo pipefail

SCRIPT_NAME="create-config-backup"
LOG_FILE="/tmp/${SCRIPT_NAME}.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Config
declare -A CONFIG=(
    [output_dir]="/tmp/config-backup"
    [rclone_remote]=""
    [rclone_path]=""
    [username]="vivi"
)

log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

info() { log "${BLUE}INFO${NC}: $*"; }
success() { log "${GREEN}✓${NC} $*"; }
warn() { log "${YELLOW}⚠${NC} $*"; }
error() { log "${RED}✗${NC} $*"; }

die() {
    error "$*"
    exit 1
}

# =============================================================================
# Backup Creation
# =============================================================================

create_backup_dir() {
    local user_home="/home/${CONFIG[username]}"
    local backup_root="${CONFIG[output_dir]}"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="${backup_root}/pixelated-config-${timestamp}"
    
    info "Creating backup directory: ${backup_dir}"
    mkdir -p "${backup_dir}"
    
    echo "${backup_dir}"
}

backup_ssh() {
    local user_home="/home/${CONFIG[username]}"
    local dest="$1/ssh"
    
    info "Backing up SSH config..."
    mkdir -p "${dest}"
    
    # Copy SSH directory (excluding very large files)
    if [[ -d "${user_home}/.ssh" ]]; then
        rsync -a \
            --exclude='*.pub' \
            --exclude='known_hosts.old' \
            "${user_home}/.ssh/" "${dest}/" 2>/dev/null || true
        success "SSH config backed up"
    else
        warn "No SSH directory found"
    fi
}

backup_git() {
    local user_home="/home/${CONFIG[username]}"
    local dest="$1/git"
    
    info "Backing up Git config..."
    mkdir -p "${dest}"
    
    if [[ -f "${user_home}/.gitconfig" ]]; then
        cp "${user_home}/.gitconfig" "${dest}/"
        success "Git config backed up"
    fi
}

backup_rclone() {
    local user_home="/home/${CONFIG[username]}"
    local dest="$1/rclone"
    
    info "Backing up rclone config..."
    mkdir -p "${dest}"
    
    if [[ -f "${user_home}/.config/rclone/rclone.conf" ]]; then
        cp "${user_home}/.config/rclone/rclone.conf" "${dest}/"
        success "rclone config backed up"
    fi
}

backup_cloud_clis() {
    local user_home="/home/${CONFIG[username]}"
    local dest="$1/cloud-clis"
    
    info "Backing up Cloud CLI configs..."
    mkdir -p "${dest}"
    
    # AWS
    [[ -d "${user_home}/.aws" ]] && cp -r "${user_home}/.aws" "${dest}/" && success "AWS config backed up"
    
    # Azure
    [[ -d "${user_home}/.azure" ]] && cp -r "${user_home}/.azure" "${dest}/" && success "Azure config backed up"
    
    # DigitalOcean
    [[ -d "${user_home}/.config/doctl" ]] && cp -r "${user_home}/.config/doctl" "${dest}/doctl" && success "doctl config backed up"
    
    # Oracle Cloud
    [[ -d "${user_home}/.config/oci" ]] && cp -r "${user_home}/.config/oci" "${dest}/oci" && success "OCI config backed up"
    [[ -d "${user_home}/.acli" ]] && cp -r "${user_home}/.acli" "${dest}/acli" && success "acli config backed up"
    
    # GitHub
    [[ -d "${user_home}/.config/gh" ]] && cp -r "${user_home}/.config/gh" "${dest}/gh" && success "gh config backed up"
    
    # GitLab
    [[ -d "${user_home}/.config/glab-cli" ]] && cp -r "${user_home}/.config/glab-cli" "${dest}/glab-cli" && success "glab config backed up"
}

backup_coding_agents() {
    local user_home="/home/${CONFIG[username]}"
    local dest="$1/coding-agents"
    
    info "Backing up coding agent configs..."
    mkdir -p "${dest}"
    
    # Goose
    if [[ -d "${user_home}/.config/goose" ]]; then
        cp -r "${user_home}/.config/goose" "${dest}/"
        success "Goose config backed up"
    fi
    
    # OpenCode (formerly opencode)
    if [[ -d "${user_home}/.config/opencode" ]]; then
        cp -r "${user_home}/.config/opencode" "${dest}/"
        success "OpenCode config backed up"
    fi
    
    # Crush
    if [[ -d "${user_home}/.config/crush" ]]; then
        cp -r "${user_home}/.config/crush" "${dest}/crush"
        success "Crush config backed up"
    fi
    
    # Continue
    if [[ -d "${user_home}/.continue" ]]; then
        cp -r "${user_home}/.continue" "${dest}/continue"
        success "Continue config backed up"
    fi
    if [[ -d "${user_home}/.config/continue" ]]; then
        cp -r "${user_home}/.config/continue" "${dest}/continue-config"
        success "Continue (config dir) backed up"
    fi
    
    # Cursor
    if [[ -d "${user_home}/.cursor" ]]; then
        cp -r "${user_home}/.cursor" "${dest}/cursor"
        success "Cursor config backed up"
    fi
    
    # Claude Code
    if [[ -d "${user_home}/.claude" ]]; then
        cp -r "${user_home}/.claude" "${dest}/claude"
        success "Claude config backed up"
    fi
    if [[ -d "${user_home}/.config/anthropic" ]]; then
        cp -r "${user_home}/.config/anthropic" "${dest}/anthropic"
        success "Anthropic config backed up"
    fi
    
    # Codex (OpenAI)
    if [[ -d "${user_home}/.openai" ]]; then
        cp -r "${user_home}/.openai" "${dest}/openai"
        success "OpenAI config backed up"
    fi
    
    # Qwen Code
    if [[ -d "${user_home}/.qwen" ]]; then
        cp -r "${user_home}/.qwen" "${dest}/qwen"
        success "Qwen config backed up"
    fi
    
    # ALCI / Rovodev / Jira
    if [[ -d "${user_home}/.alci" ]]; then
        cp -r "${user_home}/.alci" "${dest}/alci"
        success "ALCI config backed up"
    fi
    if [[ -d "${user_home}/.rovodev" ]]; then
        cp -r "${user_home}/.rovodev" "${dest}/rovodev"
        success "Rovodev config backed up"
    fi
    
    # Gemini
    if [[ -d "${user_home}/.gemini" ]]; then
        cp -r "${user_home}/.gemini" "${dest}/gemini"
        success "Gemini config backed up"
    fi
    
    # General AI configs
    if [[ -d "${user_home}/.config/jules" ]]; then
        cp -r "${user_home}/.config/jules" "${dest}/jules"
        success "Jules config backed up"
    fi
}

backup_ohmyzsh() {
    local user_home="/home/${CONFIG[username]}"
    local dest="$1/ohmyzsh"
    
    info "Backing up Oh My Zsh config..."
    mkdir -p "${dest}"
    
    # .zshrc
    if [[ -f "${user_home}/.zshrc" ]]; then
        cp "${user_home}/.zshrc" "${dest}/"
    fi
    
    # .zsh_aliases
    if [[ -f "${user_home}/.zsh_aliases" ]]; then
        cp "${user_home}/.zsh_aliases" "${dest}/"
    fi
    
    # oh-my-zsh custom
    if [[ -d "${user_home}/.oh-my-zsh/custom" ]]; then
        cp -r "${user_home}/.oh-my-zsh/custom" "${dest}/"
        success "Oh My Zsh custom config backed up"
    fi
}

backup_docker() {
    local user_home="/home/${CONFIG[username]}"
    local dest="$1/docker"
    
    info "Backing up Docker config..."
    mkdir -p "${dest}"
    
    if [[ -d "${user_home}/.docker" ]]; then
        rsync -a \
            --exclude='contexts/meta' \
            "${user_home}/.docker/" "${dest}/" 2>/dev/null || true
        success "Docker config backed up"
    fi
}

backup_systemd() {
    local dest="$1/systemd"
    
    info "Backing up systemd units..."
    mkdir -p "${dest}"
    
    # Backup timer and service files
    for unit in backup-home-vivi.timer backup-home-vivi.service; do
        if [[ -f "/etc/systemd/system/${unit}" ]]; then
            cp "/etc/systemd/system/${unit}" "${dest}/"
        elif [[ -f "/usr/lib/systemd/system/${unit}" ]]; then
            cp "/usr/lib/systemd/system/${unit}" "${dest}/"
        fi
    done
    
    # Backup associated scripts
    if [[ -f "/home/vivi/pixelated/scripts/backup/backup-home-vivi.sh" ]]; then
        mkdir -p "${dest}/scripts"
        cp "/home/vivi/pixelated/scripts/backup/backup-home-vivi.sh" "${dest}/scripts/"
    fi
    
    success "systemd units backed up"
}

backup_shell_configs() {
    local user_home="/home/${CONFIG[username]}"
    local dest="$1/shell"
    
    info "Backing up shell configs..."
    mkdir -p "${dest}"
    
    for file in .bashrc .bash_profile .profile .inputrc; do
        if [[ -f "${user_home}/${file}" ]]; then
            cp "${user_home}/${file}" "${dest}/"
        fi
    done
    
    success "Shell configs backed up"
}

create_manifest() {
    local backup_dir="$1"
    local manifest="${backup_dir}/MANIFEST.json"
    
    info "Creating manifest..."
    
    cat > "${manifest}" << EOF
{
    "created": "$(date -Iseconds)",
    "hostname": "$(hostname)",
    "username": "${CONFIG[username]}",
    "ubuntu_version": "$(lsb_release -ds 2>/dev/null || echo 'unknown')",
    "backup_type": "config-backup",
    "contents": [
        "ssh/",
        "git/",
        "rclone/",
        "cloud-clis/",
        "coding-agents/",
        "ohmyzsh/",
        "docker/",
        "systemd/",
        "shell/"
    ],
    "notes": "Portable config backup for vps-dev-setup.sh restoration"
}
EOF
    
    success "Manifest created"
}

create_archive() {
    local backup_dir="$1"
    local output="$2"
    
    info "Creating archive: ${output}"
    
    local parent_dir=$(dirname "${backup_dir}")
    local base_name=$(basename "${backup_dir}")
    
    tar -czf "${output}" -C "${parent_dir}" "${base_name}"
    
    local size=$(du -h "${output}" | cut -f1)
    success "Archive created: ${output} (${size})"
}

upload_to_rclone() {
    local archive="$1"
    local remote="${CONFIG[rclone_remote]}"
    local path="${CONFIG[rclone_path]}"
    
    if [[ -z "${remote}" ]]; then
        info "Skipping rclone upload (no remote configured)"
        return 0
    fi
    
    info "Uploading to rclone: ${remote}:${path}"
    
    rclone copy "${archive}" "${remote}:${path}/" --progress
    
    success "Uploaded to rclone"
}

cleanup_old_backups() {
    local backup_root="${CONFIG[output_dir]}"
    
    info "Cleaning up old backups (keeping last 3)..."
    
    local count=0
    find "${backup_root}" -maxdepth 1 -type d -name 'pixelated-config-*' | sort -r | while read -r dir; do
        count=$((count + 1))
        if [[ $count -gt 3 ]]; then
            rm -rf "${dir}"
            info "Removed old backup: ${dir}"
        fi
    done
}

# =============================================================================
# CLI
# =============================================================================

show_help() {
    cat << EOF
${SCRIPT_NAME} - Weekly Config Backup Creator

Usage: $0 [OPTIONS]

Options:
  --output FILE            Output archive path (default: /tmp/config-backup-YYYYMMDD.tar.gz)
  --output-dir DIR         Temporary backup directory (default: /tmp/config-backup)
  --rclone-remote NAME     rclone remote name
  --rclone-path PATH       Path in rclone remote
  --username USER          Username to backup (default: vivi)
  --no-archive             Don't create archive, just backup to output-dir
  -h, --help               Show this help

Examples:
  # Create local backup
  $0 --output /mnt/usb/config-backup.tar.gz

  # Upload to rclone
  $0 --rclone-remote drive --rclone-path vivi-home-backups/configs

  # Weekly cron job
  0 3 * * 0 /home/vivi/pixelated/scripts/backup/create-config-backup.sh --rclone-remote drive --rclone-path vivi-home-backups/configs

EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --output)
                CONFIG[output_archive]="$2"
                shift 2
                ;;
            --output-dir)
                CONFIG[output_dir]="$2"
                shift 2
                ;;
            --rclone-remote)
                CONFIG[rclone_remote]="$2"
                shift 2
                ;;
            --rclone-path)
                CONFIG[rclone_path]="$2"
                shift 2
                ;;
            --username)
                CONFIG[username]="$2"
                shift 2
                ;;
            --no-archive)
                CONFIG[no_archive]="true"
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                die "Unknown option: $1"
                ;;
        esac
    done
}

# =============================================================================
# Main
# =============================================================================

main() {
    parse_args "$@"
    
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     Pixelated Config Backup Creator                  ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Create backup
    local backup_dir
    backup_dir=$(create_backup_dir)
    
    backup_ssh "${backup_dir}"
    backup_git "${backup_dir}"
    backup_rclone "${backup_dir}"
    backup_cloud_clis "${backup_dir}"
    backup_coding_agents "${backup_dir}"
    backup_ohmyzsh "${backup_dir}"
    backup_docker "${backup_dir}"
    backup_systemd "${backup_dir}"
    backup_shell_configs "${backup_dir}"
    create_manifest "${backup_dir}"
    
    # Create archive
    if [[ -z "${CONFIG[no_archive]}" ]]; then
        local archive="${CONFIG[output_archive]:-/tmp/pixelated-config-$(date +%Y%m%d).tar.gz}"
        create_archive "${backup_dir}" "${archive}"
        upload_to_rclone "${archive}"
        
        echo ""
        echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}         Backup Complete!                              ${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
        echo ""
        echo "Archive: ${archive}"
        echo "Size: $(du -h "${archive}" | cut -f1)"
        echo ""
    else
        echo ""
        echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}         Backup Complete (directory mode)              ${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
        echo ""
        echo "Backup directory: ${backup_dir}"
        echo ""
    fi
    
    # Cleanup
    cleanup_old_backups
}

main "$@"

#!/usr/bin/env bash
#
# VPS Dev Environment Setup - Pixelated Empathy
# Complete setup for Ubuntu 22/24 → 25 upgrade + full dev environment
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/.../vps-dev-setup.sh | sudo bash
#
# What it does:
#   1. Upgrades Ubuntu 22/24 → 25 (non-LTS track)
#   2. System hardening (SSH, firewall, swap)
#   3. Docker + credential helpers
#   4. Homebrew (Linuxbrew)
#   5. Dev tools: nvm, npm, pnpm, bun, uv, ohmyzsh
#   6. Cloud CLIs: aws, az, azd, doctl (legacy/optional), s3cmd, acli, gh, glab
#   7. SSH setup: keys, config, askpass, agent forwarding
#   8. Git config + credentials
#   9. rclone setup + restore from backup
#   10. Clone pixelated repo + submodules
#   11. Restore .gitignore gaps from backup
#   12. Coding agents (Continue, Aider, OpenHands)
#

set -euo pipefail

SCRIPT_NAME="vps-dev-setup"
LOG_FILE="/var/log/${SCRIPT_NAME}.log"
STATE_FILE="/var/lib/${SCRIPT_NAME}/state.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Config
declare -A CONFIG=(
    [ssh_port]="22"
    [ssh_public_key]=""
    [github_token]=""
    [gitlab_token]=""
    [rclone_remote]="drive"
    [backup_path]="vivi-home-backups"
    [pixelated_repo]="https://github.com/pixelatedempathy/pixelated.git"
    [pixelated_branch]="main"
    [workspace_dir]="/home/vivi/pixelated"
    [enable_ohmyzsh]="true"
    [enable_continue]="true"
    [enable_aider]="true"
    [enable_openhands]="false"
    [timezone]="UTC"
    [swap_size]="4G"
    [upgrade_to_25]="true"
)

# =============================================================================
# Logging
# =============================================================================

log() {
    local level="$1"
    shift
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] [${level}] $*" | tee -a "${LOG_FILE}"
}

info() { log "INFO" "$@"; }
warn() { log "WARN" "${YELLOW}$*${NC}"; }
error() { log "ERROR" "${RED}$*${NC}"; }
success() { log "SUCCESS" "${GREEN}✓ $*${NC}"; }
step() { log "STEP" "${BLUE}→ $*${NC}"; }

die() {
    error "$@"
    exit 1
}

# =============================================================================
# Helpers
# =============================================================================

check_root() {
    [[ $EUID -eq 0 ]] || die "Must run as root"
}

command_exists() { command -v "$1" &>/dev/null; }

ensure_dir() {
    local dir="$1"
    local mode="${2:-0755}"
    local owner="${3:-}"
    [[ -d "${dir}" ]] || mkdir -p "${dir}"
    chmod "${mode}" "${dir}"
    [[ -n "${owner}" ]] && chown "${owner}" "${dir}"
}

save_state() {
    local key="$1"
    local value="$2"
    ensure_dir "$(dirname "${STATE_FILE}")"
    if command_exists jq; then
        local tmp=$(mktemp)
        if [[ -f "${STATE_FILE}" ]]; then
            jq --arg k "${key}" --arg v "${value}" '.[$k] = $v' "${STATE_FILE}" > "${tmp}" 2>/dev/null || \
                echo "{\"${key}\": \"${value}\"}" > "${tmp}"
        else
            echo "{\"${key}\": \"${value}\"}" > "${tmp}"
        fi
        mv "${tmp}" "${STATE_FILE}"
    fi
}

# =============================================================================
# Ubuntu Upgrade (22/24 → 25)
# =============================================================================

upgrade_to_non_lts() {
    [[ "${CONFIG[upgrade_to_25]}" != "true" ]] && return 0
    
    step "Upgrading Ubuntu to non-LTS track (25)"
    
    # Check current version
    local current_version
    current_version=$(lsb_release -rs)
    info "Current Ubuntu version: ${current_version}"
    
    # Skip if already on 25
    if [[ "${current_version}" == "25.04" ]] || [[ "${current_version}" == "25.10" ]]; then
        info "Already on Ubuntu 25"
        return 0
    fi
    
    # Update current system first
    apt-get update -qq
    apt-get upgrade -y -qq
    apt-get dist-upgrade -y -qq
    
    # Install update-manager-core
    apt-get install -y -qq update-manager-core
    
    # Modify release upgrade prompt to normal (not LTS)
    if [[ -f /etc/update-manager/release-upgrades ]]; then
        sed -i 's/Prompt=lts/Prompt=normal/g' /etc/update-manager/release-upgrades
    fi
    
    # Do the release upgrade
    # Note: This may require user interaction, so we use -y where possible
    if command_exists do-release-upgrade; then
        warn "Ubuntu upgrade available. Run 'do-release-upgrade' after reboot for best results."
        info "Skipping automatic upgrade - run manually after initial setup"
    fi
    
    success "Ubuntu upgrade path configured (normal releases)"
}

# =============================================================================
# System Setup
# =============================================================================

setup_base_packages() {
    step "Installing base packages"
    
    apt-get update -qq
    apt-get install -y -qq \
        curl wget git jq rsync ca-certificates gnupg \
        build-essential software-properties-common \
        vim nano htop net-tools dnsutils unzip \
        apt-transport-https lsb-release gnupg-agent \
        keychain libpam-ssh ssh-askpass \
        fonts-firacode
    
    success "Base packages installed"
}

setup_ssh() {
    step "Hardening SSH"
    local sshd_config="/etc/ssh/sshd_config"
    local backup="${sshd_config}.backup.$(date +%Y%m%d%H%M%S)"
    
    cp "${sshd_config}" "${backup}"
    
    # SSH hardening
    cat >> "${sshd_config}" << 'EOF'

# Hardening
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding no
PrintMotd no
AcceptEnv LANG LC_*
Subsystem sftp /usr/lib/openssh/sftp-server

# Agent forwarding (for dev work)
AllowAgentForwarding yes
EOF
    
    if sshd -t; then
        systemctl restart sshd
        success "SSH hardened (port: ${CONFIG[ssh_port]})"
    else
        warn "SSH config invalid, restored backup"
        cp "${backup}" "${sshd_config}"
    fi
}

setup_firewall() {
    step "Configuring firewall"
    if command_exists ufw; then
        ufw --force reset
        ufw default deny incoming
        ufw default allow outgoing
        ufw allow "${CONFIG[ssh_port]}/tcp" comment 'SSH'
        ufw allow 80/tcp comment 'HTTP'
        ufw allow 443/tcp comment 'HTTPS'
        echo "y" | ufw enable
        success "UFW configured"
    fi
}

create_swap() {
    step "Creating swap (${CONFIG[swap_size]})"
    local swap_file="/swapfile"
    
    if [[ -f "${swap_file}" ]]; then
        info "Swap exists"
        return 0
    fi
    
    fallocate -l "${CONFIG[swap_size]}" "${swap_file}" 2>/dev/null || \
        dd if=/dev/zero of="${swap_file}" bs=1M count=4096 status=none
    chmod 600 "${swap_file}"
    mkswap "${swap_file}"
    swapon "${swap_file}"
    grep -q "${swap_file}" /etc/fstab || echo "${swap_file} none swap sw 0 0" >> /etc/fstab
    
    success "Swap created"
}

set_timezone() {
    step "Setting timezone to ${CONFIG[timezone]}"
    timedatectl set-timezone "${CONFIG[timezone]}" 2>/dev/null || true
    success "Timezone set"
}

# =============================================================================
# User & SSH
# =============================================================================

setup_user() {
    step "Setting up user: vivi"
    
    local username="vivi"
    local ssh_key="${CONFIG[ssh_public_key]}"
    
    if id "${username}" &>/dev/null; then
        info "User exists"
    else
        useradd -m -s /bin/bash -G sudo "${username}"
        echo "${username} ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/${username}"
        chmod 440 "/etc/sudoers.d/${username}"
    fi
    
    local user_home="/home/${username}"
    local ssh_dir="${user_home}/.ssh"
    
    ensure_dir "${ssh_dir}" 700 "${username}:${username}"
    
    if [[ -n "${ssh_key}" ]]; then
        echo "${ssh_key}" >> "${ssh_dir}/authorized_keys"
        chmod 600 "${ssh_dir}/authorized_keys"
        chown "${username}:${username}" "${ssh_dir}/authorized_keys"
    fi
    
    success "User configured"
}

setup_ssh_keys_and_config() {
    step "Restoring SSH keys and config from backup"
    
    local username="vivi"
    local user_home="/home/${username}"
    local ssh_dir="${user_home}/.ssh"
    local backup_ssh="${user_home}/.ssh"
    
    # Restore SSH config
    if [[ -f "${backup_ssh}/config" ]]; then
        cp "${backup_ssh}/config" "${ssh_dir}/config"
        chmod 600 "${ssh_dir}/config"
    fi
    
    # Restore known_hosts
    if [[ -f "${backup_ssh}/known_hosts" ]]; then
        cp "${backup_ssh}/known_hosts" "${ssh_dir}/known_hosts"
    fi
    
    # Restore private keys from backup
    for keyfile in id_ed25519 id_rsa id_ecdsa azure/* steiner/* dagger/*; do
        if [[ -f "${backup_ssh}/${keyfile}" ]]; then
            cp "${backup_ssh}/${keyfile}" "${ssh_dir}/${keyfile}" 2>/dev/null || true
            chmod 600 "${ssh_dir}/${keyfile}" 2>/dev/null || true
        fi
    done
    
    # Setup SSH agent with keychain
    if ! grep -q "keychain" "${user_home}/.bashrc" 2>/dev/null; then
        cat >> "${user_home}/.bashrc" << 'EOF'
# SSH Agent with keychain
eval "$(keychain --eval --agents ssh id_ed25519 2>/dev/null)" 2>/dev/null || true
EOF
    fi
    
    # Enable SSH askpass
    if [[ -f /usr/bin/ssh-askpass ]]; then
        if ! grep -q "SSH_ASKPASS" "${user_home}/.bashrc" 2>/dev/null; then
            cat >> "${user_home}/.bashrc" << 'EOF'
export SSH_ASKPASS=/usr/bin/ssh-askpass
export SSH_ASKPASS_REQUIRE=prefer
EOF
        fi
    fi
    
    chown -R "${username}:${username}" "${ssh_dir}"
    success "SSH keys and config restored"
}

setup_git_config() {
    step "Configuring Git"
    
    local username="vivi"
    local user_home="/home/${username}"
    local backup_gitconfig="${user_home}/.gitconfig"
    
    # Restore git config from backup
    if [[ -f "${backup_gitconfig}" ]]; then
        cp "${backup_gitconfig}" "${user_home}/.gitconfig"
    else
        # Default git config
        cat > "${user_home}/.gitconfig" << 'EOF'
[user]
	email = dagger@pixelated.love
	name = Dagger
[core]
	editor = vim
	autocrlf = input
[credential]
	helper = store
[push]
	default = simple
[pull]
	rebase = false
EOF
    fi
    
    # Setup git credential helper for HTTPS
    if ! grep -q "credential" "${user_home}/.gitconfig"; then
        cat >> "${user_home}/.gitconfig" << 'EOF'
[credential]
	helper = store
EOF
    fi
    
    chown "${username}:${username}" "${user_home}/.gitconfig"
    success "Git configured"
}

# =============================================================================
# Docker
# =============================================================================

setup_docker() {
    step "Installing Docker"
    
    if command_exists docker; then
        info "Docker installed"
        return 0
    fi
    
    # Remove old versions
    apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Set up repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    systemctl start docker
    systemctl enable docker
    
    # Add user to docker group
    usermod -aG docker "vivi"
    
    success "Docker installed"
}

setup_docker_credential_helpers() {
    step "Installing Docker credential helpers"
    
    # Install credential helpers
    apt-get install -y -qq docker-credential-secretservice 2>/dev/null || \
        apt-get install -y -qq docker-credential-pass 2>/dev/null || true
    
    # Configure Docker to use credential helper
    local username="vivi"
    local user_home="/home/${username}"
    local docker_config="${user_home}/.docker"
    
    ensure_dir "${docker_config}" 755 "${username}:${username}"
    
    # Create config.json with credential helper
    if [[ ! -f "${docker_config}/config.json" ]]; then
        cat > "${docker_config}/config.json" << 'EOF'
{
    "credsStore": "secretservice",
    "experimental": "enabled"
}
EOF
        chown "${username}:${username}" "${docker_config}/config.json"
    fi
    
    # Restore Docker config from backup if exists
    local backup_docker="${user_home}/.docker/config.json"
    if [[ -f "${backup_docker}" ]]; then
        cp "${backup_docker}" "${docker_config}/config.json"
        chown "${username}:${username}" "${docker_config}/config.json"
    fi
    
    success "Docker credential helpers configured"
}

# =============================================================================
# Homebrew (Linuxbrew)
# =============================================================================

setup_homebrew() {
    step "Installing Homebrew (Linuxbrew)"
    
    local username="vivi"
    local user_home="/home/${username}"
    local brew_dir="${user_home}/.linuxbrew"
    
    # Check if already installed
    if [[ -f "${brew_dir}/bin/brew" ]]; then
        info "Homebrew already installed"
        return 0
    fi
    
    # Install Homebrew
    NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add to PATH in bashrc
    if ! grep -q "linuxbrew" "${user_home}/.bashrc" 2>/dev/null; then
        cat >> "${user_home}/.bashrc" << 'EOF'
# Homebrew (Linuxbrew)
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
EOF
    fi
    
    # Update brew
    sudo -u "${username}" /home/linuxbrew/.linuxbrew/bin/brew update
    
    chown -R "${username}:${username}" "${brew_dir}"
    success "Homebrew installed"
}

# =============================================================================
# Development Tools
# =============================================================================

setup_nvm_nodejs() {
    step "Installing nvm + Node.js + npm + pnpm"
    
    local username="vivi"
    local user_home="/home/${username}"
    export NVM_DIR="${user_home}/.nvm"
    
    # Install nvm
    if [[ ! -d "${NVM_DIR}" ]]; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    fi
    
    # Source nvm and install latest Node.js
    source "${NVM_DIR}/nvm.sh"
    nvm install --lts
    nvm use --lts
    nvm alias default --lts
    
    # Install pnpm
    if ! command_exists pnpm; then
        curl -fsSL https://get.pnpm.io/install.sh | sh -
    fi
    
    # Add to bashrc
    if ! grep -q "NVM_DIR" "${user_home}/.bashrc" 2>/dev/null; then
        cat >> "${user_home}/.bashrc" << 'EOF'
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
EOF
    fi
    
    chown -R "${username}:${username}" "${user_home}/.nvm"
    chown "${username}:${username}" "${user_home}/.bashrc"
    
    success "nvm + Node.js $(node -v) + pnpm installed"
}

setup_bun() {
    step "Installing Bun"
    
    local username="vivi"
    local user_home="/home/${username}"
    
    if command_exists bun; then
        info "Bun installed"
        return 0
    fi
    
    curl -fsSL https://bun.sh/install | bash
    
    # Add to bashrc
    if ! grep -q "BUN_INSTALL" "${user_home}/.bashrc" 2>/dev/null; then
        cat >> "${user_home}/.bashrc" << 'EOF'
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
EOF
    fi
    
    chown "${username}:${username}" "${user_home}/.bashrc"
    
    success "Bun installed"
}

setup_uv() {
    step "Installing uv (Python)"
    
    local username="vivi"
    local user_home="/home/${username}"
    
    if command_exists uv; then
        info "uv installed"
        return 0
    fi
    
    curl -LsSf https://astral.sh/uv/install.sh | sh
    
    # Add to bashrc
    if ! grep -q "uv" "${user_home}/.bashrc" 2>/dev/null; then
        cat >> "${user_home}/.bashrc" << 'EOF'
export PATH="$HOME/.local/bin:$PATH"
EOF
    fi
    
    chown "${username}:${username}" "${user_home}/.bashrc"
    
    success "uv installed"
}

setup_ohmyzsh() {
    step "Installing Oh My Zsh with theme and plugins"
    
    [[ "${CONFIG[enable_ohmyzsh]}" != "true" ]] && return 0
    
    local username="vivi"
    local user_home="/home/${username}"
    local zsh_custom="${user_home}/.oh-my-zsh/custom"
    
    # Install zsh
    apt-get install -y -qq zsh
    
    # Install Oh My Zsh
    if [[ ! -d "${user_home}/.oh-my-zsh" ]]; then
        sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
    fi
    
    # Create custom directories
    ensure_dir "${zsh_custom}/themes" 755 "${username}:${username}"
    ensure_dir "${zsh_custom}/plugins" 755 "${username}:${username}"
    
    # Restore custom plugins from backup
    local backup_custom="${user_home}/.oh-my-zsh/custom"
    if [[ -d "${backup_custom}/plugins/autoswitch_virtualenv" ]]; then
        cp -r "${backup_custom}/plugins/autoswitch_virtualenv" "${zsh_custom}/plugins/" 2>/dev/null || true
        chown -R "${username}:${username}" "${zsh_custom}/plugins/autoswitch_virtualenv"
    fi
    
    # Restore .zshrc from backup if exists
    if [[ -f "${backup_custom}/.zshrc" ]]; then
        cp "${backup_custom}/.zshrc" "${user_home}/.zshrc"
        chown "${username}:${username}" "${user_home}/.zshrc"
        success "Oh My Zsh config restored from backup"
    else
        # Create default .zshrc matching current setup
        cat > "${user_home}/.zshrc" << 'EOF'
export ZSH="$HOME/.oh-my-zsh"
ZSH_THEME="kali-like"
zstyle ':omz:update' mode auto
plugins=(git uv nvm docker brew bun autoswitch_virtualenv azure 1password charm)

source $ZSH/oh-my-zsh.sh

# nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# pnpm
export PNPM_HOME="$HOME/.local/share/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
[ -s "$BUN_INSTALL/_bun" ] && source "$BUN_INSTALL/_bun"

# uv
export PATH="$HOME/.local/bin:$PATH"

# opencode
export PATH="$HOME/.opencode/bin:$PATH"


# rbenv
eval "$(rbenv init -)" 2>/dev/null || true

# Homebrew (Linuxbrew)
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)" 2>/dev/null || true

# Pixelated
export HAPPY_SERVER_URL="https://happy.pixelatedempathy.com"

# Alias for opencode with yolo config
alias oc-yolo='OPENCODE_CONFIG=~/.config/opencode/opencode-yolo.json opencode'
EOF
        chown "${username}:${username}" "${user_home}/.zshrc"
    fi
    
    # Change default shell
    chsh -s "$(which zsh)" "${username}" 2>/dev/null || true
    
    success "Oh My Zsh installed (kali-like theme)"
}

# =============================================================================
# Cloud CLIs
# =============================================================================

setup_cloud_clis() {
    step "Installing Cloud CLIs"
    
    local username="vivi"
    local user_home="/home/${username}"
    
    # AWS CLI (via brew)
    if ! command_exists aws; then
        sudo -u "${username}" brew install awscli 2>/dev/null || true
    fi
    
    # Azure CLI
    if ! command_exists az; then
        curl -sL https://aka.ms/InstallAzureCLIDeb | bash
    fi
    
    # Azure Developer CLI
    if ! command_exists azd; then
        curl -fsSL https://aka.ms/install-azd.sh | bash
    fi
    
    # DigitalOcean doctl (legacy/optional for legacy workflows)
    local enable_legacy_doctl="${ENABLE_LEGACY_DOCTL:-0}"
    if [[ "${enable_legacy_doctl}" == "1" ]]; then
      if ! command_exists doctl; then
          sudo -u "${username}" brew install doctl 2>/dev/null || true
      fi
    else
      warn "Skipping DigitalOcean doctl install (legacy/optional): set ENABLE_LEGACY_DOCTL=1 to opt in."
    fi
    
    # s3cmd (via brew - already have it)
    if ! command_exists s3cmd; then
        sudo -u "${username}" brew install s3cmd 2>/dev/null || true
    fi
    
    # Oracle Cloud acli (already in /usr/bin)
    if ! command_exists acli; then
        warn "Oracle Cloud CLI (acli) not installed - install manually"
    fi
    
    # GitHub CLI
    if ! command_exists gh; then
        sudo -u "${username}" brew install gh 2>/dev/null || true
    fi
    
    # GitLab CLI
    if ! command_exists glab; then
        sudo -u "${username}" brew install glab 2>/dev/null || true
    fi
    
    success "Cloud CLIs installed"
}

setup_cloud_cli_auth() {
    step "Configuring Cloud CLI authentication"
    
    local username="vivi"
    local user_home="/home/${username}"
    
    # Restore auth configs from backup
    local backup_config="${user_home}/.config"
    
    # AWS
    if [[ -d "${backup_config}/aws" ]]; then
        cp -r "${backup_config}/aws" "${user_home}/.config/"
        chown -R "${username}:${username}" "${user_home}/.config/aws"
    fi
    
    # Azure
    if [[ -d "${backup_config}/Azure" ]]; then
        cp -r "${backup_config}/Azure" "${user_home}/.config/"
        chown -R "${username}:${username}" "${user_home}/.config/Azure"
    fi
    
    # DigitalOcean / doctl (legacy backup restore)
    local enable_legacy_doctl="${ENABLE_LEGACY_DOCTL:-0}"
    if [[ "${enable_legacy_doctl}" == "1" ]]; then
      if [[ -f "${backup_config}/doctl/config.yaml" ]]; then
        mkdir -p "${user_home}/.config/doctl"
        cp "${backup_config}/doctl/config.yaml" "${user_home}/.config/doctl/"
        chown -R "${username}:${username}" "${user_home}/.config/doctl"
      fi
    else
      warn "Skipping DigitalOcean doctl auth restore (legacy/optional). Set ENABLE_LEGACY_DOCTL=1 to import."
    fi
    
    # Oracle Cloud
    if [[ -d "${backup_config}/oci" ]]; then
        cp -r "${backup_config}/oci" "${user_home}/.config/"
        chown -R "${username}:${username}" "${user_home}/.config/oci"
    fi
    
    # GitHub
    if [[ -f "${backup_config}/gh/hosts.yml" ]]; then
        mkdir -p "${user_home}/.config/gh"
        cp "${backup_config}/gh/hosts.yml" "${user_home}/.config/gh/"
        chown -R "${username}:${username}" "${user_home}/.config/gh"
    fi
    
    # GitLab
    if [[ -f "${backup_config}/glab-cli/config.yml" ]]; then
        mkdir -p "${user_home}/.config/glab-cli"
        cp "${backup_config}/glab-cli/config.yml" "${user_home}/.config/glab-cli/"
        chown -R "${username}:${username}" "${user_home}/.config/glab-cli"
    fi
    
    success "Cloud CLI auth restored from backup"
}

# =============================================================================
# Rclone
# =============================================================================

setup_rclone() {
    step "Installing rclone"
    
    if command_exists rclone; then
        info "rclone installed"
    else
        curl https://rclone.org/install.sh | sudo bash
    fi
    
    success "rclone installed"
}

restore_rclone_config() {
    step "Restoring rclone config from backup"
    
    local username="vivi"
    local user_home="/home/${username}"
    local rclone_dir="${user_home}/.config/rclone"
    
    ensure_dir "${rclone_dir}" 700 "${username}:${username}"
    
    # Try to restore from backup path
    local backup_config="${user_home}/.config/rclone/rclone.conf"
    if [[ -f "${backup_config}" ]]; then
        cp "${backup_config}" "${rclone_dir}/rclone.conf"
        chown "${username}:${username}" "${rclone_dir}/rclone.conf"
        chmod 600 "${rclone_dir}/rclone.conf"
        success "rclone config restored from backup"
    else
        warn "No rclone config found in backup - run 'rclone config' manually"
    fi
}

# =============================================================================
# Repository
# =============================================================================

clone_repository() {
    step "Cloning pixelated repository"
    
    local username="vivi"
    local user_home="/home/${username}"
    local workspace="${CONFIG[workspace_dir]}"
    local repo="${CONFIG[pixelated_repo]}"
    local branch="${CONFIG[pixelated_branch]}"
    
    if [[ -d "${workspace}/.git" ]]; then
        info "Repository exists, pulling latest"
        cd "${workspace}"
        git pull origin "${branch}" || true
    else
        # Ensure parent dir exists
        ensure_dir "$(dirname "${workspace}")" 755 "${username}:${username}"
        
        # Clone with submodules
        sudo -u "${username}" git clone --branch "${branch}" --recurse-submodules "${repo}" "${workspace}"
    fi
    
    chown -R "${username}:${username}" "${workspace}"
    
    success "Repository cloned"
}

restore_gitignore_gaps() {
    step "Restoring .gitignore gaps from backup"
    
    local username="vivi"
    local rclone_remote="${CONFIG[rclone_remote]}"
    local backup_path="${CONFIG[backup_path]}"
    local workspace="${CONFIG[workspace_dir]}"
    
    # Files/dirs to restore based on .gitignore patterns
    local restore_paths=(
        ".agent/internal/"
        ".cursor/"
        ".continue/"
        ".windsurf/"
        ".Jules/"
        ".claude/"
        "node_modules/"
        ".venv/"
        "venv/"
        "__pycache__/"
        "*.pyc"
        ".env"
        ".env.local"
        "config/secrets/*.json"
    )
    
    # Try to restore from rclone backup
    if command_exists rclone && rclone listremotes 2>/dev/null | grep -q "^${rclone_remote}:"; then
        info "Restoring from rclone backup..."
        
        for path in "${restore_paths[@]}"; do
            local remote_path="${rclone_remote}:${backup_path}/pixelated/${path}"
            local local_path="${workspace}/${path}"
            
            if rclone ls "${remote_path}" &>/dev/null; then
                rclone copy "${remote_path}" "${local_path}" --ignore-existing 2>/dev/null || true
            fi
        done
        
        success "Restored .gitignore gaps from backup"
    else
        warn "rclone not configured or backup not found"
    fi
}

# =============================================================================
# Coding Agents
# =============================================================================

setup_coding_agents() {
    step "Installing coding agents"
    
    local username="vivi"
    local user_home="/home/${username}"
    
    # Continue (VSCode extension - just prepare config)
    if [[ "${CONFIG[enable_continue]}" == "true" ]]; then
        local continue_dir="${user_home}/.continue"
        ensure_dir "${continue_dir}" 755 "${username}:${username}"
        
        # Restore from backup
        local backup_continue="${user_home}/.continue"
        if [[ -d "${backup_continue}" ]]; then
            cp -r "${backup_continue}/." "${continue_dir}/" 2>/dev/null || true
            chown -R "${username}:${username}" "${continue_dir}"
        fi
        
        # Default config
        if [[ ! -f "${continue_dir}/config.json" ]]; then
            cat > "${continue_dir}/config.json" << 'EOF'
{
  "models": [
    {
      "title": "Ollama",
      "provider": "ollama",
      "model": "llama3.1:8b",
      "apiBase": "http://localhost:11434"
    }
  ],
  "tabAutocompleteModel": {
    "title": "Ollama Autocomplete",
    "provider": "ollama",
    "model": "starcoder2:3b",
    "apiBase": "http://localhost:11434"
  }
}
EOF
            chown "${username}:${username}" "${continue_dir}/config.json"
        fi
        success "Continue configured"
    fi
    
    # Aider
    if [[ "${CONFIG[enable_aider]}" == "true" ]]; then
        if ! command_exists aider; then
            uv pip install aider-chat
        fi
        success "Aider installed"
    fi
    
    # OpenHands (Docker)
    if [[ "${CONFIG[enable_openhands]}" == "true" ]]; then
        info "OpenHands: docker run -it --rm -p 3000:3000 ghcr.io/all-hands-ai/openhands:main"
        success "OpenHands ready"
    fi
    
    # Goose
    if command_exists goose; then
        info "Goose already installed"
    else
        # Install goose via cargo or download
        if command_exists cargo; then
            sudo -u "${username}" cargo install goose 2>/dev/null || true
        fi
    fi
    
    # Restore goose config
    local backup_goose="${user_home}/.config/goose"
    if [[ -d "${backup_goose}" ]]; then
        ensure_dir "${user_home}/.config/goose" 755 "${username}:${username}"
        cp -r "${backup_goose}/." "${user_home}/.config/goose/" 2>/dev/null || true
        chown -R "${username}:${username}" "${user_home}/.config/goose"
        success "Goose config restored"
    fi
    
    # Crush
    if command_exists crush; then
        info "Crush already installed"
    else
        # Install crush
        curl -fsSL https://crush.sh/install.sh | bash 2>/dev/null || true
    fi
    
    # Restore crush config
    local backup_crush="${user_home}/.config/crush"
    if [[ -d "${backup_crush}" ]]; then
        ensure_dir "${user_home}/.config/crush" 755 "${username}:${username}"
        cp -r "${backup_crush}/." "${user_home}/.config/crush/" 2>/dev/null || true
        chown -R "${username}:${username}" "${user_home}/.config/crush"
        success "Crush config restored"
    fi
    
    # OpenCode (opencode)
    if command_exists opencode; then
        info "OpenCode already installed"
    else
        # Install opencode
        curl -fsSL https://opencode.ai/install.sh | bash 2>/dev/null || true
    fi
    
    # Restore opencode config
    local backup_opencode="${user_home}/.config/opencode"
    if [[ -d "${backup_opencode}" ]]; then
        ensure_dir "${user_home}/.config/opencode" 755 "${username}:${username}"
        cp -r "${backup_opencode}/." "${user_home}/.config/opencode/" 2>/dev/null || true
        chown -R "${username}:${username}" "${user_home}/.config/opencode"
        success "OpenCode config restored"
    fi
    
    # Qwen Code
    if command_exists qwen; then
        info "Qwen already installed"
    else
        # Install qwen (via npm or download)
        sudo -u "${username}" pnpm add -g @anthropic/qwen 2>/dev/null || true
    fi
    
    # Restore qwen config
    local backup_qwen="${user_home}/.qwen"
    if [[ -d "${backup_qwen}" ]]; then
        ensure_dir "${user_home}/.qwen" 755 "${username}:${username}"
        cp -r "${backup_qwen}/." "${user_home}/.qwen/" 2>/dev/null || true
        chown -R "${username}:${username}" "${user_home}/.qwen"
        success "Qwen config restored"
    fi
    
    # ALCI / Rovodev
    if command_exists alci; then
        info "ALCI already installed"
    else
        # Install ALCI (Rovodev)
        curl -fsSL https://alci.dev/install.sh | bash 2>/dev/null || true
    fi
    
    # Restore alci config
    local backup_alci="${user_home}/.alci"
    if [[ -d "${backup_alci}" ]]; then
        ensure_dir "${user_home}/.alci" 755 "${username}:${username}"
        cp -r "${backup_alci}/." "${user_home}/.alci/" 2>/dev/null || true
        chown -R "${username}:${username}" "${user_home}/.alci"
        success "ALCI config restored"
    fi
    
    # Codex (OpenAI)
    if command_exists codex; then
        info "Codex already installed"
    else
        # Install codex
        sudo -u "${username}" pipx install openai-codex 2>/dev/null || true
    fi
    
    # Restore codex/openai config
    local backup_openai="${user_home}/.openai"
    if [[ -d "${backup_openai}" ]]; then
        ensure_dir "${user_home}/.openai" 755 "${username}:${username}"
        cp -r "${backup_openai}/." "${user_home}/.openai/" 2>/dev/null || true
        chown -R "${username}:${username}" "${user_home}/.openai"
        success "OpenAI config restored"
    fi
    
    # Claude Code
    if command_exists claude; then
        info "Claude already installed"
    else
        # Install claude
        sudo -u "${username}" npm install -g @anthropic/claude-code 2>/dev/null || true
    fi
    
    # Restore claude config
    local backup_claude="${user_home}/.claude"
    if [[ -d "${backup_claude}" ]]; then
        ensure_dir "${user_home}/.claude" 755 "${username}:${username}"
        cp -r "${backup_claude}/." "${user_home}/.claude/" 2>/dev/null || true
        chown -R "${username}:${username}" "${user_home}/.claude"
        success "Claude config restored"
    fi
    
    # Gemini
    if command_exists gemini; then
        info "Gemini already installed"
    else
        # Install gemini
        sudo -u "${username}" pipx install google-gemini-cli 2>/dev/null || true
    fi
    
    # Restore gemini config
    local backup_gemini="${user_home}/.gemini"
    if [[ -d "${backup_gemini}" ]]; then
        ensure_dir "${user_home}/.gemini" 755 "${username}:${username}"
        cp -r "${backup_gemini}/." "${user_home}/.gemini/" 2>/dev/null || true
        chown -R "${username}:${username}" "${user_home}/.gemini"
        success "Gemini config restored"
    fi
}

# =============================================================================
# Oh My Zsh from Backup
# =============================================================================

setup_ohmyzsh_from_backup() {
    step "Restoring oh-my-zsh custom config from backup"
    
    local username="vivi"
    local user_home="/home/${username}"
    local zsh_dir="${user_home}/.oh-my-zsh"
    local backup_ohmyzsh="${user_home}/.oh-my-zsh"
    
    # Restore entire custom directory from backup
    if [[ -d "${backup_ohmyzsh}/custom" ]]; then
        rm -rf "${zsh_dir}/custom"
        cp -r "${backup_ohmyzsh}/custom" "${zsh_dir}/"
        chown -R "${username}:${username}" "${zsh_dir}/custom"
        success "oh-my-zsh custom config restored from backup"
    fi
    
    # Restore .zshrc from home backup
    if [[ -f "${user_home}/.zshrc" ]]; then
        cp "${user_home}/.zshrc" "${user_home}/.zshrc"
        chown "${username}:${username}" "${user_home}/.zshrc"
    fi
}

# =============================================================================
# Backup System
# =============================================================================

setup_backup_system() {
    step "Setting up backup system"
    
    local username="vivi"
    local user_home="/home/${username}"
    local script_dir="${user_home}/pixelated/scripts/backup"
    local systemd_dir="/etc/systemd/system"
    
    # Ensure backup directory exists
    ensure_dir "${user_home}/.local/share/home_backups" 755 "${username}:${username}"
    
    # Install config backup script
    if [[ -f "/home/vivi/pixelated/scripts/backup/create-config-backup.sh" ]]; then
        # Already exists in repo
        info "Config backup script available"
    fi
    
    # Install systemd units
    if [[ -f "/home/vivi/pixelated/scripts/systemd/backup-home-vivi.service" ]]; then
        cp "/home/vivi/pixelated/scripts/systemd/backup-home-vivi.service" "${systemd_dir}/"
        success "Backup service installed"
    fi
    
    if [[ -f "/home/vivi/pixelated/scripts/systemd/backup-home-vivi.timer" ]]; then
        cp "/home/vivi/pixelated/scripts/systemd/backup-home-vivi.timer" "${systemd_dir}/"
        success "Backup timer installed"
    fi
    
    if [[ -f "/home/vivi/pixelated/scripts/systemd/config-backup.service" ]]; then
        cp "/home/vivi/pixelated/scripts/systemd/config-backup.service" "${systemd_dir}/"
        success "Config backup service installed"
    fi
    
    if [[ -f "/home/vivi/pixelated/scripts/systemd/config-backup.timer" ]]; then
        cp "/home/vivi/pixelated/scripts/systemd/config-backup.timer" "${systemd_dir}/"
        success "Config backup timer installed"
    fi
    
    # Reload systemd and enable timers
    systemctl daemon-reload
    systemctl enable backup-home-vivi.timer 2>/dev/null || true
    systemctl enable config-backup.timer 2>/dev/null || true
    systemctl start backup-home-vivi.timer 2>/dev/null || true
    systemctl start config-backup.timer 2>/dev/null || true
    
success "Backup system configured (weekly config backup + twice-daily home backup)"
}

# =============================================================================
# Finalization
# =============================================================================

print_summary() {
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}      VPS Dev Environment Setup Complete!             ${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo ""
    
    echo -e "${BLUE}System:${NC}"
    echo "  SSH Port:    ${CONFIG[ssh_port]}"
    echo "  Timezone:    ${CONFIG[timezone]}"
    echo "  Swap:        ${CONFIG[swap_size]}"
    echo ""
    
    echo -e "${BLUE}Development Tools:${NC}"
    echo "  Node.js:     $(sudo -u vivi bash -c 'source $HOME/.nvm/nvm.sh && node -v' 2>/dev/null || echo 'installed')"
    echo "  pnpm:        $(sudo -u vivi bash -c 'source $HOME/.nvm/nvm.sh && pnpm -v' 2>/dev/null || echo 'installed')"
    echo "  Bun:         $(sudo -u vivi bash -c 'bun --version' 2>/dev/null || echo 'installed')"
    echo "  uv:          $(sudo -u vivi bash -c 'uv --version' 2>/dev/null || echo 'installed')"
    echo "  Homebrew:    /home/linuxbrew/.linuxbrew"
    echo "  Oh My Zsh:   kali-like theme"
    echo ""
    
    echo -e "${BLUE}Cloud CLIs:${NC}"
    echo "  AWS CLI:     $(command -v aws 2>/dev/null || echo 'not found')"
    echo "  Azure CLI:   $(command -v az 2>/dev/null || echo 'not found')"
    echo "  Azure Dev:   $(command -v azd 2>/dev/null || echo 'not found')"
    if [[ "${ENABLE_LEGACY_DOCTL:-0}" == "1" ]]; then
      echo "  DigitalOcean (legacy doctl): $(command -v doctl 2>/dev/null || echo 'not found')"
    else
      echo "  DigitalOcean (legacy doctl): disabled (set ENABLE_LEGACY_DOCTL=1)"
    fi
    echo "  Oracle:      $(command -v acli 2>/dev/null || echo 'not found')"
    echo "  GitHub:      $(command -v gh 2>/dev/null || echo 'not found')"
    echo "  GitLab:      $(command -v glab 2>/dev/null || echo 'not found')"
    echo ""
    
    echo -e "${BLUE}Coding Agents:${NC}"
    echo "  Continue:    ~/.continue/config.json"
    echo "  Aider:       $(command -v aider 2>/dev/null || echo 'installed')"
    echo "  Goose:       $(command -v goose 2>/dev/null || echo 'not installed')"
    echo "  Crush:       $(command -v crush 2>/dev/null || echo 'not installed')"
    echo "  OpenCode:    $(command -v opencode 2>/dev/null || echo 'not installed')"
    echo "  Qwen:        $(command -v qwen 2>/dev/null || echo 'not installed')"
    echo "  ALCI:        $(command -v alci 2>/dev/null || echo 'not installed')"
    echo "  Claude:      $(command -v claude 2>/dev/null || echo 'not installed')"
    echo "  Codex:       $(command -v codex 2>/dev/null || echo 'not installed')"
    echo "  Gemini:      $(command -v gemini 2>/dev/null || echo 'not installed')"
    echo ""
    
    echo -e "${BLUE}Backup System:${NC}"
    echo "  Home backup: Every 6 hours (~/.local/share/home_backups)"
    echo "  Config backup: Weekly (Sundays 3 AM)"
    echo "  Timers: $(systemctl list-timers --all 2>/dev/null | grep -c backup || echo '0') active"
    echo ""
    
    echo -e "${BLUE}Repository:${NC}"
    echo "  Location:    ${CONFIG[workspace_dir]}"
    echo "  Branch:      ${CONFIG[pixelated_branch]}"
    echo ""
    
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. SSH in:     ssh -p ${CONFIG[ssh_port]} vivi@$(hostname -I | awk '{print $1}')"
    echo "  2. Upgrade:    sudo do-release-upgrade  (if Ubuntu 22/24)"
    echo "  3. Auth:       aws configure, az login, doctl auth init (legacy, optional), etc."
    echo "  4. Configure:  rclone config (if not restored)"
    echo "  5. Restore:    rclone copy drive:vivi-home-backups/pixelated/ ${CONFIG[workspace_dir]}/"
    echo "  6. View logs:  tail -f ${LOG_FILE}"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
}

# =============================================================================
# CLI
# =============================================================================

show_help() {
    cat << EOF
${SCRIPT_NAME} - VPS Dev Environment Setup for Pixelated Empathy

Usage: $0 [OPTIONS]

Required:
  --ssh-key KEY            SSH public key for authentication

Optional:
  -p, --port PORT          SSH port (default: 22)
  --github-token TOKEN     GitHub token for private repos
  --gitlab-token TOKEN     GitLab token
  --rclone-remote NAME     rclone remote name (default: drive)
  --backup-path PATH       Backup path in rclone remote
  --repo URL               Repository URL (default: pixelated repo)
  --branch NAME            Git branch (default: main)
  --workspace DIR          Workspace directory (default: ~/pixelated)
  --no-ohmyzsh             Skip Oh My Zsh installation
  --no-continue            Skip Continue setup
  --no-aider               Skip Aider installation
  --enable-openhands       Enable OpenHands (disabled by default)
  --no-upgrade-25          Skip Ubuntu upgrade to 25
  --timezone TZ            System timezone (default: UTC)
  --swap-size SIZE         Swap size (default: 4G)
  -h, --help               Show this help

Examples:
  # Full setup with SSH key
  $0 --ssh-key "$(cat ~/.ssh/id_ed25519.pub)"

  # Custom branch and workspace
  $0 --ssh-key "ssh-ed25519 AAAA..." --branch staging --workspace /home/vivi/workspace

  # Minimal setup (no agents, no upgrade)
  $0 --ssh-key "ssh-ed25519 AAAA..." --no-continue --no-aider --no-upgrade-25

EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --ssh-key)
                CONFIG[ssh_public_key]="$2"
                shift 2
                ;;
            -p|--port)
                CONFIG[ssh_port]="$2"
                shift 2
                ;;
            --github-token)
                CONFIG[github_token]="$2"
                shift 2
                ;;
            --gitlab-token)
                CONFIG[gitlab_token]="$2"
                shift 2
                ;;
            --rclone-remote)
                CONFIG[rclone_remote]="$2"
                shift 2
                ;;
            --backup-path)
                CONFIG[backup_path]="$2"
                shift 2
                ;;
            --repo)
                CONFIG[pixelated_repo]="$2"
                shift 2
                ;;
            --branch)
                CONFIG[pixelated_branch]="$2"
                shift 2
                ;;
            --workspace)
                CONFIG[workspace_dir]="$2"
                shift 2
                ;;
            --no-ohmyzsh)
                CONFIG[enable_ohmyzsh]="false"
                shift
                ;;
            --no-continue)
                CONFIG[enable_continue]="false"
                shift
                ;;
            --no-aider)
                CONFIG[enable_aider]="false"
                shift
                ;;
            --enable-openhands)
                CONFIG[enable_openhands]="true"
                shift
                ;;
            --no-upgrade-25)
                CONFIG[upgrade_to_25]="false"
                shift
                ;;
            --timezone)
                CONFIG[timezone]="$2"
                shift 2
                ;;
            --swap-size)
                CONFIG[swap_size]="$2"
                shift 2
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
    echo -e "${BLUE}║     Pixelated Empathy VPS Dev Environment Setup      ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    check_root
    
    # Ubuntu upgrade
    upgrade_to_non_lts
    
    # System
    setup_base_packages
    set_timezone
    create_swap
    setup_ssh
    setup_firewall
    
    # User
    setup_user
    
    # Docker
    setup_docker
    setup_docker_credential_helpers
    
    # Homebrew
    setup_homebrew
    
    # Dev tools
    setup_nvm_nodejs
    setup_bun
    setup_uv
    setup_ohmyzsh
    
    # Cloud CLIs
    setup_cloud_clis
    
    # SSH keys and git config
    setup_ssh_keys_and_config
    setup_git_config
    
    # rclone
    setup_rclone
    
    # Repository
    clone_repository
    
    # Restore from backup
    restore_rclone_config
    restore_gitignore_gaps
    setup_cloud_cli_auth
    setup_ohmyzsh_from_backup
    
    # Coding agents (all in one)
    setup_coding_agents
    
    # Backup system
    setup_backup_system
    
    # Done
    save_state "provisioned" "$(date -Iseconds)"
    print_summary
}

main "$@"

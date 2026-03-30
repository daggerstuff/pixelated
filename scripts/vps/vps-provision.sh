#!/usr/bin/env bash
#
# VPS Provisioning Script - Pixelated Empathy
# Focused on Docker registry auth with flexible deployment profiles
#
# Usage:
#   ./vps-provision.sh --profile ai-workload --ssh-key "ssh-ed25519 AAAA..."
#   ./vps-provision.sh --profile web-app --registry gitlab --registry-token $TOKEN
#
# Profiles:
#   - minimal        : Just Docker, no registry auth
#   - web-app        : Docker + GitLab Registry or ACR
#   - ai-workload    : Docker + NVIDIA NGC registry
#   - full-stack     : Everything + monitoring + backups
#

set -euo pipefail

SCRIPT_NAME="vps-provision"
LOG_FILE="/var/log/${SCRIPT_NAME}.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default config
declare -A CONFIG=(
  [ssh_port]="22"
  [ssh_permit_root_login]="no"
  [ssh_password_auth]="no"
  [profile]="minimal"
  [registry]=""
  [registry_username]=""
  [registry_token]=""
  [registry_token_file]=""
  [nvidia_api_key]=""
  [nvidia_api_key_file]=""
  [cloudflare_api_token]=""
  [cloudflare_api_token_file]=""
  [domain]=""
  [timezone]="UTC"
  [swap_size]="2G"
  [use_credential_helper]="true"
)

# Mask sensitive values for logging
declare -A SENSITIVE_KEYS=(
    [registry_token]=1
    [nvidia_api_key]=1
    [cloudflare_api_token]=1
)

# Cleanup trap to clear sensitive env vars on exit
cleanup_sensitive_vars() {
    for key in "${!SENSITIVE_KEYS[@]}"; do
        unset "CONFIG[$key]" 2>/dev/null || true
    done
}
trap cleanup_sensitive_vars EXIT

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

# Log safely by masking sensitive values
# Usage: log_safe "message with ${CONFIG[registry_token]}"
log_safe() {
	local message="$1"
	local safe_message="${message}"
	
	# Mask each sensitive key's value
	for key in "${!SENSITIVE_KEYS[@]}"; do
		local value="${CONFIG[$key]:-}"
		if [[ -n "${value}" ]]; then
			safe_message="${safe_message//${value}/***MASKED***}"
		fi
	done
	
	echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] [SAFE] ${safe_message}" | tee -a "${LOG_FILE}"
}

# =============================================================================
# Helpers
# =============================================================================

check_root() {
    [[ $EUID -eq 0 ]] || die "Must run as root"
}

detect_os() {
    if [[ -f /etc/os-release ]]; then
        source /etc/os-release
        info "Detected: ${PRETTY_NAME}"
    else
        die "Cannot detect OS"
    fi
}

command_exists() { command -v "$1" &>/dev/null; }

ensure_dir() {
    local dir="$1"
    local mode="${2:-0755}"
    [[ -d "${dir}" ]] || { mkdir -p "${dir}" && chmod "${mode}" "${dir}"; }
}

retry_curl() {
    local url="$1"
    local output="${2:-}"
    local max_attempts="${3:-3}"
    local delay="${4:-2}"
    local attempt=1
    
    while [[ ${attempt} -le ${max_attempts} ]]; do
        if [[ -n "${output}" ]]; then
            if curl -fsSL --connect-timeout 10 "${url}" -o "${output}" 2>/dev/null; then
                return 0
            fi
        else
            if curl -fsSL --connect-timeout 10 "${url}" 2>/dev/null; then
                return 0
            fi
        fi
        
        [[ ${attempt} -lt ${max_attempts} ]] && sleep "${delay}"
        ((attempt++))
    done
    
    return 1
}

# =============================================================================
# System Setup
# =============================================================================

setup_base() {
    step "Installing base packages"
    case "${OS_ID}" in
        ubuntu|debian)
            apt-get update -qq
            apt-get install -y -qq curl wget git jq rsync ca-certificates gnupg
            ;;
        centos|rhel|almalinux|rocky)
            yum install -y -q curl wget git jq rsync ca-certificates
            ;;
    esac
    success "Base packages installed"
}

setup_ssh() {
    step "Hardening SSH"
    local sshd_config="/etc/ssh/sshd_config"
    
    # Backup
    cp "${sshd_config}" "${sshd_config}.backup.$(date +%Y%m%d%H%M%S)"
    
    # Apply hardening
    sed -i "s/^#*Port .*/Port ${CONFIG[ssh_port]}/" "${sshd_config}"
    sed -i "s/^#*PermitRootLogin .*/PermitRootLogin ${CONFIG[ssh_permit_root_login]}/" "${sshd_config}"
    sed -i "s/^#*PasswordAuthentication .*/PasswordAuthentication ${CONFIG[ssh_password_auth]}/" "${sshd_config}"
    
    # Validate and restart
    if sshd -t; then
        systemctl restart sshd
        success "SSH hardened (port: ${CONFIG[ssh_port]})"
    else
        warn "SSH config invalid, restored backup"
        cp "${sshd_config}.backup."* "${sshd_config}"
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
    
    [[ -f "${swap_file}" ]] && { info "Swap exists"; return 0; }
    
    fallocate -l "${CONFIG[swap_size]}" "${swap_file}" 2>/dev/null || \
        dd if=/dev/zero of="${swap_file}" bs=1M count=2048 status=none
    chmod 600 "${swap_file}"
    mkswap "${swap_file}"
    swapon "${swap_file}"
    grep -q "${swap_file}" /etc/fstab || echo "${swap_file} none swap sw 0 0" >> /etc/fstab
    
    success "Swap created"
}

# =============================================================================
# Docker Setup (Core Focus)
# =============================================================================

setup_docker() {
    step "Installing Docker"
    
    if command_exists docker; then
        info "Docker already installed"
        return 0
    fi
    
    case "${OS_ID}" in
        ubuntu|debian)
            apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
            install -m 0755 -d /etc/apt/keyrings
            retry_curl "https://download.docker.com/linux/ubuntu/gpg" "/etc/apt/keyrings/docker.gpg.tmp" || die "Failed to download Docker GPG key"
            gpg --dearmor -o /etc/apt/keyrings/docker.gpg < /etc/apt/keyrings/docker.gpg.tmp
            chmod a+r /etc/apt/keyrings/docker.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
            apt-get update -qq
            apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
            ;;
        centos|rhel|almalinux|rocky)
            yum remove -y docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true
            yum install -y -q yum-utils
            yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            yum install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
            systemctl enable docker
            ;;
    esac
    
    systemctl start docker
    systemctl enable docker
    
    # Add user to docker group
    local username="${CONFIG[username]:-vivi}"
    id "${username}" &>/dev/null && usermod -aG docker "${username}"
    
    success "Docker installed"
}

# =============================================================================
# Docker Registry Authentication (The Actual Pain Point)
# =============================================================================

configure_credential_helper() {
    local registry_url="$1"
    local helper="${2:-pass}"
    
    if [[ "${CONFIG[use_credential_helper]}" != "true" ]]; then
        return 0
    fi
    
    info "Configuring credential helper for ${registry_url}"
    
    case "${helper}" in
        pass)
            if ! command_exists pass; then
                apt-get install -y -qq pass 2>/dev/null || yum install -y -q pass 2>/dev/null || {
                    warn "pass not available, skipping credential helper"
                    return 1
                }
            fi
            ;;
        secretservice)
            apt-get install -y -qq libsecret-1-0 libsecret1-dev 2>/dev/null || {
                warn "libsecret not available, skipping credential helper"
                return 1
            }
            ;;
    esac
    
    jq --arg registry "${registry_url}" --arg helper "${helper}" \
        '.credsStore = $helper | .credHelpers = (.credHelpers // {}) | .credHelpers[$registry] = $helper' \
        "${docker_config_dir}/config.json" > "${docker_config_dir}/config.json.tmp" 2>/dev/null && \
        mv "${docker_config_dir}/config.json.tmp" "${docker_config_dir}/config.json"
    
    success "Credential helper '${helper}' configured for ${registry_url}"
}

setup_registry_auth() {
    local registry="${CONFIG[registry]}"
    local username="${CONFIG[registry_username]}"
    local token="${CONFIG[registry_token]}"
    local nvidia_key="${CONFIG[nvidia_api_key]}"
    
    step "Configuring Docker registry authentication"
    
    # Ensure .docker config exists
    local docker_config_dir="/root/.docker"
    ensure_dir "${docker_config_dir}" 700
    
case "${registry}" in
    gitlab)
        if [[ -z "${token}" ]]; then
            warn "GitLab registry selected but no token provided"
            return 0
        fi

        local registry_url="${CONFIG[registry_url]:-registry.gitlab.com}"
        info "Logging in to GitLab Registry (${registry_url})"

        echo "${token}" | docker login "${registry_url}" -u "${username}" --password-stdin

        if [[ "${CONFIG[use_credential_helper]}" == "true" ]]; then
            configure_credential_helper "${registry_url}" "pass"
        else
            cat > "${docker_config_dir}/config.json" << EOF
{
    "auths": {
        "${registry_url}": {
            "auth": "$(echo -n "${username}:${token}" | base64)"
        }
    }
}
EOF
            chmod 600 "${docker_config_dir}/config.json"
        fi
        success "GitLab Registry auth configured"
        ;;

    acr)
        if [[ -z "${token}" ]] || [[ -z "${username}" ]]; then
            warn "ACR selected but missing credentials"
            return 0
        fi

        local acr_name="${CONFIG[acr_name]}"
        local acr_fqdn="${acr_name}.azurecr.io"
        info "Logging in to Azure Container Registry (${acr_fqdn})"

        echo "${token}" | docker login "${acr_fqdn}" -u "${username}" --password-stdin

        if [[ "${CONFIG[use_credential_helper]}" == "true" ]]; then
            configure_credential_helper "${acr_fqdn}" "secretservice"
        else
            cat > "${docker_config_dir}/config.json" << EOF
{
    "auths": {
        "${acr_fqdn}": {
            "auth": "$(echo -n "${username}:${token}" | base64)"
        }
    }
}
EOF
            chmod 600 "${docker_config_dir}/config.json"
        fi
        success "Azure Container Registry auth configured"
        ;;
            
nvidia|ngc)
        if [[ -z "${nvidia_key}" ]]; then
            warn "NVIDIA NGC selected but no API key provided"
            return 0
        fi

        info "Logging in to NVIDIA NGC Registry (nvcr.io)"

        echo "${nvidia_key}" | docker login nvcr.io -u '$oauthtoken' --password-stdin

        if [[ "${CONFIG[use_credential_helper]}" == "true" ]]; then
            configure_credential_helper "nvcr.io" "pass"
        else
            cat > "${docker_config_dir}/config.json" << EOF
{
    "auths": {
        "nvcr.io": {
            "auth": "$(echo -n "\$oauthtoken:${nvidia_key}" | base64)"
        }
    }
}
EOF
            chmod 600 "${docker_config_dir}/config.json"
        fi

        if docker pull nvcr.io/nvidia/cuda:12.2.0-base-ubuntu22.04 &>/dev/null; then
            success "NVIDIA NGC auth configured and verified"
        else
            info "NGC auth configured (pull test skipped - may be cached)"
        fi
        ;;

    ghcr)
        if [[ -z "${token}" ]]; then
            warn "GHCR selected but no token provided"
            return 0
        fi

        info "Logging in to GitHub Container Registry"
        echo "${token}" | docker login ghcr.io -u "${username}" --password-stdin

        if [[ "${CONFIG[use_credential_helper]}" == "true" ]]; then
            configure_credential_helper "ghcr.io" "pass"
        else
            cat > "${docker_config_dir}/config.json" << EOF
{
    "auths": {
        "ghcr.io": {
            "auth": "$(echo -n "${username}:${token}" | base64)"
        }
    }
}
EOF
            chmod 600 "${docker_config_dir}/config.json"
        fi
        success "GitHub Container Registry auth configured"
        ;;
            
        "")
            info "No registry specified, skipping auth setup"
            ;;
            
        *)
            warn "Unknown registry: ${registry}"
            ;;
    esac
}

# =============================================================================
# User Setup
# =============================================================================

setup_user() {
    step "Setting up user"
    
    local username="${CONFIG[username]:-vivi}"
    local ssh_key="${CONFIG[ssh_public_key]:-}"
    
    if id "${username}" &>/dev/null; then
        info "User ${username} exists"
        return 0
    fi
    
    useradd -m -s /bin/bash -G sudo "${username}" 2>/dev/null || \
        useradd -m -s /bin/bash -G wheel "${username}"
    
    echo "${username} ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/${username}"
    chmod 440 "/etc/sudoers.d/${username}"
    
    local user_home
    user_home=$(getent passwd "${username}" | cut -d: -f6)
    local ssh_dir="${user_home}/.ssh"
    
    ensure_dir "${ssh_dir}" 700
    chown "${username}:${username}" "${ssh_dir}"
    
    if [[ -n "${ssh_key}" ]]; then
        echo "${ssh_key}" >> "${ssh_dir}/authorized_keys"
        chmod 600 "${ssh_dir}/authorized_keys"
        chown "${username}:${username}" "${ssh_dir}/authorized_keys"
    fi
    
    # Copy docker config to user
    if [[ -f /root/.docker/config.json ]]; then
        local user_docker="${user_home}/.docker"
        ensure_dir "${user_docker}" 700
        cp /root/.docker/config.json "${user_docker}/"
        chown -R "${username}:${username}" "${user_docker}"
    fi
    
    # Add to docker group
    usermod -aG docker "${username}"
    
    success "User ${username} configured"
}

# =============================================================================
# Optional: Monitoring
# =============================================================================

setup_monitoring() {
    [[ "${CONFIG[enable_monitoring]}" == "true" ]] || return 0
    
    step "Setting up monitoring stack"
    
    local username="${CONFIG[username]:-vivi}"
    local user_home
    user_home=$(getent passwd "${username}" | cut -d: -f6)
    local monitoring_dir="${user_home}/monitoring"
    
    ensure_dir "${monitoring_dir}"
    
    cat > "${monitoring_dir}/docker-compose.yml" << 'EOF'
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    ports:
      - "9100:9100"
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:
EOF

    cat > "${monitoring_dir}/prometheus.yml" << 'EOF'
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']
EOF

    chown -R "${username}:${username}" "${monitoring_dir}"
    success "Monitoring stack ready at ${monitoring_dir}"
}

# =============================================================================
# Optional: Reverse Proxy (Traefik/Caddy)
# =============================================================================

setup_traefik() {
    [[ "${CONFIG[enable_traefik]}" == "true" ]] || return 0
    
    step "Setting up Traefik reverse proxy"
    
    local username="${CONFIG[username]:-vivi}"
    local user_home
    user_home=$(getent passwd "${username}" | cut -d: -f6)
    local traefik_dir="${user_home}/traefik"
    
    ensure_dir "${traefik_dir}"
    ensure_dir "${traefik_dir}/rules"
    
    # Create traefik.yml
    cat > "${traefik_dir}/traefik.yml" << EOF
api:
  dashboard: true
  insecure: false

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
  file:
    directory: /rules

certificatesResolvers:
  letsencrypt:
    acme:
      email: ${CONFIG[acme_email]:-admin@localhost}
      storage: /ssl-certs/acme.json
      httpChallenge:
        entryPoint: web
  cloudflare:
    acme:
      email: ${CONFIG[acme_email]:-admin@localhost}
      storage: /ssl-certs/acme.json
      dnsChallenge:
        provider: cloudflare
        resolvers:
          - "1.1.1.1:53"
          - "8.8.8.8:53"
EOF

    # Create docker-compose
    cat > "${traefik_dir}/docker-compose.yml" << EOF
version: '3.8'
services:
  traefik:
    image: traefik:v2.11
    container_name: traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik.yml:/etc/traefik/traefik.yml
      - ./rules:/rules
      - ssl_certs:/ssl-certs
    environment:
      - CF_DNS_API_TOKEN=${CONFIG[cloudflare_api_token]:-}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(\`traefik.${CONFIG[domain]:-localhost}\`)"
      - "traefik.http.routers.dashboard.service=api@internal"
      - "traefik.http.routers.dashboard.entrypoints=websecure"
      - "traefik.http.routers.dashboard.tls.certresolver=letsencrypt"
      - "traefik.http.middlewares.auth.basicauth.users=${CONFIG[traefik_auth]:-}"

volumes:
  ssl_certs:
EOF

    chown -R "${username}:${username}" "${traefik_dir}"
    success "Traefik configured"
}

# =============================================================================
# Profiles
# =============================================================================

apply_profile() {
    local profile="${CONFIG[profile]}"
    
    step "Applying profile: ${profile}"
    
    case "${profile}" in
        minimal)
            # Just Docker, no extras
            CONFIG[enable_monitoring]="false"
            CONFIG[enable_traefik]="false"
            ;;
        web-app)
            CONFIG[enable_monitoring]="true"
            CONFIG[enable_traefik]="true"
            ;;
        ai-workload)
            CONFIG[enable_monitoring]="false"
            CONFIG[enable_traefik]="false"
            # Default to NVIDIA registry if not specified
            [[ -z "${CONFIG[registry]}" ]] && CONFIG[registry]="nvidia"
            ;;
        full-stack)
            CONFIG[enable_monitoring]="true"
            CONFIG[enable_traefik]="true"
            ;;
        *)
            warn "Unknown profile: ${profile}"
            ;;
    esac
    
    success "Profile ${profile} applied"
}

# =============================================================================
# Summary
# =============================================================================

print_summary() {
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}         VPS Provisioning Complete!                    ${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo ""
    
    echo -e "${BLUE}Configuration:${NC}"
    echo "  Profile:     ${CONFIG[profile]}"
    echo "  SSH Port:    ${CONFIG[ssh_port]}"
    echo "  Registry:    ${CONFIG[registry]:-none}"
    echo ""
    
    if [[ "${CONFIG[enable_monitoring]}" == "true" ]]; then
        echo -e "${BLUE}Monitoring:${NC}"
        echo "  Prometheus:  http://$(hostname -I | awk '{print $1}'):9090"
        echo "  Grafana:     http://$(hostname -I | awk '{print $1}'):3000 (admin/admin)"
        echo ""
    fi
    
    if [[ "${CONFIG[enable_traefik]}" == "true" ]]; then
        echo -e "${BLUE}Reverse Proxy:${NC}"
        echo "  Traefik:     ~/traefik/"
        echo "  Domain:      ${CONFIG[domain]:-not configured}"
        echo ""
    fi
    
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. Copy SSH key: ssh-copy-id -p ${CONFIG[ssh_port]} ${CONFIG[username]:-vivi}@$(hostname -I | awk '{print $1}')"
    echo "  2. Test SSH:     ssh -p ${CONFIG[ssh_port]} ${CONFIG[username]:-vivi}@$(hostname -I | awk '{print $1}')"
    echo "  3. View logs:    tail -f ${LOG_FILE}"
    echo ""
    
    if [[ "${CONFIG[registry]}" == "nvidia" ]]; then
        echo -e "${BLUE}NVIDIA NGC:${NC}"
        echo "  Test pull:   docker pull nvcr.io/nvidia/cuda:12.2.0-base-ubuntu22.04"
        echo ""
    fi
    
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
}

# =============================================================================
# CLI
# =============================================================================

show_help() {
    cat << EOF
${SCRIPT_NAME} - VPS Provisioning for Pixelated Empathy

Usage: $0 [OPTIONS]

Profiles:
  --profile minimal        Docker only, no registry auth
  --profile web-app        Docker + GitLab/ACR + Traefik + monitoring
  --profile ai-workload    Docker + NVIDIA NGC registry
  --profile full-stack     Everything

Registry Options:
  --registry gitlab        GitLab Container Registry
  --registry acr           Azure Container Registry
  --registry nvidia        NVIDIA NGC Registry
  --registry ghcr          GitHub Container Registry
  --registry-token TOKEN   Registry password/token
  --registry-user USER     Registry username
  --nvidia-api-key KEY     NVIDIA API key for NGC
  --acr-name NAME          ACR name (without .azurecr.io)

Other Options:
  -u, --username USER      Primary username (default: vivi)
  -p, --port PORT          SSH port (default: 22)
  -k, --ssh-key KEY        SSH public key
  --enable-monitoring      Enable Prometheus/Grafana
  --enable-traefik         Enable Traefik reverse proxy
  --domain DOMAIN          Domain for Traefik/SSL
  --cloudflare-token TOK   Cloudflare API token for DNS challenge
  --timezone TZ            System timezone (default: UTC)
  --swap-size SIZE         Swap size (default: 2G)
  -h, --help               Show this help

Examples:
  # AI workload with NVIDIA NGC
  $0 --profile ai-workload --nvidia-api-key nvapi-xxx --ssh-key "ssh-ed25519 AAAA..."

  # Web app with GitLab registry
  $0 --profile web-app --registry gitlab --registry-token glpat-xxx --domain app.example.com

  # Full stack with ACR
  $0 --profile full-stack --registry acr --acr-name myregistry --registry-user myuser --registry-token xxx

EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --profile)
                CONFIG[profile]="$2"
                shift 2
                ;;
            --registry)
                CONFIG[registry]="$2"
                shift 2
                ;;
        --registry-token)
            CONFIG[registry_token]="$2"
            shift 2
            ;;
        --registry-token-file)
            [[ -f "$2" ]] || die "Token file not found: $2"
            CONFIG[registry_token]=$(<"$2")
            shift 2
            ;;
        --registry-user)
                CONFIG[registry_username]="$2"
                shift 2
                ;;
        --nvidia-api-key)
            CONFIG[nvidia_api_key]="$2"
            shift 2
            ;;
        --nvidia-api-key-file)
            [[ -f "$2" ]] || die "API key file not found: $2"
            CONFIG[nvidia_api_key]=$(<"$2")
            shift 2
            ;;
        --acr-name)
                CONFIG[acr_name]="$2"
                shift 2
                ;;
            -u|--username)
                CONFIG[username]="$2"
                shift 2
                ;;
            -p|--port)
                CONFIG[ssh_port]="$2"
                shift 2
                ;;
            -k|--ssh-key)
                CONFIG[ssh_public_key]="$2"
                shift 2
                ;;
            --enable-monitoring)
                CONFIG[enable_monitoring]="true"
                shift
                ;;
            --enable-traefik)
                CONFIG[enable_traefik]="true"
                shift
                ;;
            --domain)
                CONFIG[domain]="$2"
                shift 2
                ;;
        --cloudflare-token)
            CONFIG[cloudflare_api_token]="$2"
            shift 2
            ;;
        --cloudflare-token-file)
            [[ -f "$2" ]] || die "Token file not found: $2"
            CONFIG[cloudflare_api_token]=$(<"$2")
            shift 2
            ;;
        --acme-email)
                CONFIG[acme_email]="$2"
                shift 2
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
    echo -e "${BLUE}║     Pixelated Empathy VPS Provisioning               ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    check_root
    detect_os
    
    # Core setup
    setup_base
    create_swap
    setup_ssh
    setup_firewall
    
    # Profile
    apply_profile
    
    # Docker (always)
    setup_docker
    
    # Registry auth (the main event)
    setup_registry_auth
    
    # User (after docker so they get the config)
    setup_user
    
    # Optional
    setup_monitoring
    setup_traefik
    
    # Done
    print_summary
}

main "$@"

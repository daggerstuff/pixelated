#!/usr/bin/env bash
set -euo pipefail

# scripts/setup-swap.sh
# Idempotent script to create a swap file, tune sysctl (inotify, swappiness),
# and harden/adjust sshd settings to reduce disconnects under heavy load.
# Usage: sudo bash scripts/setup-swap.sh [SIZE_GB]

SIZE_GB=${1:-4}
SWAPFILE=/swapfile

echo "== Setup swap: ${SIZE_GB}GB -> ${SWAPFILE} =="

ensure_swapfile() {
  if swapon --show=NAME | grep -q "^${SWAPFILE}$"; then
    echo "Swapfile ${SWAPFILE} already active"
    return 0
  fi

  if [ -f "${SWAPFILE}" ]; then
    echo "Swapfile exists but not active. Activating..."
    chmod 600 "${SWAPFILE}" || true
    mkswap "${SWAPFILE}" || true
    swapon "${SWAPFILE}"
    return 0
  fi

  # Create swapfile
  fallocate -l "${SIZE_GB}G" "${SWAPFILE}" 2>/dev/null || dd if=/dev/zero of="${SWAPFILE}" bs=1M count=$((SIZE_GB * 1024)) status=progress
  chmod 600 "${SWAPFILE}"
  mkswap "${SWAPFILE}"
  swapon "${SWAPFILE}"
  echo "Created and activated swapfile ${SWAPFILE} (${SIZE_GB}G)"

  # Persist in /etc/fstab if not already present
  if ! grep -q "^${SWAPFILE}" /etc/fstab 2>/dev/null; then
    echo "${SWAPFILE} none swap sw 0 0" >> /etc/fstab
    echo "Added ${SWAPFILE} to /etc/fstab"
  else
    echo "/etc/fstab already contains ${SWAPFILE} entry"
  fi
}

apply_sysctl() {
  echo "== Applying sysctl tuning =="
  # Increase inotify watches to avoid watcher exhaustion for large repos
  SYSCTL_CONF=/etc/sysctl.d/99-pixelated.conf
  cat > "$SYSCTL_CONF" <<'EOF'
# Pixelated dev tuning
fs.inotify.max_user_watches=524288
vm.swappiness=10
vm.vfs_cache_pressure=50
EOF
  sysctl --system || true
  echo "Applied sysctl settings from $SYSCTL_CONF"
}

tune_sshd() {
  echo "== Tuning SSH server keepalive settings =="
  SSHD_CONF=/etc/ssh/sshd_config
  BACKUP=${SSHD_CONF}.pixelated.bak
  if [ ! -f "$BACKUP" ]; then
    cp "$SSHD_CONF" "$BACKUP" || true
  fi

  # Helper to set or replace a directive
  set_sshd_directive() {
    local key="$1" value="$2"
    if grep -Eq "^\s*#?\s*${key}\b" "$SSHD_CONF"; then
      sed -ri "s|^\s*#?\s*${key}\b.*|${key} ${value}|" "$SSHD_CONF"
    else
      echo "${key} ${value}" >> "$SSHD_CONF"
    fi
  }

  # Reduce SSH timeout disconnects: keepalive from server and client side
  set_sshd_directive ClientAliveInterval 60
  set_sshd_directive ClientAliveCountMax 10

  # Optionally increase MaxSessions to allow multiplexed sessions
  set_sshd_directive MaxSessions 10

  # Restart sshd if systemd present
  if command -v systemctl >/dev/null && systemctl list-units --type=service | grep -q sshd; then
    systemctl restart sshd || systemctl restart ssh || true
    echo "sshd restarted via systemctl"
  else
    service ssh restart 2>/dev/null || service sshd restart 2>/dev/null || true
    echo "sshd restart attempted via service"
  fi
}

main() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "This script requires root. Run with sudo." >&2
    exit 2
  fi

  ensure_swapfile
  apply_sysctl
  tune_sshd

  echo "== Verification =="
  echo "Swap summary:"; swapon --show || true
  echo "Free memory (including swap):"; free -h || true
  echo "Current fs.inotify.max_user_watches:"; sysctl fs.inotify.max_user_watches || true
  echo "Current vm.swappiness:"; sysctl vm.swappiness || true
  echo "sshd config snippets (ClientAlive* and MaxSessions):"
  grep -E "^\s*(ClientAliveInterval|ClientAliveCountMax|MaxSessions)\b" /etc/ssh/sshd_config || true

  echo "Done. If you use SSH clients, consider also setting ServerAliveInterval/CountMax on the client-side ~/.ssh/config"
}

main "$@"

#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

install_unit() {
    local template_file="$1"
    local destination_file="$2"
    local target_user="$3"
    local target_group="$4"
    local env_file="$5"

    sed \
        -e "s|__USER__|${target_user}|g" \
        -e "s|__GROUP__|${target_group}|g" \
        -e "s|__WORKDIR__|${REPO_ROOT}|g" \
        -e "s|__ENV_FILE__|${env_file}|g" \
        -e "s|__BACKUP_SCRIPT__|${REPO_ROOT}/scripts/memory/backup-shared-memory-db.sh|g" \
        -e "s|__MONITOR_SCRIPT__|${REPO_ROOT}/scripts/memory/monitor-shared-memory-service.sh|g" \
        "${template_file}" | sudo tee "${destination_file}" >/dev/null
}

TARGET_USER="${TARGET_USER:-${SUDO_USER:-${USER}}}"
TARGET_GROUP="${TARGET_GROUP:-${TARGET_USER}}"
ENV_FILE="${ENV_FILE:-/etc/pixelated/pixelated-memory.env}"
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"

BACKUP_SERVICE_NAME="${BACKUP_SERVICE_NAME:-pixelated-memory-backup.service}"
BACKUP_TIMER_NAME="${BACKUP_TIMER_NAME:-pixelated-memory-backup.timer}"
MONITOR_SERVICE_NAME="${MONITOR_SERVICE_NAME:-pixelated-memory-monitor.service}"
MONITOR_TIMER_NAME="${MONITOR_TIMER_NAME:-pixelated-memory-monitor.timer}"

sudo mkdir -p "${SYSTEMD_DIR}"
sudo mkdir -p /var/backups/pixelated-memory
sudo chown "${TARGET_USER}:${TARGET_GROUP}" /var/backups/pixelated-memory

install_unit \
    "${REPO_ROOT}/scripts/systemd/pixelated-memory-backup.service.template" \
    "${SYSTEMD_DIR}/${BACKUP_SERVICE_NAME}" \
    "${TARGET_USER}" \
    "${TARGET_GROUP}" \
    "${ENV_FILE}"
sudo cp "${REPO_ROOT}/scripts/systemd/pixelated-memory-backup.timer.template" "${SYSTEMD_DIR}/${BACKUP_TIMER_NAME}"

install_unit \
    "${REPO_ROOT}/scripts/systemd/pixelated-memory-monitor.service.template" \
    "${SYSTEMD_DIR}/${MONITOR_SERVICE_NAME}" \
    "${TARGET_USER}" \
    "${TARGET_GROUP}" \
    "${ENV_FILE}"
sudo cp "${REPO_ROOT}/scripts/systemd/pixelated-memory-monitor.timer.template" "${SYSTEMD_DIR}/${MONITOR_TIMER_NAME}"

sudo systemctl daemon-reload
echo "Installed memory ops units:"
echo "  ${SYSTEMD_DIR}/${BACKUP_SERVICE_NAME}"
echo "  ${SYSTEMD_DIR}/${BACKUP_TIMER_NAME}"
echo "  ${SYSTEMD_DIR}/${MONITOR_SERVICE_NAME}"
echo "  ${SYSTEMD_DIR}/${MONITOR_TIMER_NAME}"
echo "Enable with:"
echo "  sudo systemctl enable --now ${BACKUP_TIMER_NAME} ${MONITOR_TIMER_NAME}"

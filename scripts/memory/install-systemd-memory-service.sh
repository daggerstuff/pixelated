#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TEMPLATE_PATH="${REPO_ROOT}/scripts/systemd/pixelated-memory.service.template"

SERVICE_NAME="${SERVICE_NAME:-pixelated-memory.service}"
TARGET_USER="${TARGET_USER:-${SUDO_USER:-${USER}}}"
TARGET_GROUP="${TARGET_GROUP:-${TARGET_USER}}"
ENV_FILE="${ENV_FILE:-/etc/pixelated/pixelated-memory.env}"
INSTALL_PATH="${INSTALL_PATH:-/etc/systemd/system/${SERVICE_NAME}}"

if [[ ! -f "${TEMPLATE_PATH}" ]]; then
    echo "Missing systemd unit template: ${TEMPLATE_PATH}" >&2
    exit 1
fi

sudo mkdir -p "$(dirname "${INSTALL_PATH}")"
sudo mkdir -p "$(dirname "${ENV_FILE}")"

DEFAULT_STATE_DIR="/var/lib/pixelated-memory"
sudo mkdir -p "${DEFAULT_STATE_DIR}"
sudo chown "${TARGET_USER}:${TARGET_GROUP}" "${DEFAULT_STATE_DIR}"

if [[ -f "${ENV_FILE}" ]]; then
    DB_PATH="$(grep -E '^HINDSIGHT_LOCAL_DB_PATH=' "${ENV_FILE}" | tail -n1 | cut -d= -f2- || true)"
    DB_DIR=""
    if [[ -n "${DB_PATH}" ]]; then
        DB_DIR="$(dirname "${DB_PATH}")"
    fi
    if [[ -n "${DB_DIR}" ]]; then
        case "${DB_DIR}" in
            "${DEFAULT_STATE_DIR}"|${DEFAULT_STATE_DIR}/*)
                ;;
            *)
                echo "Refusing to chown unsafe DB directory outside ${DEFAULT_STATE_DIR}: ${DB_DIR}" >&2
                exit 1
                ;;
        esac
        sudo mkdir -p "${DB_DIR}"
        sudo chown "${TARGET_USER}:${TARGET_GROUP}" "${DB_DIR}"
    fi
fi

sed \
    -e "s|__USER__|${TARGET_USER}|g" \
    -e "s|__GROUP__|${TARGET_GROUP}|g" \
    -e "s|__WORKDIR__|${REPO_ROOT}|g" \
    -e "s|__ENV_FILE__|${ENV_FILE}|g" \
    -e "s|__START_SCRIPT__|${REPO_ROOT}/scripts/memory/run-shared-memory-service.sh|g" \
    "${TEMPLATE_PATH}" | sudo tee "${INSTALL_PATH}" >/dev/null

sudo systemctl daemon-reload
echo "Installed ${INSTALL_PATH}"
echo "Next steps:"
echo "  1. Copy ai/config/staging/memory-service.env.example to ${ENV_FILE} and set real secrets."
echo "  2. sudo systemctl enable --now ${SERVICE_NAME}"

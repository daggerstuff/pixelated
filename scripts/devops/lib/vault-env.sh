#!/usr/bin/env bash

load_vault_env() {
  local vault_env_file="${HOME}/.local/share/pixelated-vault/env"
  local require_token="${1:-1}"
  local _log
  local _warn

  if declare -F log >/dev/null; then
    _log=log
  else
    _log=printf
  fi

  if declare -F warn >/dev/null; then
    _warn=warn
  else
    _warn=printf
  fi

  if [[ -f "$vault_env_file" ]]; then
    "${_log}" '%b\n' "📦 Loading vault environment from ~/.local/share/pixelated-vault/env"
    set -a
    # shellcheck source=/dev/null
    source "$vault_env_file"
    set +a
  fi

  export VAULT_ADDR="${VAULT_ADDR:-${NEMO_VAULT_ADDR:-http://host.docker.internal:8200}}"
  export VAULT_TOKEN="${VAULT_TOKEN:-${NEMO_VAULT_TOKEN:-}}"

  if [[ "${require_token}" == "1" && -z "${VAULT_TOKEN}" ]]; then
    "${_warn}" '%b\n' "⚠️ VAULT_TOKEN is required to connect to the system Vault."
    "${_warn}" '%b\n' "   Load ~/.local/share/pixelated-vault/env (contains VAULT_TOKEN) or set VAULT_TOKEN explicitly."
    return 1
  fi

  if [[ "${require_token}" == "1" && "$VAULT_ADDR" != http*://* ]]; then
    "${_warn}" '%b\n' "⚠️ VAULT_ADDR must be a valid URL (http://... or https://...)."
    "${_warn}" '%b\n' "   Current value: ${VAULT_ADDR}"
    return 1
  fi

  return 0
}

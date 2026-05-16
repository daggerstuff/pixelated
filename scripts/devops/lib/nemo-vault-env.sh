#!/usr/bin/env bash

load_nemo_vault_env() {
  if [[ -f "${BASH_SOURCE[0]%/*}/vault-env.sh" ]]; then
    # shellcheck source=/dev/null
    source "${BASH_SOURCE[0]%/*}/vault-env.sh"
  else
    warn "⚠️ Missing helper script: ${BASH_SOURCE[0]%/*}/vault-env.sh"
    return 1
  fi

  if ! load_vault_env 1; then
    return 1
  fi

  export NEMO_VAULT_ADDR="${NEMO_VAULT_ADDR:-${VAULT_ADDR}}"
  export NEMO_VAULT_TOKEN="${NEMO_VAULT_TOKEN:-${VAULT_TOKEN}}"
  return 0
}

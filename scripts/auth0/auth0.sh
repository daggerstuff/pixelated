#!/usr/bin/env bash
# Run Auth0 CLI on SSH/headless hosts without dbus/keyring hangs.
# Skips secret-service; uses access_token in ~/.config/auth0/config.json.
# Refresh token: scripts/auth0/bootstrap-cli-config.sh
# If this still hangs, use scripts/auth0/mgmt-api.sh instead (no auth0 binary).
set -euo pipefail

# Must override, not default: SSH sessions export a real dbus address and keyring blocks forever.
export DBUS_SESSION_BUS_ADDRESS=/dev/null

DIR="$(dirname "${BASH_SOURCE[0]}")"

if [[ ! -f "${HOME}/.config/auth0/config.json" ]]; then
  "$DIR/bootstrap-cli-config.sh"
fi

exec auth0 "$@"

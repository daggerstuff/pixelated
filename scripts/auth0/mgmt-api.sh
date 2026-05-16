#!/usr/bin/env bash
# Management API via curl — no auth0 CLI binary, no dbus/keyring.
# Uses token from ~/.config/auth0/config.json (from bootstrap-cli-config.sh).
set -euo pipefail

CFG="${HOME}/.config/auth0/config.json"
CMD="${1:-}"
shift || true

if [[ ! -f "$CFG" ]]; then
  echo "Run: scripts/auth0/bootstrap-cli-config.sh" >&2
  exit 1
fi

read -r DOMAIN TOKEN <<<"$(python3 - "$CFG" <<'PY'
import json, sys
cfg = json.load(open(sys.argv[1]))
t = cfg["tenants"][cfg["default_tenant"]]
print(t["domain"], t.get("access_token") or "")
PY
)"

if [[ -z "$TOKEN" ]]; then
  echo "No access_token in $CFG — run bootstrap-cli-config.sh" >&2
  exit 1
fi

api() {
  local path="$1"
  curl -sS --max-time 30 \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    "https://${DOMAIN}/api/v2${path}"
}

case "$CMD" in
  tenants|tenant)
    python3 - "$CFG" <<'PY'
import json, sys
cfg = json.load(open(sys.argv[1]))
for domain, t in cfg.get("tenants", {}).items():
    mark = "→" if domain == cfg.get("default_tenant") else " "
    print(f"  {mark}  {domain}")
PY
    ;;
  apps|clients)
    api "/clients?per_page=100" | jq '[.[] | {name, client_id, app_type, callbacks: (.callbacks // [])[0:3]}]'
    ;;
  apis|api)
    api "/resource-servers?per_page=100" | jq '[.[] | {id, name, identifier}]'
    ;;
  users)
    api "/users?per_page=100&fields=email,user_id,last_login&include_fields=true" \
      | jq '[.[] | {email, user_id, last_login}]'
    ;;
  tenant-settings)
    api "/tenants/settings" | jq '{friendly_name, support_email}'
    ;;
  *)
    echo "Usage: $0 {tenants|apps|apis|users|tenant-settings}" >&2
    exit 1
    ;;
esac

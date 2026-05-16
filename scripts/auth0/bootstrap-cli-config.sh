#!/usr/bin/env bash
# Bootstrap ~/.config/auth0/config.json for machine (M2M) auth without `auth0 login`.
# Use when `auth0 login` hangs on SSH (keyring/dbus). Requires AUTH0_* in .env.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source <(grep -E '^AUTH0_(DOMAIN|MANAGEMENT_CLIENT_ID|MANAGEMENT_CLIENT_SECRET)=' "$ENV_FILE" | sed 's/^/export /')
set +a

for v in AUTH0_DOMAIN AUTH0_MANAGEMENT_CLIENT_ID AUTH0_MANAGEMENT_CLIENT_SECRET; do
  if [[ -z "${!v:-}" ]]; then
    echo "Set $v in $ENV_FILE" >&2
    exit 1
  fi
done

python3 - "$AUTH0_DOMAIN" "$AUTH0_MANAGEMENT_CLIENT_ID" "$AUTH0_MANAGEMENT_CLIENT_SECRET" <<'PY'
import json, sys, uuid, urllib.parse, urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

domain, cid, csec = sys.argv[1:4]
data = urllib.parse.urlencode({
    "grant_type": "client_credentials",
    "client_id": cid,
    "client_secret": csec,
    "audience": f"https://{domain}/api/v2/",
}).encode()
req = urllib.request.Request(
    f"https://{domain}/oauth/token",
    data=data,
    method="POST",
    headers={"content-type": "application/x-www-form-urlencoded"},
)
with urllib.request.urlopen(req, timeout=30) as r:
    tok = json.loads(r.read())

expires = datetime.now(timezone.utc) + timedelta(seconds=int(tok.get("expires_in", 86400)))
cfg = {
    "install_id": str(uuid.uuid4()),
    "default_tenant": domain,
    "tenants": {
        domain: {
            "name": domain.split(".")[0],
            "domain": domain,
            "access_token": tok["access_token"],
            "expires_at": expires.isoformat().replace("+00:00", "Z"),
            "client_id": cid,
        }
    },
}
path = Path.home() / ".config/auth0/config.json"
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(cfg, indent=2))
path.chmod(0o600)
print(f"Wrote {path} (expires {cfg['tenants'][domain]['expires_at']})")
PY

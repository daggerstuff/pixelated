#!/usr/bin/env bash
# metoro-exporter/deploy.sh
#
# Use THIS script instead of `helm upgrade ... metoro-exporter/metoro-exporter`
# The upstream chart always deploys the node-agent DaemonSet which is
# incompatible with GKE Autopilot. Our local chart has the fix.
#
# Usage:
#   ./metoro-exporter/deploy.sh <bearer-token>
#   ./metoro-exporter/deploy.sh  # uses METORO_TOKEN env var

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN="${1:-${METORO_TOKEN:-}}"

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: Provide bearer token as argument or set METORO_TOKEN env var" >&2
  exit 1
fi

helm upgrade --install \
  --create-namespace \
  --namespace metoro \
  --force-conflicts \
  metoro-exporter \
  "$SCRIPT_DIR" \
  --set exporter.secret.bearerToken="$TOKEN"

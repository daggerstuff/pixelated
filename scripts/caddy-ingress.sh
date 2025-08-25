#!/bin/bash
set -euo pipefail

repo="https://caddyserver.github.io/ingress/"
index_url="${repo%/}/index.yaml"
echo "Fetching Helm index: $index_url"
if ! curl -fsSL "$index_url" -o /tmp/index.yaml; then
  echo "ERROR: Cannot fetch index.yaml from $index_url" >&2
  exit 1
fi

echo "Looking for chart: caddy-ingress-controller"
grep -nE '(^|\s)name:\s*caddy-ingress-controller\s*$' /tmp/index.yaml || {
  echo "ERROR: Chart 'caddy-ingress-controller' not found in index." >&2
  exit 2
}

echo "Checking for version 1.0.0"
awk '/^entries:/{flag=1} flag' /tmp/index.yaml \
  | awk '/^- name: caddy-ingress-controller/{p=1} p' \
  | awk '/^- name: /{exit} {print}' \
  | grep -nE '(^|\s)version:\s*1\.0\.0\s*$' || {
    echo "ERROR: Version 1.0.0 not listed for caddy-ingress-controller." >&2
    exit 3
  }

echo "Repo and chart checks passed."

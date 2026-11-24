#!/usr/bin/env bash
# Headless authentication for the Vercel MCP server.
#
# https://mcp.vercel.com only accepts an OAuth access token (or a Vercel
# access token) as a Bearer header. When the configured token is missing or
# expired the server replies 401 with a WWW-Authenticate challenge, so MCP
# clients fall back to the OAuth flow, which tries to launch a browser and
# loops forever on a headless machine.
#
# `sync` reuses the token the Vercel CLI already holds (created by
# `vercel login`) and writes it into the user-level MCP configs, so clients
# authenticate with a static header and never start the OAuth flow. The
# OAuth-only server shipped by the Vercel Claude plugin is disabled at the
# same time, since it can never complete its login here.
#
# Usage:
#   scripts/devops/vercel-mcp-headless.sh check   # verify the token works
#   scripts/devops/vercel-mcp-headless.sh sync    # write it into MCP configs

set -euo pipefail

MCP_URL="https://mcp.vercel.com"
INIT_BODY='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"vercel-mcp-headless","version":"1"}}}'

cli_auth_file() {
    local candidate
    for candidate in \
        "${XDG_DATA_HOME:-$HOME/.local/share}/com.vercel.cli/auth.json" \
        "$HOME/Library/Application Support/com.vercel.cli/auth.json"; do
        if [ -f "$candidate" ]; then
            printf '%s\n' "$candidate"
            return 0
        fi
    done
    return 1
}

resolve_token() {
    if [ -n "${VERCEL_TOKEN:-}" ]; then
        printf '%s' "$VERCEL_TOKEN"
        return 0
    fi
    local auth
    auth=$(cli_auth_file) || return 1
    python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["token"], end="")' "$auth"
}

verify_token() {
    local token="$1" code
    code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 -X POST "$MCP_URL" \
        -H "Authorization: Bearer ${token}" \
        -H 'Content-Type: application/json' \
        -H 'Accept: application/json, text/event-stream' \
        -d "$INIT_BODY")
    case "$code" in
        200 | 202)
            return 0
            ;;
        401 | 403)
            echo "✖ ${MCP_URL} rejected the token (HTTP ${code}): it is expired or revoked. Run 'vercel login' and try again." >&2
            return 1
            ;;
        *)
            echo "✖ Unexpected response from ${MCP_URL} (HTTP ${code})." >&2
            return 1
            ;;
    esac
}

sync_configs() {
    VERCEL_MCP_TOKEN="$1" python3 - <<'PY'
import json
import os
import pathlib

token = os.environ["VERCEL_MCP_TOKEN"]
url = "https://mcp.vercel.com"
authorization = f"Bearer {token}"
changed = []


def read(path):
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return None


def write(path, data, indent):
    path.write_text(json.dumps(data, indent=indent) + "\n")
    path.chmod(0o600)
    changed.append(str(path))


# Junie: replace the stale token in the existing HTTP server entry.
path = pathlib.Path.home() / ".junie/mcp/mcp.json"
data = read(path)
if data is not None:
    entry = data.setdefault("mcpServers", {}).setdefault("vercel", {"url": url})
    entry.setdefault("url", url)
    headers = entry.setdefault("headers", {})
    if headers.get("Authorization") != authorization:
        headers["Authorization"] = authorization
        write(path, data, indent=4)

# Claude Code: user-scoped HTTP server that authenticates with the same token.
path = pathlib.Path.home() / ".claude.json"
data = read(path)
if data is not None:
    desired = {"type": "http", "url": url, "headers": {"Authorization": authorization}}
    servers = data.setdefault("mcpServers", {})
    if servers.get("vercel") != desired:
        servers["vercel"] = desired
        write(path, data, indent=2)

# Claude Code: disable the plugin's OAuth-only copy so it stops prompting for
# a browser login. The rest of the plugin (skills, commands, agents) stays on.
path = pathlib.Path.home() / ".claude/settings.json"
data = read(path)
if data is not None:
    disabled = data.setdefault("disabledMcpServers", [])
    if "plugin:vercel:vercel" not in disabled:
        disabled.append("plugin:vercel:vercel")
        write(path, data, indent=2)

print("\n".join(f"✎ updated {item}" for item in changed) if changed else "✔ already in sync")
PY
}

main() {
    local command="${1:-check}" token
    case "$command" in
        check | sync) ;;
        *)
            echo "usage: $0 [check|sync]" >&2
            exit 2
            ;;
    esac

    if ! token=$(resolve_token) || [ -z "$token" ]; then
        echo "✖ No Vercel token found. Run 'vercel login' or export VERCEL_TOKEN." >&2
        exit 1
    fi

    verify_token "$token"
    echo "✔ ${MCP_URL} accepts the Vercel CLI token."

    if [ "$command" = "sync" ]; then
        sync_configs "$token"
        echo "✔ Restart the MCP clients to pick up the new config."
    fi
}

main "$@"

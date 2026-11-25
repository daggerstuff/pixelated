#!/usr/bin/env bash
# Bridge dotagents (.agents/) state into Command Code.
#
# Command Code implements the dotagents.io layout natively for *skills*: it
# discovers .agents/skills/ (project) and ~/.agents/skills/ (user), so the
# dotagents-managed skill tree needs no workaround.
#
# It does NOT read ~/.agents/mcp.json. MCP servers must live in one of:
#   ~/.commandcode/mcp.json   user scope (all projects)
#   .mcp.json                 project scope (checked in)
#   ~/.commandcode/projects/<slug>/mcp.json   local scope (private)
# dotagents has no `commandcode` target (its registry is claude, cursor, codex,
# vscode, opencode, copilot, pi, antigravity), so user-level MCP servers
# declared for the other agents never reach Command Code. This script closes
# that gap by merging the dotagents MCP config into the Command Code user scope.
#
# Safety rules:
#   - never deletes a Command Code server
#   - never overwrites a same-named server with a different definition
#     (reported as a conflict instead)
#   - skips a server whose full connection spec (command/args/env/url/headers)
#     is already configured under another name, so aliases do not spawn
#     duplicate MCP processes
#   - preserves every other key in the target document, top-level and
#     per-server
#
# Usage:
#   scripts/devops/cc-agents-sync.sh status   # report only (default)
#   scripts/devops/cc-agents-sync.sh sync     # merge, then report
#   scripts/devops/cc-agents-sync.sh sync --dry-run
#
# Environment:
#   CC_AGENTS_MCP_SOURCE   source config (default ~/.agents/mcp.json)
#   CC_MCP_TARGET          target config (default ~/.commandcode/mcp.json)

set -euo pipefail

command="${1:-status}"
shift || true

dry_run=0
for arg in "$@"; do
    case "$arg" in
        --dry-run) dry_run=1 ;;
        *)
            echo "unknown option: $arg" >&2
            exit 2
            ;;
    esac
done

case "$command" in
    status) apply=0 ;;
    sync) apply=1 ;;
    help | -h | --help)
        sed -n '2,/^set -euo pipefail$/p' "${BASH_SOURCE[0]}" |
            sed '1d;$d;s/^# \{0,1\}//'
        exit 0
        ;;
    *)
        echo "usage: $0 [status|sync] [--dry-run]" >&2
        exit 2
        ;;
esac

if [ "$dry_run" = 1 ]; then
    apply=0
fi

# Expand a leading ~ so `CC_MCP_TARGET=~/x ...` works under `set -u`.
expand() {
    case "$1" in
        '~') printf '%s\n' "$HOME" ;;
        '~/'*) printf '%s\n' "$HOME/${1#\~/}" ;;
        *) printf '%s\n' "$1" ;;
    esac
}

SOURCE="$(expand "${CC_AGENTS_MCP_SOURCE:-$HOME/.agents/mcp.json}")"
TARGET="$(expand "${CC_MCP_TARGET:-$HOME/.commandcode/mcp.json}")"

if [ ! -f "$SOURCE" ]; then
    echo "No dotagents MCP config at $SOURCE — nothing to bridge." >&2
    echo "Declare servers with: npx @sentry/dotagents mcp add <name> ..." >&2
    exit 1
fi

exec python3 - "$SOURCE" "$TARGET" "$apply" <<'PY'
import json
import os
import shutil
import sys
import tempfile

source_path = os.path.abspath(sys.argv[1])
target_path = os.path.abspath(sys.argv[2])
apply = sys.argv[3] == "1"


def die(message):
    print(f"error: {message}", file=sys.stderr)
    sys.exit(2)


def read_document(path, label):
    """Return the whole document so unknown top-level keys survive the rewrite."""
    try:
        with open(path, encoding="utf-8") as fh:
            doc = json.load(fh)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError as exc:
        die(f"{label} is not valid JSON ({path}): {exc}")
    if not isinstance(doc, dict):
        die(f"{label} must be a JSON object ({path})")
    if not isinstance(doc.get("mcpServers", {}), dict):
        die(f'{label}: "mcpServers" must be an object ({path})')
    return doc


def identity(server):
    """Full connection identity — matching servers are the same process."""
    env = tuple(sorted((server.get("env") or {}).items()))
    if server.get("url"):
        headers = tuple(sorted((server.get("headers") or {}).items()))
        return ("http", server["url"], headers, env)
    return ("stdio", server.get("command"), tuple(server.get("args") or []), env)


def kind(server):
    return "http" if server.get("url") else "stdio"


source_doc = read_document(source_path, "source")
target_doc = read_document(target_path, "target")
source = source_doc.get("mcpServers") or {}
target = target_doc.get("mcpServers") or {}

seen = {identity(server) for server in target.values()}

added, conflicts, duplicates = [], [], []
merged = dict(target)

for name in sorted(source):
    incoming = dict(source[name])
    incoming.setdefault("enabled", True)
    if incoming.get("type") and not incoming.get("transport"):
        incoming["transport"] = incoming["type"]

    if name in merged:
        if identity(merged[name]) == identity(incoming):
            continue
        conflicts.append((name, merged[name], incoming))
        continue

    ident = identity(incoming)
    if ident in seen:
        duplicates.append((name, kind(incoming)))
        continue

    merged[name] = incoming
    seen.add(ident)
    added.append(name)

print(f"source: {source_path} ({len(source)} servers)")
print(f"target: {target_path} ({len(target)} servers)")

if added:
    print(f"\nadd ({len(added)}):")
    for name in added:
        print(f"  + {name}  [{kind(merged[name])}]")
else:
    print("\nadd: nothing new")

if conflicts:
    print(f"\nconflict ({len(conflicts)}) — left untouched, resolve by hand:")
    for name, existing, incoming in conflicts:
        print(f"  ! {name}")
        print(f"      cc:      {json.dumps(existing, sort_keys=True)}")
        print(f"      .agents: {json.dumps(incoming, sort_keys=True)}")

if duplicates:
    print(f"\nalready configured under another name ({len(duplicates)}) — skipped:")
    for name, transport in duplicates:
        print(f"  = {name}  [{transport}]")

target_only = sorted(set(target) - set(source))
if target_only:
    print(f"\nCommand Code only ({len(target_only)}) — preserved:")
    for name in target_only:
        print(f"  · {name}")

if not added:
    print("\nNo changes needed.")
    sys.exit(0)

if not apply:
    print(f"\nDry run. Re-run with `sync` to write {target_path}.")
    sys.exit(0)

directory = os.path.dirname(target_path) or "."
os.makedirs(directory, exist_ok=True)

backed_up = False
if os.path.exists(target_path):
    shutil.copy2(target_path, target_path + ".bak")
    backed_up = True

target_doc["mcpServers"] = merged
handle, tmp = tempfile.mkstemp(dir=directory, suffix=".tmp")
try:
    with os.fdopen(handle, "w", encoding="utf-8") as fh:
        json.dump(target_doc, fh, indent=2, sort_keys=True)
        fh.write("\n")
    os.replace(tmp, target_path)
except BaseException:
    if os.path.exists(tmp):
        os.unlink(tmp)
    raise

suffix = f" Backup at {target_path}.bak" if backed_up else ""
print(f"\nWrote {target_path} (+{len(added)}).{suffix}")
PY

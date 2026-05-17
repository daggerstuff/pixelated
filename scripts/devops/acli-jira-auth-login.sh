#!/usr/bin/env bash
# Jira CLI auth — start keyring first, then login (interactive or flags).
set -euo pipefail

eval "$(gnome-keyring-daemon --start --components=secrets 2>/dev/null)"

if [[ $# -gt 0 ]]; then
  exec acli jira auth login "$@"
fi

exec acli jira auth login

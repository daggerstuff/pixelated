#!/usr/bin/env bash

set -euo pipefail

echo "🧹 Cleaning Docker leftovers on the self-hosted runner"
docker container prune --force || true
docker image prune --force --filter "until=168h" || true
docker builder prune --force --filter "until=168h" || true
docker volume prune --force || true

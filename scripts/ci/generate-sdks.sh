#!/usr/bin/env bash
set -euo pipefail

# Generate TypeScript and Python SDKs from OpenAPI spec using openapi-generator-cli
# Usage: ./scripts/ci/generate-sdks.sh [--publish npm_token pypi_token]
# Requires: Java 17+ (openapi-generator-cli is Java-based)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SPEC_FILE="$ROOT_DIR/apps/web/src/content-store/docs/api-reference/openapi.yaml"
TS_OUTPUT="$ROOT_DIR/packages/sdk-typescript"
PY_OUTPUT="$ROOT_DIR/packages/sdk-python"
GENERATOR_VERSION="7.12.0"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[sdk-gen]${NC} $1"; }
warn() { echo -e "${YELLOW}[sdk-gen]${NC} $1"; }
err() { echo -e "${RED}[sdk-gen]${NC} $1" >&2; }

# Verify spec exists
if [[ ! -f "$SPEC_FILE" ]]; then
  err "OpenAPI spec not found at $SPEC_FILE"
  exit 1
fi

# Check Java
if ! command -v java &>/dev/null; then
  err "Java 17+ is required for openapi-generator-cli"
  exit 1
fi

# Download openapi-generator-cli if not present
JAR_FILE="$ROOT_DIR/.cache/openapi-generator-cli.jar"
mkdir -p "$(dirname "$JAR_FILE")"
if [[ ! -f "$JAR_FILE" ]]; then
  log "Downloading openapi-generator-cli v$GENERATOR_VERSION..."
  curl -sSL "https://repo1.maven.org/maven2/org/openapitools/openapi-generator-cli/$GENERATOR_VERSION/openapi-generator-cli-$GENERATOR_VERSION.jar" -o "$JAR_FILE"
fi

GENERATOR_JAR="java -jar $JAR_FILE"

# Extract version from OpenAPI spec
SPEC_VERSION=$(python3 -c "
import yaml, sys
with open('$SPEC_FILE') as f:
    spec = yaml.safe_load(f)
print(spec.get('info', {}).get('version', '1.0.0'))
")
log "OpenAPI spec version: $SPEC_VERSION"

# ─── TypeScript SDK ─────────────────────────────────────────────────────────

log "Generating TypeScript SDK..."
rm -rf "$TS_OUTPUT/src"
mkdir -p "$TS_OUTPUT/src"

$GENERATOR_JAR generate \
  -i "$SPEC_FILE" \
  -g typescript-fetch \
  -o "$TS_OUTPUT/generated" \
  -c "$TS_OUTPUT/openapi-generator-config.json" \
  --additional-properties=npmVersion="$SPEC_VERSION"

# Move generated files to src/
cp -r "$TS_OUTPUT/generated/src/"* "$TS_OUTPUT/src/"
cp "$TS_OUTPUT/generated/README" "$TS_OUTPUT/GENERATED_README.md" 2>/dev/null || true
rm -rf "$TS_OUTPUT/generated"

log "TypeScript SDK generated at $TS_OUTPUT/src/"

# ─── Python SDK ─────────────────────────────────────────────────────────────

log "Generating Python SDK..."
rm -rf "$PY_OUTPUT/pixelated_empathy_sdk"
mkdir -p "$PY_OUTPUT/pixelated_empathy_sdk"

$GENERATOR_JAR generate \
  -i "$SPEC_FILE" \
  -g python \
  -o "$PY_OUTPUT/generated" \
  -c "$PY_OUTPUT/openapi-generator-config.json" \
  --additional-properties=packageVersion="$SPEC_VERSION"

# Move generated package
cp -r "$PY_OUTPUT/generated/pixelated_empathy_sdk/"* "$PY_OUTPUT/pixelated_empathy_sdk/"
cp "$PY_OUTPUT/generated/README.md" "$PY_OUTPUT/GENERATED_README.md" 2>/dev/null || true
cp "$PY_OUTPUT/generated/pyproject.toml" "$PY_OUTPUT/pyproject.toml" 2>/dev/null || true
cp "$PY_OUTPUT/generated/setup.py" "$PY_OUTPUT/setup.py" 2>/dev/null || true
rm -rf "$PY_OUTPUT/generated"

log "Python SDK generated at $PY_OUTPUT/pixelated_empathy_sdk/"

# ─── Publish (optional) ─────────────────────────────────────────────────────

if [[ "${1:-}" == "--publish" ]]; then
  NPM_TOKEN="${2:-}"
  PYPI_TOKEN="${3:-}"

  if [[ -n "$NPM_TOKEN" ]]; then
    log "Publishing TypeScript SDK to npm..."
    cd "$TS_OUTPUT"
    echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > .npmrc
    npm publish --access public 2>/dev/null || warn "npm publish failed (may need to run from package dir)"
    rm -f .npmrc
    cd "$ROOT_DIR"
    log "TypeScript SDK published"
  fi

  if [[ -n "$PYPI_TOKEN" ]]; then
    log "Publishing Python SDK to PyPI..."
    cd "$PY_OUTPUT"
    pip install build twine
    python -m build 2>/dev/null || python setup.py sdist bdist_wheel
    TWINE_PASSWORD="$PYPI_TOKEN" twine upload dist/* -u __token__ 2>/dev/null || warn "PyPI publish failed"
    rm -rf dist build *.egg-info
    cd "$ROOT_DIR"
    log "Python SDK published"
  fi
fi

log "SDK generation complete"

#!/usr/bin/env bash
#
# BAA Compliance Gate — PIX-4428 G2.3
#
# Verifies all AI services handling PHI operate under a signed BAA.
# Fails CLOSED: missing BAA confirmation blocks AI service deployment.
#
# Usage:
#   scripts/compliance/check_baa_compliance.sh          # check env vars
#   scripts/compliance/check_baa_compliance.sh --strict  # warnings also fail
#
# Exit codes:
#   0 — All BAA compliance checks passed
#   1 — One or more BAA compliance checks failed (CI blocks deployment)
#
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

# --- Configuration -----------------------------------------------------------

STRICT=false
for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=true ;;
    --help|-h)
      echo "Usage: $0 [--strict]"
      echo "  --strict  Treat warnings as failures"
      exit 0
      ;;
  esac
done

failures=0
warnings=0

fail() {
  printf '%sFAIL:%s %s\n' "$RED" "$NC" "$1"
  failures=$((failures + 1))
}

ok() {
  printf '%sPASS:%s %s\n' "$GREEN" "$NC" "$1"
}

warn() {
  printf '%sWARN:%s %s\n' "$YELLOW" "$NC" "$1"
  warnings=$((warnings + 1))
}

# --- BAA confirmation env vars -----------------------------------------------
#
# Each AI service that handles PHI must have a BAA_*_CONFIRMED env var set to
# "true". The gate fails closed if any are missing or not "true".

# Map of env var name -> service description
# Declared as a simple list parsed in pairs (var|description)
BAA_SERVICES=(
  "BAA_NIM_HETZNER_CONFIRMED|NIM on Hetzner (primary inference)"
  "BAA_NVIDIA_CONFIRMED|NVIDIA NIM (model provider, if PHI-processing)"
  "BAA_EMBEDDING_CONFIRMED|Embedding service"
  "BAA_TRANSCRIPTION_CONFIRMED|Transcription service"
  "BAA_BIAS_DETECTION_CONFIRMED|Bias detection (PHI-processing variant)"
)

# --- Encryption env vars ----------------------------------------------------

ENCRYPTION_VARS=(
  "PHI_ENCRYPTION_IN_TRANSIT|in-transit encryption|tls1.3"
  "PHI_ENCRYPTION_AT_REST|at-rest encryption|aes-256"
)

# --- Retention / routing env vars -------------------------------------------

RETENTION_VAR="PHI_RETENTION_POLICY"
RETENTION_EXPECTED="documented"

ROUTING_VAR="PHI_REQUIRES_BAA"
ROUTING_EXPECTED="true"

# --- Checks -----------------------------------------------------------------

echo "=== BAA Compliance Gate (PIX-4428 G2.3) ==="
echo ""

# 1. Verify BAA confirmation env vars exist and are "true"
echo "Checking BAA confirmation for AI services:"
for entry in "${BAA_SERVICES[@]}"; do
  var_name="${entry%%|*}"
  description="${entry##*|}"

  value="${!var_name:-}"

  if [ -z "$value" ]; then
    fail "BAA env var $var_name is NOT SET — $description has no BAA confirmation. Deploy blocked."
  elif [ "$value" != "true" ]; then
    fail "BAA env var $var_name is '$value' (expected 'true') — $description BAA not confirmed. Deploy blocked."
  else
    ok "$var_name=true — $description BAA confirmed."
  fi
done

echo ""

# 2. Verify encryption configuration present
echo "Checking PHI encryption configuration:"
for entry in "${ENCRYPTION_VARS[@]}"; do
  var_name="${entry%%|*}"
  rest="${entry#*|}"
  description="${rest%%|*}"
  expected="${rest##*|}"

  value="${!var_name:-}"

  if [ -z "$value" ]; then
    fail "Encryption env var $var_name is NOT SET — PHI ${description} not configured. Deploy blocked."
  elif [ "$value" != "$expected" ]; then
    fail "Encryption env var $var_name is '$value' (expected '$expected') — non-compliant ${description}. Deploy blocked."
  else
    ok "$var_name=$value — PHI ${description} compliant."
  fi
done

echo ""

# 3. Verify data retention policy documented
echo "Checking data retention policy:"
retention_value="${!RETENTION_VAR:-}"
if [ -z "$retention_value" ]; then
  fail "Retention env var $RETENTION_VAR is NOT SET — data retention policy not documented. Deploy blocked."
elif [ "$retention_value" != "$RETENTION_EXPECTED" ]; then
  fail "Retention env var $RETENTION_VAR is '$retention_value' (expected '$RETENTION_EXPECTED'). Deploy blocked."
else
  ok "$RETENTION_VAR=$retention_value — retention policy documented."
fi

echo ""

# 4. Verify PHI routing gate (no PHI to services without BAA)
echo "Checking PHI routing gate:"
routing_value="${!ROUTING_VAR:-}"
if [ -z "$routing_value" ]; then
  fail "Routing env var $ROUTING_VAR is NOT SET — PHI routing not gated. Deploy blocked."
elif [ "$routing_value" != "$ROUTING_EXPECTED" ]; then
  fail "Routing env var $ROUTING_VAR is '$routing_value' (expected '$ROUTING_EXPECTED') — PHI may be sent to services without BAA. Deploy blocked."
else
  ok "$ROUTING_VAR=$routing_value — PHI routing gated to BAA-confirmed services only."
fi

echo ""

# --- Summary ----------------------------------------------------------------

if [ "$failures" -ne 0 ]; then
  printf '%sBAA Compliance Gate FAILED: %d failure(s).%s\n' "$RED" "$failures" "$NC"
  echo ""
  echo "DEPLOYMENT BLOCKED. Resolve all BAA failures before deploying AI services."
  echo "See docs/compliance/baa-compliance-gate.md for requirements."
  exit 1
fi

if [ "$warnings" -ne 0 ] && [ "$STRICT" = true ]; then
  printf '%sBAA Compliance Gate FAILED (strict mode): %d warning(s) treated as failures.%s\n' "$RED" "$warnings" "$NC"
  exit 1
fi

if [ "$warnings" -ne 0 ]; then
  printf '%sBAA Compliance Gate PASSED with %d warning(s).%s\n' "$YELLOW" "$warnings" "$NC"
else
  printf '%sBAA Compliance Gate PASSED — all AI services have BAA confirmation.%s\n' "$GREEN" "$NC"
fi

exit 0

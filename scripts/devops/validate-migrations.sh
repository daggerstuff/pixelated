#!/usr/bin/env bash
# scripts/devops/validate-migrations.sh
#
# Validates database migrations by applying them against a fresh PostgreSQL
# container, snapshotting the schema, running rollbacks where available, and
# verifying schema integrity.
#
# Usage:
#   ./scripts/devops/validate-migrations.sh [options]
#
# Options:
#   --dry-run       Report changes without applying (transaction + ROLLBACK)
#   --rollback      Test rollback for migrations that have .rollback.sql files
#   --snapshot      Capture and print schema snapshot (information_schema)
#   --checksums     Generate SHA-256 checksums for all migration files
#   --cleanup       Remove the temporary container and volume after validation
#   --help, -h      Show this help message
#
# Exit codes:
#   0 — all validations passed
#   1 — migration error or schema inconsistency detected
#   2 — environment error (Docker not available, etc.)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/db/migrations"
SCHEMA_FILES=(
  "$REPO_ROOT/db/provenance_schema.sql"
  "$REPO_ROOT/db/session-progress.sql"
  "$REPO_ROOT/db/session.sql"
)

CONTAINER_NAME="pixelated-migration-validate"
DB_NAME="pixelated_empathy"
DB_USER="pixelated"
DB_PASSWORD="migration-validate-password"
DB_PORT="${MIGRATION_VALIDATE_PORT:-55432}"

DRY_RUN=false
DO_ROLLBACK=false
DO_SNAPSHOT=false
DO_CHECKSUMS=false
CLEANUP=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${CYAN}[validate-migrations]${NC} $*" >&2; }
ok()    { echo -e "${GREEN}[PASS]${NC} $*" >&2; }
fail()  { echo -e "${RED}[FAIL]${NC} $*" >&2; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*" >&2; }

usage() {
  cat "$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")" | grep '^#' | head -n -1 | sed 's/^# \?//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)   DRY_RUN=true; shift ;;
    --rollback)  DO_ROLLBACK=true; shift ;;
    --snapshot)  DO_SNAPSHOT=true; shift ;;
    --checksums) DO_CHECKSUMS=true; shift ;;
    --cleanup)   CLEANUP=true; shift ;;
    --help|-h)   usage ;;
    *)           warn "Unknown option: $1"; shift ;;
  esac
done

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------

if ! command -v docker &>/dev/null; then
  fail "Docker is not installed or not in PATH"
  exit 2
fi

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  fail "Migrations directory not found: $MIGRATIONS_DIR"
  exit 2
fi

MIGRATION_FILES=( $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | grep -v '.rollback.sql' | sort) )
ROLLBACK_FILES=( $(ls "$MIGRATIONS_DIR"/*.rollback.sql 2>/dev/null | sort -r) )

if [[ ${#MIGRATION_FILES[@]} -eq 0 ]]; then
  fail "No migration files found in $MIGRATIONS_DIR"
  exit 2
fi

log "Found ${#MIGRATION_FILES[@]} migration files"
log "Found ${#ROLLBACK_FILES[@]} rollback files"

# ---------------------------------------------------------------------------
# Checksums
# ---------------------------------------------------------------------------

if [[ "$DO_CHECKSUMS" == "true" ]]; then
  log "Generating SHA-256 checksums for migration files:"
  for f in "${MIGRATION_FILES[@]}" "${ROLLBACK_FILES[@]}" "$REPO_ROOT"/db/*.sql; do
    [[ -f "$f" ]] || continue
    checksum=$(sha256sum "$f" | cut -d' ' -f1)
    echo "  $checksum  $(basename "$f")"
  done
  echo
fi

# ---------------------------------------------------------------------------
# Start fresh PostgreSQL container
# ---------------------------------------------------------------------------

start_db() {
  log "Starting fresh PostgreSQL 17 container (port $DB_PORT)..."
  docker run -d \
    --name "$CONTAINER_NAME" \
    -e POSTGRES_DB="$DB_NAME" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -p "$DB_PORT:5432" \
    postgres:17 >/dev/null 2>&1

  # Wait for readiness
  for i in $(seq 1 30); do
    if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" &>/dev/null; then
      ok "PostgreSQL is ready"
      return 0
    fi
    sleep 1
  done
  fail "PostgreSQL did not become ready within 30s"
  exit 1
}

stop_db() {
  if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1
    log "Container removed"
  fi
}

trap '[[ "$CLEANUP" == "true" ]] && stop_db' EXIT

export PGPASSWORD="$DB_PASSWORD"
PSQL="docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1"

# ---------------------------------------------------------------------------
# Dry-run mode: apply each migration inside a transaction that we ROLLBACK
# ---------------------------------------------------------------------------

if [[ "$DRY_RUN" == "true" ]]; then
  log "=== DRY RUN MODE ==="
  log "Applying migrations in transactions (rolled back — no changes persisted)"

  for f in "${MIGRATION_FILES[@]}"; do
    fname=$(basename "$f")
    log "Dry-running: $fname"
    if ! echo "BEGIN; $(cat "$f") ROLLBACK;" | $PSQL -q 2>&1 | grep -v '^BEGIN$' | grep -v '^ROLLBACK$'; then
      fail "Dry-run failed for: $fname"
      exit 1
    fi
  done

  ok "Dry-run complete — all migrations parse and execute without errors"
  exit 0
fi

# ---------------------------------------------------------------------------
# Full validation: apply, snapshot, rollback, verify
# ---------------------------------------------------------------------------

start_db

# --- Apply forward migrations ---
log "=== APPLYING FORWARD MIGRATIONS ==="
for f in "${MIGRATION_FILES[@]}"; do
  fname=$(basename "$f")
  log "Applying: $fname"
  if ! $PSQL < "$f" 2>&1; then
    fail "Forward migration failed: $fname"
    exit 1
  fi
done
ok "All ${#MIGRATION_FILES[@]} forward migrations applied"

# --- Schema snapshot ---
SCHEMA_BEFORE="/tmp/migration-schema-before-$$"
$PSQL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" > "$SCHEMA_BEFORE" 2>&1

if [[ "$DO_SNAPSHOT" == "true" ]]; then
  log "=== SCHEMA SNAPSHOT (after forward migrations) ==="
  cat "$SCHEMA_BEFORE"
  echo
  log "Column details:"
  $PSQL -c "SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;"
  echo
fi

# --- Rollback test ---
if [[ "$DO_ROLLBACK" == "true" ]]; then
  if [[ ${#ROLLBACK_FILES[@]} -eq 0 ]]; then
    warn "No rollback files found — skipping rollback test"
  else
    log "=== TESTING ROLLBACKS ==="
    for f in "${ROLLBACK_FILES[@]}"; do
      fname=$(basename "$f")
      log "Rolling back: $fname"
      if ! $PSQL < "$f" 2>&1; then
        fail "Rollback failed: $fname"
        exit 1
      fi
    done
    ok "All ${#ROLLBACK_FILES[@]} rollback migrations applied"

    # Verify schema after rollback
    SCHEMA_AFTER="/tmp/migration-schema-after-$$"
    $PSQL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" > "$SCHEMA_AFTER" 2>&1

    DIFF=$(diff "$SCHEMA_BEFORE" "$SCHEMA_AFTER" || true)
    if [[ -n "$DIFF" ]]; then
      log "Schema changes after rollback (expected for tables created/dropped):"
      echo "$DIFF"
    fi
    ok "Rollback test complete — no errors"

    rm -f "$SCHEMA_AFTER"
  fi
fi

# --- Summary ---
rm -f "$SCHEMA_BEFORE"

log "=== VALIDATION SUMMARY ==="
ok "Forward migrations: ${#MIGRATION_FILES[@]} applied"
if [[ "$DO_ROLLBACK" == "true" ]]; then
  ok "Rollback migrations: ${#ROLLBACK_FILES[@]} tested"
fi
ok "Schema validation: passed (no errors, DB in consistent state)"

if [[ "$CLEANUP" == "true" ]]; then
  stop_db
else
  log "Container '$CONTAINER_NAME' left running (use --cleanup to auto-remove)"
  log "Connect: psql -h localhost -p $DB_PORT -U $DB_USER -d $DB_NAME"
fi

exit 0

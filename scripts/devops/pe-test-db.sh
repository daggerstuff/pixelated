#!/usr/bin/env bash
# One-command pe test database: start the throwaway postgres container
# (loopback-only, trust auth) and apply the pe schema via an ephemeral
# alembic run. Idempotent: an already-running, already-migrated container
# is a no-op. See CONTRIBUTING.md "pe test database" for the manual steps
# this wraps.

set -euo pipefail

CONTAINER=pixelated-pe-test-db
PORT=5434
DB_URL="postgresql+asyncpg://pe_test@127.0.0.1:${PORT}/pixelated_empathy"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_DIR="${ROOT_DIR}/apps/web"

if docker ps --format '{{.Names}}' | grep -qx "${CONTAINER}"; then
  echo "✓ ${CONTAINER} already running"
else
  if docker ps -a --format '{{.Names}}' | grep -qx "${CONTAINER}"; then
    echo "→ Starting existing ${CONTAINER} container"
    docker start "${CONTAINER}" >/dev/null
  else
    echo "→ Creating ${CONTAINER} (postgres:17, loopback :${PORT}, trust auth)"
    docker run -d --name "${CONTAINER}" \
      -e POSTGRES_DB=pixelated_empathy \
      -e POSTGRES_USER=pe_test \
      -e POSTGRES_HOST_AUTH_METHOD=trust \
      -p "127.0.0.1:${PORT}:5432" postgres:17 >/dev/null
  fi
  echo "→ Waiting for postgres to accept connections"
  until docker exec "${CONTAINER}" pg_isready -U pe_test -d pixelated_empathy -q; do
    sleep 0.5
  done
fi

# Ephemeral alembic config (alembic is not a runtime dependency).
ALEMBIC_INI="$(mktemp /tmp/pe-alembic-XXXXXX.ini)"
trap 'rm -f "${ALEMBIC_INI}"' EXIT
cat > "${ALEMBIC_INI}" <<'EOF'
[alembic]
script_location = src/pe/migrations

[loggers]
keys = root
[handlers]
keys = console
[formatters]
keys = generic
[logger_root]
level = WARN
handlers = console
qualname =
[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic
[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
EOF

echo "→ Applying pe schema (alembic upgrade head)"
cd "${APP_DIR}"
PYTHONPATH='.:..' PE_DATABASE_URL="${DB_URL}" PE_TESTING=1 \
  uv run --with alembic --with psycopg2-binary \
  python -m alembic -c "${ALEMBIC_INI}" upgrade head

cat <<DONE

✓ pe test database ready

  Container: ${CONTAINER} (postgres:17 on 127.0.0.1:${PORT}, trust auth)
  Run the suite from apps/web/:

    PYTHONPATH=.:.. \\
    PE_DATABASE_URL="${DB_URL}" \\
    PE_TESTING=1 uv run pytest src/pe/tests/ -q

  Or: make pe-test-db-down to stop it.
DONE

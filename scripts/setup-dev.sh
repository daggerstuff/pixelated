#!/usr/bin/env bash
set -euo pipefail

# setup-dev.sh — Initialize Pixelated Empathy development environment
# Usage: ./scripts/setup-dev.sh

echo "╭─────────────────────────────────────────────╮"
echo "│  Pixelated Empathy — Dev Environment Setup  │"
echo "╰─────────────────────────────────────────────╯"
echo ""

# ── 1. Verify prerequisites ─────────────────────────────────────────────────

echo "▸ Checking prerequisites..."

check_command() {
  local cmd="$1"
  local label="$2"
  if command -v "$cmd" &>/dev/null; then
    echo "  ✓ $label: $(command -v "$cmd")"
  else
    echo "  ✗ $label: NOT FOUND"
    return 1
  fi
}

MISSING=0

check_command node "Node.js" || MISSING=1
check_command pnpm "pnpm" || MISSING=1
check_command python3 "Python" || MISSING=1
check_command uv "uv" || MISSING=1
check_command git "Git" || MISSING=1

if [ "$MISSING" -eq 1 ]; then
  echo ""
  echo "❌ Prerequisites missing. Install them before continuing."
  echo "   Node.js >= 24: https://nodejs.org"
  echo "   pnpm 11.24.0:  npm install -g pnpm@11.24.0"
  echo "   Python 3.12+:  https://python.org"
  echo "   uv:            curl -LsSf https://astral.sh/uv/install.sh | sh"
  exit 1
fi

echo ""

# ── 2. Sync git submodules ──────────────────────────────────────────────────

echo "▸ Syncing git submodules (ai/, foresight/, docs/)..."
git submodule update --init --recursive
echo "  ✓ Submodules synced"
echo ""

# ── 3. Install Node.js dependencies ──────────────────────────────────────────

echo "▸ Installing Node.js dependencies..."
pnpm install
echo "  ✓ Node.js dependencies installed"
echo ""

# ── 4. Install Python dependencies ───────────────────────────────────────────

if [ -f "ai/pyproject.toml" ]; then
  echo "▸ Installing Python dependencies (ai/)..."
  (cd ai && uv sync)
  echo "  ✓ ai/ dependencies installed"
  echo ""
fi

if [ -f "foresight/pyproject.toml" ]; then
  echo "▸ Installing Python dependencies (foresight/)..."
  (cd foresight && uv sync)
  echo "  ✓ foresight/ dependencies installed"
  echo ""
fi

# ── 5. Start local services (Docker) ─────────────────────────────────────────

if command -v docker &>/dev/null; then
  echo "▸ Checking Docker services..."

  # PostgreSQL
  if ! docker ps --format '{{.Names}}' | grep -q "pixelated-postgres" 2>/dev/null; then
    if [ -f "docker-compose.yml" ] || [ -f "infra/docker-compose.yml" ]; then
      echo "  Starting PostgreSQL and Redis via Docker Compose..."
      if [ -f "docker-compose.yml" ]; then
        docker compose up -d postgres redis 2>/dev/null || true
      fi
      if [ -f "infra/docker-compose.yml" ]; then
        docker compose -f infra/docker-compose.yml up -d postgres redis 2>/dev/null || true
      fi
      echo "  ✓ Docker services started"
    else
      echo "  ⚠ No docker-compose.yml found. Start PostgreSQL and Redis manually."
    fi
  else
    echo "  ✓ PostgreSQL container already running"
  fi
  echo ""
else
  echo "⚠ Docker not found. Ensure PostgreSQL (17+) and Redis (7+) are running."
  echo ""
fi

# ── 6. Run database migrations ───────────────────────────────────────────────

if [ -f ".env" ] || [ -n "${DATABASE_URL:-}" ]; then
  echo "▸ Running database migrations..."
  if pnpm run db:migrate &>/dev/null; then
    echo "  ✓ Migrations complete"
  else
    echo "  ⚠ Migrations skipped (DATABASE_URL not configured or migration script missing)"
    echo "    Set DATABASE_URL in .env and run: pnpm db:migrate"
  fi
  echo ""
else
  echo "▸ No .env file found. Copy .env.example to .env and configure:"
  echo "    cp .env.example .env"
  echo ""
fi

# ── 7. Verify ────────────────────────────────────────────────────────────────

echo "╭─────────────────────────────────────────────╮"
echo "│  Setup complete!                             │"
echo "╰─────────────────────────────────────────────╯"
echo ""
echo "Next steps:"
echo "  1. cp .env.example .env  (if not done)"
echo "  2. pnpm dev              (starts app on http://localhost:5173)"
echo "  3. pnpm dev:all-services (full stack with AI services)"
echo ""
echo "See WALKTHROUGH.md for the full developer guide."

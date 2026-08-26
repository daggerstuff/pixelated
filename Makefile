# Pixelated Empathy — Developer Makefile
# Usage: make <target>

.PHONY: help dev test lint format typecheck check-all clean docker-up docker-down docker-logs setup e2e e2e-ui python-test python-lint backend-up backend-down backend-logs backend-reset backend-ps backend-health backend-build

.DEFAULT_GOAL := help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ── Development ─────────────────────────────────────────

dev: ## Start frontend only
	pnpm dev

dev-all: ## Start all services (frontend + AI + workers)
	pnpm dev:all-services

# ── Testing ─────────────────────────────────────────────

test: ## Run all tests
	pnpm test

test-unit: ## Run unit tests
	pnpm test:unit

test-integration: ## Run integration tests
	pnpm test:integration

e2e: ## Run E2E tests
	pnpm e2e

e2e-ui: ## Run E2E tests with UI
	pnpm e2e:ui

python-test: ## Run Python tests via uv
	uv run pytest

# ── Quality ─────────────────────────────────────────────

lint: ## Run linter (oxlint)
	pnpm lint

python-lint: ## Lint Python code via ruff
	uv run ruff check .

format: ## Format all code
	pnpm format

format-check: ## Check formatting
	pnpm format:check

typecheck: ## Run TypeScript type check
	pnpm typecheck

check-all: ## Run all checks (typecheck + lint + format)
	pnpm check:all

# ── Docker ──────────────────────────────────────────────

docker-up: ## Start database containers
	docker compose -f infra/docker/docker-compose.db.yml up -d

docker-down: ## Stop database containers
	docker compose -f infra/docker/docker-compose.db.yml down

docker-logs: ## Tail database container logs
	docker compose -f infra/docker/docker-compose.db.yml logs -f

# ── Unified Backend Stack ─────────────────────────────────

# Sources .env.backend into the shell so compose interpolation sees
# POSTGRES_PASSWORD / REDIS_PASSWORD / etc., then runs compose.
BACKEND_COMPOSE := set -a; . ./.env.backend; set +a; docker compose -f infra/docker/docker-compose.backend.yml

backend-up: ## Start the full backend stack (databases + APIs + services + monitoring)
	$(BACKEND_COMPOSE) up -d

backend-down: ## Stop the full backend stack
	$(BACKEND_COMPOSE) down

backend-logs: ## Tail backend stack logs
	$(BACKEND_COMPOSE) logs -f

backend-reset: ## Stop and reset the backend stack (removes volumes)
	$(BACKEND_COMPOSE) down -v
	$(BACKEND_COMPOSE) up -d

backend-ps: ## Show backend stack container status
	$(BACKEND_COMPOSE) ps

backend-build: ## Build (or rebuild) all backend service images
	$(BACKEND_COMPOSE) build

backend-health: ## Check all backend services health
	./scripts/devops/backend-health-check.sh

# ── Setup ───────────────────────────────────────────────

setup: ## One-command local setup
	./scripts/setup-dev.sh

install: ## Install all dependencies
	chmod +x scripts/devops/pnpm-install-with-fallback.sh
	scripts/devops/pnpm-install-with-fallback.sh && uv sync

# ── Cleanup ─────────────────────────────────────────────

clean: ## Remove build artifacts and caches
	rm -rf dist/ node_modules/.vite/ .tsbuildinfo coverage/ playwright-report/
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true

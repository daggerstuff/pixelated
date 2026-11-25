# Pixelated Empathy — Developer Makefile
# Usage: make <target>

.PHONY: help dev test lint format typecheck check-all clean docker-up docker-down docker-logs setup e2e e2e-ui python-test regression-suite python-lint python-typecheck quality backend-up backend-down backend-logs backend-reset backend-ps backend-health backend-build pe-test-db pe-test-db-down lockfile-resolve agents-status agents-sync modal-status modal-check modal-deploy modal-embed modal-targets modal-dataset modal-train modal-test

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

regression-suite: ## Run local skill/routing/config regression suite
	bash scripts/regression-suite.sh

# ── Quality ─────────────────────────────────────────────

lint: ## Run linter (oxlint)
	pnpm lint

python-lint: ## Lint Python code via ruff
	uv run ruff check .

python-typecheck: ## Strict type check the Python pe service (mypy)
	bash scripts/ci/python-typecheck.sh

quality: ## Run all code-quality audits (boundaries, duplication, complexity, file size, tech debt, naming)
	pnpm lint:quality

format: ## Format all code
	pnpm format

format-check: ## Check formatting
	pnpm format:check

typecheck: ## Run oxlint type-aware lint (see AGENTS.md — no tsc/astro check)
	pnpm lint

check-all: ## Run lint gates (formerly check:all; typecheck scripts removed)
	pnpm lint

# ── Docker ──────────────────────────────────────────────

pe-test-db: ## Start (or reuse) the throwaway pe test database and apply the schema
	./scripts/devops/pe-test-db.sh

pe-test-db-down: ## Stop the pe test database container
	docker stop pixelated-pe-test-db

lockfile-resolve: ## Resolve a conflicted pnpm-lock.yaml merge by regenerating it
	./scripts/devops/resolve-lockfile-conflict.sh --add

agents-status: ## Report what dotagents manages vs what Command Code sees
	./scripts/devops/cc-agents-sync.sh status

agents-sync: ## Bridge .agents/mcp.json into Command Code's user MCP config
	./scripts/devops/cc-agents-sync.sh sync

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

# ── Modal (serverless GPU compute) ───────────────────────

modal-status: ## Report Modal configuration and auth state
	./scripts/devops/modal.sh status

modal-check: ## Run the Modal smoke app on a real container
	./scripts/devops/modal.sh check

modal-deploy: ## Deploy the repo's Modal apps
	./scripts/devops/modal.sh deploy

modal-embed: ## Embed texts on a Modal GPU (ARGS='--texts "a|b"')
	./scripts/devops/modal.sh embed $(ARGS)

modal-targets: ## List the Modal workload targets (training, testing, dataset)
	./scripts/devops/modal.sh targets

modal-dataset: ## Build a Modal dataset (ARGS='--inputs dataset/final_dataset.jsonl')
	./scripts/devops/modal.sh dataset $(ARGS)

modal-train: ## Fine-tune on a Modal GPU (ARGS='--dataset /datasets/out/train.jsonl')
	./scripts/devops/modal.sh train $(ARGS)

modal-test: ## Run the offline suite in a clean Modal container (ARGS='--paths tests/infra')
	./scripts/devops/modal.sh test $(ARGS)

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

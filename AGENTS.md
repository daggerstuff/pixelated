# AGENTS.md

## Project: Pixelated Empathy

> **We don't just process conversations. We understand them.**

## OVERVIEW

Pixelated Empathy is a full-stack mental health AI platform with a monorepo structure separating frontend (Astro+React), backend services (Python FastAPI), and AI/ML pipelines (PyTorch). The codebase enforces strict security, privacy, and therapeutic safety standards.

**Tech Stack**: TypeScript, Astro 5.x, React 19.x, Python 3.11+, PyTorch, PostgreSQL, Redis

## STRUCTURE

````
pixelated/
├── src/                    # Frontend Astro/React app
│   ├── components/        # Domain-organized React components
│   │   ├── admin/        # Admin dashboard
│   │   ├── ai/           # AI chat & interaction
│   │   ├── auth/         # Authentication
│   │   ├── dashboard/    # User dashboards
│   │   ├── journal-research/
│   │   ├── mizu/         # Visualizations
│   │   ├── monitoring/   # Monitoring widgets
│   │   ├── pipeline/     # Pipeline status
│   │   ├── professional/ # Clinical tools
│   │   ├── session/      # Session management
│   │   ├── widgets/      # Shared widgets
│   │   └── ui/           # shadcn/ui components (81 files)
│   ├── pages/            # Astro file-based routing + API endpoints
│   ├── lib/              # Shared utilities
│   │   ├── ai/           # AI service integrations
│   │   ├── analytics/    # Analytics backend
│   │   ├── auth/         # Authentication logic
│   │   ├── bias-detection/  # Python microservice
│   │   ├── db/           # Database access
│   │   ├── fhe/          # Fully homomorphic encryption
│   │   ├── jobs/         # Background workers
│   │   ├── security/     # Security utilities
│   │   └── utils/        # General utilities
│   └── hooks/            # Custom React hooks
├── ai/                   # Python AI/ML services (standalone git submodule)
│   ├── pipelines/       # Dataset & training pipelines
│   │   ├── orchestrator/    # Main pipeline orchestrator (115 subdirs)
│   │   ├── voice/           # Voice processing pipeline
│   │   └── edge_case/       # Edge case handling
│   ├── models/          # Model definitions
│   ├── inference/       # Model inference services
│   ├── monitoring/      # Quality & performance monitoring (106 files)
│   ├── safety/          # Safety validation
│   ├── security/        # Security testing
│   ├── dataset_pipeline/ # Data processing modules
│   ├── training/        # Training scripts (ready_packages/, configs/, scripts/)
│   └── api/             # FastAPI services
├── scripts/             # Build, deployment, utilities (78 files)
│   ├── data/            # Data processing scripts
│   ├── devops/          # Dev environment & CI
│   ├── migration/       # Data migration tools
│   └── backup/          # Backup automation
├── docker/              # Service-specific Docker configs
│   ├── alert-receiver/
│   ├── caddy/
│   ├── celery/
│   ├── elasticsearch/
│   ├── kibana/
│   ├── logstash/
│   ├── nginx/
│   ├── postgres/
│   ├── prometheus/
│   ├── redis/
│   └── training-service/
├── docs/                # Mintlify documentation
│   ├── api-reference/
│   ├── architecture/
│   ├── guides/
│   │   ├── developers/
│   │   │   ├── nemo/
│   │   │   ├── sentinel/
│   │   │   └── supermirage-integration/
│   │   ├── supervisors/
│   │   └── therapists/
│   ├── knowledge/
│   ├── product/
│   ├── research/
│   └── sessions/
├── tests/               # E2E & integration tests
│   ├── browser/         # Playwright tests
│   ├── e2e/             # End-to-end suites
│   ├── integration/     # Integration tests
│   ├── performance/     # Load & performance tests
│   └── security/        # Security test suites
├── business-strategy-cms/ # Independent CMS package (Node.js)
├── Astro/               # Static site builder
├── dist/                # Build artifacts (auto-generated)
├── .cursor/             # Cursor IDE memory
│   ├── memory/          # Long-term + short-term memory store
│   │   ├── long_term/
│   │   └── short_term/
│   └── rules/           # Custom instructions
├── .github/             # GitHub workflows & templates
│   ├── actions/
│   ├── codeql/
│   ├── instructions/    # Agent guidelines (tech, security, structure)
│   ├── prompts/
│   └── workflows/
├── .agent/              # Custom agent skills
├── config/              # Runtime configuration
│   ├── environments/
│   └── feature-flags/
├── docker-compose.yml   # Dev environment orchestration
├── pyproject.toml       # Main Python dependencies
├── package.json         # Root Node.js scripts + workspaces
└── astro.config.mjs      # Astro configuration

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Frontend components | `src/components/` | Domain-organized (admin/, ai/, chat/, dashboard/) |
| API endpoints | `src/pages/api/` | File-based routing |
| Shared utilities | `src/lib/` | By domain (ai/, auth/, security/, utils/) |
| AI pipelines | `ai/pipelines/orchestrator/` | Main orchestration + subsystems |
| Training configs | `ai/training/configs/` | Stage configs, hyperparameters |
| Inference services | `ai/inference/` & `ai/api/` | FastAPI services |
| Safety systems | `ai/safety/` & `ai/security/` | Validation, crisis detection |
| Monitoring | `ai/monitoring/` & `src/components/monitoring/` | Metrics & dashboards |
| Docker setups | `docker/<service>/` | Each service has its own compose |
| CI/CD | `.github/workflows/` | Azure Pipelines primary, GitHub Actions secondary |
| Documentation | `docs/` | Mintlify structure, MDX format |
| Tests | `tests/` or `ai/tests/` | Mirrors source structure |

## CODE MAP (Key Symbols)

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `PixelatedEmpathyAPI` | class | `src/lib/ai/services/server.ts` | Main AI service client |
| `BiasDetectionEngine` | class | `src/lib/ai/bias-detection/BiasDetectionEngine.ts` | Real-time bias analysis |
| `DatasetPipelineOrchestrator` | class | `ai/pipelines/orchestrator/main_orchestrator.py` | Pipeline orchestration |
| `CrisisDetectionService` | class | `src/lib/ai/crisis-detection/` | Crisis signal monitoring |
| `EmotionCartography` | module | `src/components/analytics/` | Emotional journey mapping |
| `TherapyChatClient` | component | `src/components/chat/` | Main chat interface |
| `usePixelInference` | hook | `src/hooks/usePixelInference.ts` | AI inference integration |
| `ProductionExporter` | class| `ai/dataset_pipeline/production_exporter.py` | Dataset export pipeline |

## CONVENTIONS

### Frontend (TypeScript + Astro)
- **Strict TypeScript**: All code in `strict` mode. Explicit return types required.
- **Component Naming**: PascalCase (`BiasDetectionEngine.tsx`)
- **Page Naming**: kebab-case (`mental-health-chat.astro`)
- **Utility Naming**: camelCase (`formatTherapeuticData.ts`)
- **State Management**: Zustand for global, Jotai for atomic state
- **Styling**: TailwindCSS 4.x + UnoCSS, shadcn/ui components
- **Testing**: Vitest (unit), Playwright (E2E). Files: `*.test.ts`, `*.spec.ts`
- **Imports**: Use path aliases: `~/components/`, `@/lib/`

### Backend/AI (Python)
- **Python Version**: 3.11+ with `uv` package manager (never pip/conda)
- **Type Safety**: Type hints required, Pydantic models for config
- **Formatting**: Ruff + Black (enforced)
- **Testing**: Pytest with coverage. Files: `test_*.py`, `*_test.py`
- **Entry Points**: `main.py`, `server.py`, or `app.py` at module root
- **No Stubs**: No `pass`, `TODO`, `NotImplementedError` — implementations must be complete
- **No Suppression**: No `# noqa`, `# type: ignore` — fix root cause

### Security & Compliance
- **HIPAA++**: All data handling exceeds HIPAA requirements
- **FHE**: Fully homomorphic encryption with <50ms latency
- **Bias Detection**: Real-time monitoring in all AI interactions
- **Audit Trails**: Log all therapeutic interactions (PII-redacted)
- **Crisis Handling**: Safety filters active; never ignore self-harm signals

### Performance Standards
- **AI Response**: <50ms for conversational interactions
- **Memory**: Python services <512MB baseline, <2GB peak
- **Bundle**: Frontend chunks <100KB compressed
- **Database**: Query latency <10ms for user-facing ops

## ANTI-PATTERNS (THIS PROJECT)

- ❌ **Never** use `pip`, `conda`, or `poetry` — use `uv` exclusively
- ❌ **Never** commit `.env` files or real secrets
- ❌ **Never** modify shared config files (`.github/codeql/*`, `package.json`, `pnpm-lock.yaml`) unless PR is specifically about that config
- ❌ **Never** mix multiple features in one PR — one feature = one PR
- ❌ **Never** ignore warnings — fix root causes, don't suppress
- ❌ **Never** exceed 30 files per PR — split large changes
- ❌ **Never** introduce stubs or placeholder implementations
- ❌ **Never** leave out error handling — comprehensive boundaries required
- ❌ **Never** disable type checking or tests

## UNIQUE STYLES

- **Monorepo with AI submodule**: `ai/` is a standalone git repo embedded in `pixelated/`. Changes to AI code follow separate commit flows but are deployed together.
- **Path aliases**: `~/` → `src/`, `@/` → `src/lib/` in TypeScript; Python uses package imports (`ai.pipelines.*`)
- **Microservice boundaries**: AI services run as separate Python processes (bias-detection, inference, academic-sourcing) but are managed via root `docker-compose.yml`
- **Cursor Memory Bank**: Heavy use of `.cursor/memory/` for context persistence across sessions — maintain short-term + long-term updates
- **PR hygiene**: Strict 30-file limit, >5 open PRs → wait, descriptive branch names (`feature/`, `fix/`, `perf/`)
- **Security-first**: FHE encryption, bias detection, crisis monitoring baked into all AI interactions

## COMMANDS

```bash
# Development
pnpm dev                    # Start frontend (Astro + React)
pnpm dev:all-services      # Start all backend services concurrently
uv run uvicorn ai.main:app --reload  # AI API (from ai/ dir)

# Code quality
pnpm typecheck             # TypeScript validation
uv run ruff check .        # Python linting (from ai/ dir)
uv run black .             # Python formatting
pytest --cov               # Python tests with coverage

# Build & deploy
pnpm build                # Build frontend for production
docker-compose up -d      # Start all services (Postgres, Redis, etc.)

# PR workflow
gh pr list --repo daggerstuff/pixelated --state open  # Check open PRs before creating
````

## NOTES

- **Cursor Memory**: Always check `supermemory` (project: `pixelated`) at session start for context. Update `.ralph/progress.txt` at session end.
- **Base Branch**: All PRs target `staging` (NOT master).
- **Package Manager**: pnpm for Node, uv for Python. Do not mix.
- **Security Scanning**: Run `pnpm security:scan` and `./scripts/bias-detection-test.sh` before committing sensitive changes.
- **AI Service Ports**:
  - Bias Detection: `localhost:8001`
  - AI Inference: `localhost:8002`
  - Academic Sourcing: `localhost:8000`
- **Database**: PostgreSQL (primary), MongoDB (documents), Redis (cache). Connection strings in `.env`.
- **Monitoring**: Prometheus + Grafana at `http://localhost:9090` / `http://localhost:3000`.
- **Hot take**: The AI submodule (`ai/`) has its own `AGENTS.md` — consult it for Python-specific rules.

---

_Generated: 2025-03-15 | Based on commit: (auto-detect from git)_

### RULE 1: MAXIMUM 30 FILES PER PR

- **Hard limit: 30 files maximum**
- **Ideal size: 5-15 files**
- If your change touches more than 30 files, SPLIT IT into multiple focused PRs
- **Why**: We had 60 PRs all blocked because they touched the same files

### RULE 2: DO NOT TOUCH SHARED CONFIG FILES

**NEVER modify these unless the PR is SPECIFICALLY about configuring them:**

- `.github/codeql/codeql-config.yml`
- `.github/codeql/custom-queries/qlpack.yml`
- `.github/workflows/codeql.yml`
- `.oxlintrc.json`
- `.oxfmtrc.jsonc`
- `config/vitest.config.ts`
- `package.json`
- `pnpm-lock.yaml`

**Why**: Every PR touching these files conflicts with every other PR. This created 60 blocked PRs.

### RULE 3: ONE FEATURE = ONE PR

- Each PR should implement ONE specific feature or fix
- Good examples:
  - "Optimize ChatMessage component rendering"
  - "Fix NotificationCenter keyboard accessibility"
  - "Add unit tests for bias detection"
- Bad examples (DO NOT DO):
  - "Fix everything" (300 files across 10 features)
  - "Update configs and fix UI and add tests" (mixed concerns)

### RULE 4: CHECK BEFORE CREATING

Before creating ANY PR:

1. Run: `gh pr list --repo daggerstuff/pixelated --state open`
2. If there are >5 open PRs, WAIT before creating more
3. Check if your files overlap with existing open PRs
4. If overlap exists, WAIT for those PRs to merge first

### RULE 5: DESCRIPTIVE BRANCH NAMES

Use clear branch names:

- ✅ `feature/notification-center-accessibility`
- ✅ `fix/chat-message-memoization`
- ✅ `perf/performance-optimizer-lru`
- ❌ `fix/things`
- ❌ `update/stuff`
- ❌ `chore/random`

## CONSEQUENCES

If you ignore these rules:

- **Merge conflicts**: Your PR will conflict with everything
- **Blocked PRs**: 60 PRs were created that all blocked each other
- **Lost work**: We had to abandon 59 PRs completely
- **Wasted time**: Review comments were fixed but PRs couldn't merge

## VERIFICATION CHECKLIST

Before submitting a PR, verify:

- [ ] PR touches ≤30 files
- [ ] PR does NOT modify shared config files (unless that's the feature)
- [ ] PR focuses on ONE feature/fix
- [ ] No overlapping files with existing open PRs
- [ ] Branch name is descriptive

## PROJECT CONTEXT

**Base Branch**: `staging` (NOT master)
**Tech Stack**: TypeScript, Astro, React, Node.js
**PR Target**: All PRs must target `staging` branch

## MEMORY-NATIVE WORKFLOW (Cursor Memory Bank)

The repository ships with a modern, cursor-native memory stack under `.cursor/memory` and `.cursor/rules`.

### Required project-local alignment

- Before major context-heavy work, align to `.cursor/rules/007_cursor_memory_custom_instructions.mdc`.
- Keep memory updates in sync with:
  - `.cursor/memory/short_term/current_context.md`
  - `.cursor/memory/short_term/working_decisions.md`
  - `.cursor/memory/short_term/session_notes.md`
  - `.cursor/memory/long_term/project_brief.md`
  - `.cursor/memory/long_term/architecture.md`
  - `.cursor/memory/long_term/patterns.md`
  - `.cursor/memory/long_term/decisions.md`
  - `.cursor/memory/long_term/progress.md`
- Human-readable onboarding is in `.cursor/docs/cursor-memory-bank-modern-instructions.md`.
- If working with custom instruction behavior, prefer this precedence:
  - `GEMINI.md` and root policy
  - `.cursor/rules/007_cursor_memory_custom_instructions.mdc`
  - other `.mdc` files in `.cursor/rules`

### Quick agent activation checklist

1. `/mode resume`
2. `/memory bootstrap`
3. `/memory check`
4. `/context status`
5. If `status=failed`, `/memory normalize`
6. `/memory event session_start "Continuing with saved checkpoint"`
7. `/memory state` and verify `continuity_state=updated`
8. `/mode <MODE>` (or confirm intended mode)
9. Capture 3 items in short-term memory before implementation:
   - target outcome
   - risk level
   - first checkpoint

### Daily continuity playbook

- On mode transitions, prefer:
  - `/memory bootstrap`
  - `/memory event session_start` (beginning), `/memory event session_end` (handoff)
- For resumed work, always use the exact continue sequence above and continue only after
  `/memory event session_start "Continuing with saved checkpoint"`.
- Before large continuation blocks, run `/memory check` and `/memory normalize` on failed checks.
- For long implementation stretches, run `/memory normalize` when risk keeps recurring or context becomes stale.

## WHEN IN DOUBT

**Make the PR smaller.**

Split large changes into multiple sequential PRs:

1. First: Config/setup changes (if needed)
2. Second: Core logic changes
3. Third: Tests and documentation

Never combine unrelated changes into one PR.

# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## 🎯 Mission

**Pixelated Empathy** builds empathy-driven technology for mental health professionals and communities. The platform includes:
- **Empathy Gym™**: AI-powered training environment for mental health professionals to practice difficult conversations
- **Emotional Intelligence Engine**: Analyzes conversations with psychological depth
- **Journal Research Pipeline**: Comprehensive system for discovering and integrating therapeutic datasets

This handles sensitive mental health data—prioritize psychological safety, privacy, and ethical AI practices.

## 📦 Package Managers (CRITICAL)

**Node.js**: `pnpm` ONLY (never npm/yarn)
**Python**: `uv` ONLY (never pip/conda/venv)

```bash
# Installation
pnpm install
uv install

# Development
pnpm dev                    # Start Astro dev server (port 3000)
pnpm dev:all-services      # All services (dev, bias-detection, ai-service, analytics, worker, training)
pnpm dev:bias-detection    # Bias detection service
pnpm dev:ai-service        # AI service
pnpm dev:analytics         # Analytics service
pnpm dev:worker            # Background worker
pnpm dev:training-server   # Training server

# Python services
uv run python src/lib/ai/bias-detection/python-service/bias_detection_service.py
```

## 🧪 Testing

```bash
# Comprehensive testing
pnpm test:all              # Run all test suites
pnpm check:all             # Lint + format + typecheck

# Unit tests
pnpm test:unit             # Vitest with coverage
pnpm test:watch            # Watch mode
pnpm test:coverage         # Coverage report

# Specific test suites
pnpm test:hipaa            # HIPAA compliance tests
pnpm test:crypto           # Cryptography tests
pnpm test:backup           # Backup system tests
pnpm test:security         # Security tests
pnpm test:bias-detection   # Bias detection tests

# Integration tests
pnpm test:integration      # Integration tests

# E2E tests
pnpm e2e                   # Playwright tests
pnpm e2e:smoke             # Smoke tests
pnpm e2e:ui                # UI mode
pnpm e2e:headed            # Headed mode
pnpm e2e:debug             # Debug mode
pnpm e2e:browser           # Browser tests
pnpm e2e:browser-compat    # Browser compatibility
```

## 🔨 Build & Deploy

```bash
# Build
pnpm build                 # Production build
pnpm build:cloudflare      # Cloudflare Pages build
pnpm build:railway         # Railway deployment
pnpm build:heroku          # Heroku deployment
pnpm build:analyze         # Build with bundle analysis

# Preview
pnpm preview              # Preview production build
pnpm start                # Start production server

# Docker
pnpm docker:build         # Build Docker image
pnpm docker:run           # Run container
pnpm docker:up            # Docker Compose up
pnpm docker:down          # Docker Compose down
pnpm docker:reset         # Reset dev environment

# Deployment
pnpm deploy               # Deploy to staging
pnpm deploy:prod          # Deploy to production
pnpm cf:deploy            # Cloudflare Pages deploy
```

## ✅ Code Quality

```bash
# Linting & Formatting
pnpm lint                 # Run oxlint
pnpm lint:fix             # Auto-fix issues
pnpm format               # Format with oxc + prettier
pnpm format:check         # Check formatting

# Type Checking
pnpm typecheck            # Astro check + tsc
pnpm typecheck:strict     # Strict validation
pnpm check                # Astro check only

# Security
pnpm security:scan        # Run security scan
pnpm security:check       # Check credentials
pnpm security:fix         # Fix security issues
```

## 🏗️ Architecture Overview

### Stack
- **Frontend**: Astro 5.x (SSR) + React 19 + UnoCSS
- **Backend**: Node.js 24+ (Astro SSR endpoints)
- **Python Services**: Python 3.11+ (bias detection, AI services)
- **Databases**: MongoDB (primary), Redis (cache/sessions), Better-Auth (auth)
- **AI/ML**: TensorFlow.js, OpenAI, Google AI, Hugging Face
- **Infrastructure**: Docker, Cloudflare Pages, Railway, Fly.io

### Project Structure

```
src/
├── components/         # Astro + React components (PascalCase)
│   ├── admin/         # Admin dashboard components
│   ├── journal-research/  # Journal research pipeline UI
│   └── therapist/     # Therapist-specific components
├── lib/               # Core services and business logic
│   ├── ai/           # AI services (emotion, personas, bias detection)
│   ├── analytics/    # Analytics and tracking
│   ├── auth/         # Authentication (better-auth)
│   ├── chat/         # Chat functionality
│   ├── crypto/       # Encryption (FHE, AES-256-GCM)
│   ├── database/     # Database utilities
│   ├── jobs/         # Background jobs (BullMQ)
│   ├── mcp/          # Model Context Protocol server
│   ├── mental-health/ # Mental health domain logic
│   ├── research/     # Research pipeline backend
│   ├── security/     # Security utilities
│   ├── services/     # External service integrations
│   └── websocket/    # WebSocket server
├── pages/             # Astro pages (routes)
│   ├── api/          # API endpoints
│   ├── admin/        # Admin routes
│   ├── journal-research/  # Research pipeline routes
│   └── simulator/    # Training simulator
├── types/             # TypeScript type definitions
├── utils/             # Utility functions (camelCase)
├── middleware.ts      # Astro middleware
└── content/           # Content collections (blog, docs)

ai/                    # Python services (separate from Node.js)
├── journal_dataset_research/  # Research automation
│   ├── cli/          # CLI interface
│   ├── mcp/          # MCP server
│   └── src/          # Core research engine
└── bias-detection/    # Bias detection service

scripts/               # Build, deploy, utility scripts
tests/                 # E2E and integration tests
docs/                  # Documentation
```

### Key Services

**Astro SSR (Port 3000)**:
- Primary web application
- SSR pages, API routes, static assets
- React islands for interactivity

**Bias Detection Service (Python)**:
- Detects bias in AI conversations
- Runs as separate Python service

**AI Service (TypeScript)**:
- Emotion analysis, persona generation
- Conversation intelligence

**Analytics Service**:
- Tracks user behavior, metrics
- Redis-backed analytics

**Background Worker**:
- Processes async jobs (BullMQ)
- Dataset processing, report generation

**Training Server**:
- Empathy Gym training sessions
- WebSocket for real-time interaction

### Key Patterns

**Emotional Intelligence Engine**:
- Normalizes emotion scores (0-1 range)
- Uses established frameworks (Plutchik, Big Five)
- Located in `src/lib/ai/emotion/`

**Dual-Persona System**:
- Mentor/Peer role detection
- Persona generation and management
- Located in `src/lib/ai/personas/`

**Journal Research Pipeline**:
- Web UI: `src/pages/journal-research/`, `src/components/journal-research/`
- Backend: `ai/journal_dataset_research/`
- MCP Server: `ai/journal_dataset_research/mcp/`
- Three interfaces: Web, MCP (AI agents), CLI

**Security & Compliance**:
- HIPAA-compliant data handling
- FHE (Fully Homomorphic Encryption) support
- AES-256-GCM encryption for PII
- Audit logging for all sensitive operations
- Located in `src/lib/security/`, `src/lib/crypto/`, `src/lib/audit/`

## 🔒 Security & Ethics

**CRITICAL**: This platform handles mental health data.

1. **Never expose secrets**: Redact API keys, tokens, PII in logs/output
2. **Validate all input**: Especially emotion scores (0-1), conversation data
3. **HIPAA compliance**: Follow documented guidelines in `docs/compliance/`
4. **No harmful AI**: Validate personas don't perpetuate stereotypes
5. **Handle edge cases**: Crisis signals, silence, cultural variations
6. **Audit sensitive operations**: Use audit logging for data access

**Run security checks**: `pnpm security:scan`, `pnpm test:security`, `pnpm test:hipaa`

## 🤖 AI Assistant Workflow

### Code Reading Strategy

**CRITICAL**: Avoid reading entire files unless necessary.

1. **Use targeted searches first**:
   - Search for specific function/class names with `grep`
   - Use symbol-aware semantic search for concepts
   - Only read full files when context requires it

2. **Make minimal, safe edits**:
   - Smallest changes required to satisfy the request
   - Preserve existing project style and lint rules
   - Follow established patterns in the codebase

### Communication Style

**Be concise, specific, and actionable**:

1. **Before tool calls**: Briefly state what you'll run and why
   - ✅ "I'll run `uv install` to install Python deps before running tests."
   - ✅ "I'll search for the emotion validation function in src/lib/ai/"
   - ❌ "I'm going to help you with that, let me think about this..."

2. **Show work via direct edits**: Edit files directly rather than explaining changes

3. **If underspecified**: Make 1-2 reasonable assumptions, state them, proceed
   - Only ask the user if assumptions would materially change behavior

### Collaboration Guidelines

**Intent & Assumptions**:
- State intent before big edits; confirm assumptions quickly
- Offer options with trade-offs when uncertain; pick the safest/highest-signal path
- Record important learnings in the project knowledge base after finishing work

**Delivery Expectations**:
- Add/extend tests with behavior changes; keep diffs reviewable
- Run `pnpm check:all` and `pnpm test:all` before claiming done
- Remove dead code and debug noise; keep accessibility intact (focus order, aria labels, contrast)
- Respect feature flags/config-driven behavior; no silent behavior changes

### Pre-Commit Checklist

**Before committing changes, verify**:

# 2. Did you run tests with correct package managers?
pnpm check:all && pnpm test:all  # Node.js ✅
uv run pytest tests/              # Python ✅

# 3. Did you avoid exposing secrets?
pnpm security:check  # ✅

# 4. Did you keep edits minimal and focused?
# Review your changes ✅


```
## 📝 Code Conventions

**TypeScript/JavaScript**:
- 2 spaces, no semicolons, single quotes, trailing commas
- Type-first imports with `@/` path aliases
- PascalCase: Components, interfaces
- camelCase: Variables, functions
- Strict types, avoid `any` (use `unknown` + type guards)
- Branded types for sensitive values (e.g., `type Email = string & { __brand: 'Email' }`)

**Python**:
- PEP 8 compliance
- Type hints required
- Use `uv` for all package management

**File Organization**:
- Components: One per file, same name as file
- Utilities: Grouped by domain, exported via index
- Types: Co-located with usage or in `src/types/`
- Tests: Co-located `*.test.ts` or in `tests/`
```

## 🚨 Common Pitfalls

1. **Wrong package managers**: Must use `pnpm` (Node), `uv` (Python)
   - ❌ `npm install`, `pip install`, `python -m pytest`
   - ✅ `pnpm install`, `uv install`, `uv run pytest`
2. **Missing validation**: Always validate emotion scores (0-1), user input
3. **Ignoring types**: Fix TypeScript errors, don't use `any` without justification
4. **Skipping security checks**: Run `pnpm security:check` before commits
5. **Hardcoded secrets**: Use environment variables, never commit secrets
   - Never print or commit secrets in code/logs
   - Refer to them as placeholders (e.g., `{{API_KEY}}`)
   - Explain what env var or secret is required and why
6. **Over-engineering**: Start minimal, iterate based on needs
7. **Python venv in src/**: Keep Python environments in `ai/` directory, not `src/`
8. **Reading entire files**: Use targeted searches before scanning whole files
10. **Ignoring CI/Docker context**: Check Dockerfile and CI logs before making broad changes
    - Preserve multi-stage builds and caching hints when modifying Dockerfiles

## 📚 Additional Resources

**See AGENTS.md** for detailed AI assistant workflow (OpenSpec process)

**Warp-Specific Rules** (`.warp/rules/`):
- **test-driven-development.md**: TDD workflow and red-green-refactor cycle
- **systematic-debugging.md**: Four-phase debugging methodology
- **verification-before-completion.md**: Evidence-based completion verification
- **root-cause-tracing.md**: Backward tracing through call stacks

**Key Documentation**:
- **docs/development/journal-research/journal-research-pipeline.md**: Complete research pipeline docs
- **docs/compliance/hipaa-compliance-documentation.md**: HIPAA guidelines
- **docs/api/**: API documentation
- **docs/guides/technical-guides/deployment/**: Deployment guides
- **CLAUDE.md**: AI assistant guide for Claude/Cursor
- **AGENTS.md**: Modern ops and AI collaboration workflow

**External Services**:
- MongoDB: Primary database
- Redis: Cache, sessions, rate limiting
- Sentry: Error tracking and monitoring
- OpenAI, Google AI: LLM services
- Weights & Biases: ML experiment tracking

## 🎯 Development Workflow

**Starting a new feature**:
1. Branch clean, git status clean enough to stage
2. Check `openspec/AGENTS.md` or `AGENTS.md` for major architectural changes
3. Write tests first (TDD approach)
4. Implement feature with minimal, focused edits
5. Run relevant fast checks:
   ```bash
   pnpm check:all && pnpm test:all  # Node.js
   uv run pytest tests/             # Python
   ```
6. Security check: `pnpm security:check`
7. Summarize change, risk, and how to verify

**Debugging**:
1. Reproduce the issue in isolation
2. Review error logs in Sentry (if configured)
3. Run specific test suite: `pnpm test:unit` or `pnpm e2e:debug`
4. Check service health: `pnpm redis:check`, `pnpm mongodb:init`
5. For CI failures: Inspect Dockerfile and CI job logs first

**Before committing**:
```bash
pnpm check:all          # Lint, format, typecheck
pnpm test:all           # All tests pass
pnpm security:check     # No hardcoded secrets
# For Python changes:
uv run pytest tests/    # Python tests with correct environment
```

**Quick Task Checklist**:
- [ ] Branch clean, git status shows only intended changes
- [ ] Implementation matches style guides; no forbidden tooling (`npm`/`yarn`/`pip`)
- [ ] Tests/lints/security checks pass
- [ ] Change summary provided with risk assessment and verification steps

*Building technology that helps humans connect more deeply.*

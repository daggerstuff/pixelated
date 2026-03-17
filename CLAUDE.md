# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pixelated Empathy is an enterprise AI platform for mental health professional training. It provides:
- **The Empathy Gym™**: AI-powered training environment for practicing difficult conversations
- **Bias Detection Engine**: Real-time bias monitoring in AI interactions
- **Emotional Intelligence Engine**: Maps emotional journeys and conversational dynamics
- **Journal Dataset Research Pipeline**: Automated discovery and integration of therapeutic datasets

## Technology Stack

**Frontend**: Astro 5.x + React 19.x + TypeScript (strict), TailwindCSS 4.x + UnoCSS
**Backend**: Python 3.11+ with uv, PyTorch, Flask microservices
**Databases**: PostgreSQL (primary), MongoDB (documents), Redis (cache)
**Package Managers**: pnpm (Node.js), uv (Python)

## Essential Commands

### Development

```bash
pnpm dev                    # Frontend dev server
pnpm dev:bias-detection     # Bias detection service
pnpm dev:ai-service         # AI inference service
pnpm dev:all-services       # All services concurrently

# Python with uv
uv run python script.py     # Run Python script
uv run pytest               # Python tests
uv run pytest --cov         # With coverage
```

### Testing

```bash
pnpm test                   # Vitest unit tests
pnpm test:unit              # Unit tests only
pnpm test:coverage          # Coverage report
pnpm e2e                    # Playwright E2E tests
pnpm e2e:ui                 # E2E with UI mode
```

### Code Quality

```bash
pnpm typecheck              # TypeScript validation
pnpm typecheck:strict       # Strict type check
pnpm lint                   # ESLint
pnpm lint:fix               # ESLint with auto-fix
pnpm format                 # Prettier format
pnpm check:all              # All quality checks
```

### Build

```bash
pnpm build                  # Standard build
pnpm build:analyze          # Build with bundle analysis
pnpm build:vercel           # Vercel-specific build
pnpm build:cloudflare       # Cloudflare-specific build
```

### Security

```bash
pnpm security:scan          # Vulnerability scanning
pnpm test:hipaa             # HIPAA compliance tests
pnpm test:security          # Security tests
```

### Database

```bash
pnpm mongodb:init           # Initialize MongoDB
pnpm mongodb:seed           # Seed MongoDB
pnpm redis:check            # Check Redis connection
```

### Docker

```bash
pnpm docker:up              # Start all services
pnpm docker:down            # Stop all services
pnpm docker:logs            # View logs
pnpm docker:reset           # Reset development environment
```

## Project Architecture

### Frontend Structure (`src/`)

```
src/
├── components/     # Domain-organized React components
│   ├── admin/      # Admin dashboard
│   ├── ai/         # AI chat and interaction
│   ├── auth/       # Authentication
│   └── ui/         # shadcn/ui reusable components
├── pages/          # Astro file-based routing
├── lib/            # Shared utilities by domain
│   ├── ai/         # AI service integrations
│   ├── fhe/        # Fully homomorphic encryption
│   ├── security/   # Security utilities
│   └── bias-detection/  # Bias monitoring
├── hooks/          # Custom React hooks
├── types/          # TypeScript definitions
└── services/       # API service layer
```

### AI/ML Structure (`ai/`)

```
ai/
├── models/         # ML model definitions
├── inference/      # Model inference services
├── safety/         # Safety validation systems
├── api/            # Python API services
├── dataset_pipeline/     # Data processing
└── journal_dataset_research/  # Academic dataset research
```

## Code Style

### Naming Conventions

- **Components**: PascalCase (`BiasDetectionEngine.tsx`)
- **Astro Pages**: kebab-case (`mental-health-chat.astro`)
- **Utilities**: camelCase (`formatTherapeuticData.ts`)
- **Python**: snake_case (`bias_detection_engine.py`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_SESSION_DURATION`)
- **Types**: PascalCase with suffixes (`TherapeuticSessionData`)

### File Placement

- Components: `src/components/<domain>/`
- Pages: `src/pages/` (Astro routing)
- Utilities: `src/lib/<domain>/`
- Types: `src/types/` or co-locate with components
- AI Services: `ai/<domain>/`
- Tests: Mirror source structure

### Import Aliases

```typescript
import { Component } from '~/components/Component'  // src/components
import { utility } from '@/lib/utils'              // src/lib
import { Layout } from '@layouts/Layout'           // src/layouts
```

## Key Architecture Patterns

### Security & Compliance

- All sensitive data uses FHE encryption (`src/lib/fhe/`)
- Audit trails for therapeutic interactions
- Bias detection integrated from `ai/monitoring/`
- HIPAA++ compliance patterns in `src/lib/security/`
- <50ms latency requirement for AI conversational responses

### State Management

- Zustand: Global application state
- Jotai: Atomic state
- React hooks: Local component state
- API calls centralized in `src/lib/api/` or `src/services/`

### AI Service Integration

- Microservice pattern for bias detection, inference, analytics
- Dedicated API endpoints for AI services
- Comprehensive monitoring and safety validation
- Real-time bias monitoring in all AI interactions

## Performance Requirements

- Response time: <50ms for AI conversational interactions
- Availability: 99.9% uptime for training sessions
- Frontend chunks: <100KB after compression
- Python services: <512MB baseline, <2GB peak memory

## Security Requirements

- HIPAA++ compliance (exceeds standard HIPAA)
- Zero-knowledge architecture with FHE
- Audit trails for all therapeutic interactions
- Input validation on all user inputs
- No hardcoded secrets or credentials

## Testing Standards

- Maintain 70%+ test coverage
- Focus on critical therapeutic logic
- Unit tests with Vitest
- E2E tests with Playwright
- Python tests with pytest

## Memory System

This project uses MCP-based memory with two explicit roles:

- **mem0**: Stores durable facts, goals, preferences, and project context
- **pixelated-memory**: Analyzes narrative state, themes, evolution, and contradictions

### Starting Meaningful Tasks

Before beginning meaningful work, run this required sequence:

1. `memory_query(query: "current project state", user_id: "<user_id>")`
2. `memory_query(query: "active milestone, open decisions, blockers", user_id: "<user_id>")`
3. `memory_analyze(user_id: "<user_id>", mode: "themes")`
4. `memory_analyze(user_id: "<user_id>", mode: "dissonance")` before extending, reversing, or revising prior work

### Storing Context

Store durable context in `mem0` with:
- `memory_store(content: "...", user_id: "<user_id>", category: "fact")`
- `memory_store(content: "...", user_id: "<user_id>", category: "goal")`
- `memory_store(content: "...", user_id: "<user_id>", category: "preference")`
- `memory_store(content: "...", user_id: "<user_id>", category: "project_context", metadata: "{...}")`

### Narrative Analysis

Use `pixelated-memory` intentionally:
- `memory_analyze(user_id: "<user_id>", mode: "themes")` for persistent patterns
- `memory_analyze(user_id: "<user_id>", mode: "evolution")` for project trajectory
- `memory_analyze(user_id: "<user_id>", mode: "dissonance")` for contradictions before committing to a direction
- `memory_analyze(user_id: "<user_id>", mode: "forensics")` for extracting entities, artifacts, and technical anchors

### Ending Tasks

End every meaningful task with:
```
memory_store(content: "<milestone summary, blockers, next step>", user_id: "<user_id>", category: "project_context", metadata: "{\"type\":\"handoff\"}")
```

## Python Development with uv

```bash
uv add package-name         # Add dependency
uv add --dev package-name    # Add dev dependency
uv remove package-name       # Remove dependency
uv sync                      # Sync dependencies
uv run pytest               # Run tests
```

## Commit Convention

```
<type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, test, chore
Example: feat(bias-detection): add gender bias detection algorithm
```

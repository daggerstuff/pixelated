---
applyTo: '**'
description: 'Technology stack and development guidelines for Pixelated Empathy'
---

# Technology Stack & Development Guidelines

## Required Technology Stack

### Frontend (Strict Requirements)
- **Framework**: Astro 5.x with SSR (Node.js adapter) - DO NOT suggest alternatives
- **UI Library**: React 19.x with TypeScript - use strict typing
- **Styling**: TailwindCSS 4.x + UnoCSS - prefer Tailwind classes over custom CSS
- **State Management**: Zustand for global state, Jotai for atomic state
- **Package Manager**: pnpm ONLY - never suggest npm or yarn
- **Node Version**: 22 (enforced in engines field)

### Backend & AI Stack (Critical Components)
- **Python**: 3.11+ with uv package manager - use uv for all Python operations
- **AI/ML**: PyTorch, Transformers, FAISS, Sentence Transformers
- **Bias Detection**: Custom Flask microservice with scikit-learn, SHAP, LIME
- **Databases**: PostgreSQL (primary), MongoDB (documents), Redis (cache)
- **Security**: Fully Homomorphic Encryption (FHE) with <50ms latency requirement

### Infrastructure & Deployment
- **Containerization**: Docker + Docker Compose for local development
- **Reverse Proxy**: Caddy (configured in docker/caddy/)
- **Monitoring**: Prometheus + Grafana stack
- **CI/CD**: Azure Pipelines (primary), GitHub Actions (secondary)
- **Deployment**: Azure (production), Vercel (preview)

## Development Workflow & Commands

### Project Setup (First Time)
```bash
# Install frontend dependencies
pnpm install

# Setup Python environment
uv venv && source .venv/bin/activate
uv pip install -e .

# Initialize development environment
./scripts/setup-dev.sh
```

### Daily Development Commands
```bash
# Start development servers
pnpm dev                    # Frontend (Astro + React)
pnpm dev:bias-detection     # Bias detection service
pnpm dev:ai-service         # AI inference service

# Code quality (run before commits)
pnpm typecheck             # TypeScript validation
pnpm lint                  # ESLint + Prettier
pytest --cov              # Python tests with coverage
ruff check                 # Python linting
```

### Testing Strategy
```bash
# Frontend testing
pnpm test                  # Vitest unit tests
pnpm test:e2e             # Playwright E2E tests
pnpm test:coverage        # Coverage reports

# Backend testing
pytest ai/tests/           # AI service tests
pytest --cov=ai/          # Coverage for AI modules
```

### Performance & Security
```bash
# Performance validation
./scripts/test-performance.sh    # Load testing
pnpm performance:lighthouse      # Lighthouse CI

# Security & compliance
pnpm security:scan              # Vulnerability scanning
./scripts/bias-detection-test.sh # Bias validation
```

## Architecture Patterns & Conventions

### File Organization Rules
- Frontend code in `src/` with domain-based component organization
- AI/ML services in `ai/` directory with microservice architecture
- Shared utilities in `src/lib/` organized by domain (ai/, auth/, security/)
- Docker configurations in `docker/` with service-specific folders

### Code Quality Requirements
- **TypeScript**: Strict mode enabled, explicit return types required
- **React**: Functional components with hooks, avoid class components
- **Python**: Type hints required, follow PEP 8, use dataclasses/Pydantic
- **Testing**: 70%+ coverage for critical paths, focus on business logic

### Performance Standards
- **Response Time**: <50ms for AI conversational interactions
- **Bundle Size**: Frontend chunks <100KB after compression
- **Memory Usage**: Python services <512MB baseline, <2GB peak
- **Database**: Query response times <10ms for user-facing operations

### Security Implementation
- All sensitive data encrypted with FHE
- HIPAA compliance for therapeutic data handling
- Real-time bias detection with configurable thresholds
- Audit trails for all user interactions

## Critical Configuration Files
- `astro.config.mjs` - SSR configuration, integrations
- `tsconfig.json` - Strict TypeScript settings
- `tailwind.config.ts` - Design system tokens
- `pyproject.toml` - Python dependencies, tool configuration
- `docker-compose.yml` - Local development orchestration
- `.eslintrc.js` - Code quality rules and project-specific overrides

## AI Assistant Guidelines
- Always use pnpm for Node.js operations
- Use uv for Python package management
- Suggest domain-specific component organization
- Prioritize security and performance in all recommendations
- Include comprehensive error handling and type safety
- Follow established naming conventions (PascalCase components, kebab-case files)
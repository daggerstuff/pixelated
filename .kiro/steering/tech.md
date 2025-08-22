# Technology Stack & Build System

## Frontend Stack
- **Framework**: Astro 5.x with SSR (Node.js adapter)
- **UI Library**: React 19.x with TypeScript
- **Styling**: TailwindCSS 4.x + UnoCSS
- **State Management**: Zustand, Jotai
- **Package Manager**: pnpm (required)
- **Node Version**: 22 (specified in engines)

## Backend & AI Stack
- **Python**: 3.11+ with uv package manager
- **AI/ML**: PyTorch, Transformers, FAISS, Sentence Transformers
- **Bias Detection**: Custom Flask service with scikit-learn, SHAP, LIME
- **Database**: PostgreSQL, MongoDB, Redis
- **Security**: Fully Homomorphic Encryption (FHE), advanced cryptography

## Infrastructure
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Caddy
- **Monitoring**: Prometheus + Grafana
- **CI/CD**: Azure Pipelines, GitHub Actions
- **Deployment**: Azure, Vercel support

## Development Commands

### Frontend Development
```bash
# Install dependencies
pnpm install

# Development server
pnpm dev

# Build for production
pnpm build

# Type checking
pnpm typecheck

# Linting & formatting
pnpm lint
pnpm format

# Testing
pnpm test              # Unit tests (Vitest)
pnpm test:e2e         # E2E tests (Playwright)
pnpm test:coverage    # Coverage report
```

### Python/AI Development
```bash
# Setup Python environment
uv venv
uv pip install -e .

# Run AI services
pnpm dev:bias-detection
pnpm dev:ai-service
pnpm dev:analytics

# Python testing
pytest                # Unit tests
pytest --cov         # Coverage
ruff check           # Linting
black .              # Formatting
```

### Docker & Infrastructure
```bash
# Development setup
./scripts/setup-dev.sh

# Start all services
./scripts/deploy.sh

# Individual services
docker compose up -d postgres redis
docker compose logs -f [service]

# Reset development environment
./scripts/reset-dev.sh
```

### Performance & Quality
```bash
# Performance testing
./scripts/test-performance.sh
pnpm performance:lighthouse

# Security scanning
pnpm security:scan

# Bundle analysis
pnpm build:analyze
```

## Key Configuration Files
- `astro.config.mjs` - Astro configuration
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.ts` - Styling configuration
- `pyproject.toml` - Python dependencies and tools
- `docker-compose.yml` - Service orchestration
- `.eslintrc.js` - Code quality rules
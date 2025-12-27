# Technology Stack

## Framework & Runtime
- **Astro 5.x**: Full-stack web framework with SSR/SSG
- **React 19**: UI components and client-side interactivity
- **Node.js 24+**: Server runtime (required minimum version)
- **TypeScript 5.x**: Strict typing throughout the codebase

## Package Management
- **pnpm**: ONLY package manager for Node.js (never npm/yarn)
- **uv**: ONLY package manager for Python (never pip/conda/venv)

## Build System & Deployment
- **Vite 7.x**: Build tool and dev server
- **UnoCSS**: Atomic CSS framework
- **Multiple deployment targets**: Cloudflare Pages, Railway, Heroku, Fly.io, Kubernetes

## Backend Services
- **MongoDB**: Primary database with Better Auth integration
- **Redis/IoRedis**: Caching and session storage
- **PostgreSQL**: Secondary database for specific use cases

## AI & Machine Learning
- **TensorFlow.js**: Client-side ML models
- **Transformers**: HuggingFace models for NLP
- **PyTorch**: Python-based training and inference
- **NVIDIA NeMo**: Data designer for synthetic datasets
- **Sentence Transformers**: Semantic similarity and embeddings

## Security & Encryption
- **Better Auth**: Authentication system with MongoDB adapter
- **Node-SEAL**: Fully homomorphic encryption (FHE)
- **Crypto-js**: Client-side cryptography
- **bcryptjs**: Password hashing

## Monitoring & Analytics
- **Sentry**: Error tracking and performance monitoring
- **Grafana**: Metrics dashboards
- **Prometheus**: Metrics collection
- **Custom analytics**: Real-time user behavior tracking

## Testing
- **Vitest**: Unit and integration testing
- **Playwright**: End-to-end testing with browser compatibility
- **Testing Library**: React component testing
- **pytest**: Python testing framework

## Common Commands

### Development
```bash
pnpm dev                    # Start dev server
pnpm dev:all-services      # Start all services (app + microservices)
pnpm check:all             # Run all checks (lint, typecheck, format)
pnpm test:all              # Run all tests
pnpm sync                   # Sync Astro content collections
```

### Code Quality
```bash
pnpm format                # Format code (oxc + prettier)
pnpm lint                  # Lint code (oxlint)
pnpm typecheck             # TypeScript type checking
pnpm check                 # Astro check (content collections, etc.)
```

### Testing
```bash
pnpm test                  # Run test suite
pnpm test:unit             # Unit tests with coverage
pnpm test:integration      # Integration tests
pnpm test:e2e              # End-to-end tests (Playwright)
pnpm test:security         # Security test suite
pnpm test:bias-detection   # AI bias detection tests
```

### Python (AI Services)
```bash
uv sync                    # Install Python dependencies
uv run pytest             # Run Python tests
uv run python ai/main.py  # Run AI services
```

### Database
```bash
pnpm mongodb:init          # Initialize MongoDB
pnpm mongodb:seed          # Seed database with test data
pnpm redis:check           # Check Redis connection
```

### Deployment
```bash
pnpm build                 # Production build
pnpm build:cloudflare      # Cloudflare Pages build
pnpm build:railway         # Railway deployment build
pnpm deploy                # Deploy to staging
pnpm deploy:prod           # Deploy to production
```

## Architecture Patterns

### Monorepo Structure
- `/src`: Main Astro application
- `/ai`: Python AI services and models
- `/api`: API routes and handlers
- `/docker`: Container configurations
- `/scripts`: Build and deployment scripts

### Service Architecture
- **Frontend**: Astro + React SSR/SPA hybrid
- **API Layer**: Astro API routes + Express microservices
- **AI Services**: Python FastAPI microservices
- **Background Jobs**: Node.js workers with Redis queues
- **Database Layer**: MongoDB primary, PostgreSQL secondary

### Key Conventions
- Use `@/` imports for internal modules
- Strict TypeScript with no `any` types
- Component co-location in `/src/components`
- API routes in `/src/pages/api`
- Shared utilities in `/src/lib`
- Type definitions in `/src/types`
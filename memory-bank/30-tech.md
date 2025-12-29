# Technology Landscape

> **Builds on**: `00-description.md`, `20-system.md`  
> **Focus**: Tools and Environment

---

## Technology Stack

### Frontend Technologies

**Core Framework:**
- **Astro 5.x**: Meta-framework for content-driven sites
- **React 19.x**: UI component library
- **TypeScript 5.x**: Type-safe JavaScript

**Styling:**
- **UnoCSS**: Utility-first CSS framework
- **TailwindCSS**: Utility CSS classes
- **Radix UI**: Accessible component primitives

**State Management:**
- **Jotai**: Atomic state management
- **Zustand**: Lightweight global state
- **React Context**: Shared context management
- **TanStack Query**: Server state management

**Build Tools:**
- **Vite**: Build tool and dev server
- **TypeScript Compiler**: Type checking
- **Oxlint**: Fast linter
- **Prettier**: Code formatting

### Backend Technologies

**Runtime:**
- **Node.js 24+**: JavaScript runtime
- **TypeScript 5.x**: Type-safe development
- **Express 5**: Web framework

**API Layer:**
- **REST APIs**: Standard HTTP endpoints
- **WebSocket**: Real-time communication
- **Express Middleware**: Request processing

**Authentication:**
- **Better Auth**: Authentication library
- **JWT**: Token-based authentication
- **Azure AD**: Enterprise authentication
- **Supabase Auth**: User authentication

**AI/ML Services:**
- **Python 3.11+**: AI service runtime
- **PyTorch**: Deep learning framework
- **TensorFlow.js**: Browser-based ML
- **MentalLLaMA**: Specialized mental health models

### Database Technologies

**Primary Database:**
- **MongoDB Atlas**: NoSQL document database
- **Mongoose**: MongoDB ODM

**Secondary Database:**
- **PostgreSQL**: Relational database (via Supabase)
- **Drizzle ORM**: Type-safe SQL ORM

**Cache:**
- **Redis**: In-memory data store
- **ioredis**: Redis client for Node.js

**Storage:**
- **AWS S3**: Object storage
- **Azure Blob Storage**: Cloud storage
- **Google Cloud Storage**: Object storage

### Infrastructure Technologies

**Containerization:**
- **Docker**: Container platform
- **Docker Compose**: Multi-container orchestration

**Orchestration:**
- **Kubernetes**: Container orchestration
- **Helm**: Kubernetes package manager

**Cloud Providers:**
- **AWS**: Primary cloud provider
- **Azure**: Secondary cloud provider
- **GCP**: Tertiary cloud provider
- **Cloudflare**: CDN and edge computing

**CI/CD & Infrastructure as Code:**
- **GitHub Actions**: CI/CD pipelines
- **Azure Pipelines**: Enterprise CI/CD
- **Terraform**: Infrastructure as code with GitLab HTTP remote backend (`terraform/backend.config`) for managing state for the `pixelated-azure-infrastructure` project. Authentication uses `gitlab-ci-token` as the backend username and requires `TF_HTTP_PASSWORD` to be provided via environment variables or pipeline variables (never committed).

**Monitoring:**
- **Sentry**: Error tracking and performance monitoring
- **Prometheus**: Metrics collection
- **Grafana**: Metrics visualization

### Development Tools

**Package Managers:**
- **pnpm**: Node.js package manager (REQUIRED - no npm/yarn)
- **uv**: Python package manager (REQUIRED - no pip/conda)

**Testing:**
- **Vitest**: Unit testing framework
- **Playwright**: End-to-end testing
- **pytest**: Python testing framework

**Code Quality:**
- **Oxlint**: Fast JavaScript/TypeScript linter
- **ESLint**: JavaScript linter
- **TypeScript**: Type checking
- **Prettier**: Code formatting

**Security:**
- **Automated Security Scanning**: Dependency vulnerability checks
- **HIPAA Security Scripts**: Compliance verification
- **Credential Scanning**: Secret detection

## Development Environment

### Local Setup

**Prerequisites:**
- Node.js 24+
- Python 3.11+
- pnpm 10.26.2+
- uv (Python package manager)
- Docker (for local services)

**Quick Start:**
```bash
# Install dependencies
pnpm install && uv install

# Start development server
pnpm dev                    # Frontend dev server
pnpm dev:all-services       # All services

# Run tests
pnpm test:all              # All tests
pnpm check:all             # Lint + format + typecheck
```

### Environment Variables

**Required Variables:**
- Database connection strings (MongoDB, PostgreSQL)
- Authentication secrets (JWT, Azure AD)
- AI service API keys (MentalLLaMA)
- Storage credentials (AWS, Azure, GCP)
- Encryption keys (FHE)

**Configuration Files:**
- `.env.local`: Local development variables
- `.env.example`: Template for required variables
- `config/`: Application configuration files

### Build & Deployment

**Build Process:**
- TypeScript compilation
- Astro build (SSR/SSG)
- Asset optimization
- Bundle analysis

**Deployment Targets:**
- **Vercel**: Frontend deployment
- **Cloudflare Pages**: Edge deployment
- **Azure App Service**: Backend services
- **AWS ECS/EKS**: Containerized services
- **Kubernetes**: Orchestrated services

**Build Commands:**
```bash
pnpm build                  # Standard build
pnpm build:cloudflare      # Cloudflare-specific build
pnpm build:vercel          # Vercel-specific build
```

## Dependencies

### Critical Dependencies

**Frontend:**
- `astro`: 5.16.4
- `react`: 19.2.1
- `typescript`: 5.9.3
- `@unocss/astro`: 66.5.10

**Backend:**
- `express`: 5.2.1
- `better-auth`: 1.4.6
- `mongodb`: 7.0.0
- `ioredis`: 5.8.2

**AI/ML:**
- `@tensorflow/tfjs`: 4.22.0
- `node-seal`: 7.0.0 (FHE)

### Development Dependencies

**Testing:**
- `vitest`: 4.0.15
- `@playwright/test`: 1.57.0
- `@testing-library/react`: 16.3.0

**Code Quality:**
- `oxlint`: 1.32.0
- `eslint`: 9.39.1
- `prettier`: 3.7.4

## Configuration

### TypeScript Configuration

**Strict Mode**: Enabled
- No implicit any
- Strict null checks
- Strict function types
- No unused locals/parameters

**Path Aliases:**
- `@/`: `src/` directory
- Type-first imports required

### Linting Configuration

**Oxlint**: Primary linter (fast)
**ESLint**: Secondary linter (comprehensive)
**Rules**: Enforced via CI/CD pipeline

### Formatting Configuration

**Prettier**: Code formatting
**Oxfmt**: Fast formatter
**Rules**: 2 spaces, no semicolons, single quotes, trailing commas

## Tool Chain

### Development Workflow

1. **Code**: Write TypeScript/React code
2. **Lint**: Run linters (oxlint, ESLint)
3. **Format**: Auto-format code (Prettier)
4. **Type Check**: Verify types (TypeScript)
5. **Test**: Run tests (Vitest, Playwright)
6. **Build**: Build for production
7. **Deploy**: Deploy to target environment

### CI/CD Pipeline

**GitHub Actions:**
- Lint and format checks
- Type checking
- Unit tests
- Integration tests
- Security scanning
- Build verification

**Azure Pipelines:**
- Enterprise CI/CD
- Multi-environment deployment
- Security audits
- Performance testing

## Performance Optimization

### Frontend Optimization

- Code splitting
- Tree shaking
- Lazy loading
- Image optimization
- Bundle analysis

### Backend Optimization

- Connection pooling
- Query optimization
- Caching strategies
- Load balancing
- Auto-scaling

### AI/ML Optimization

- Model quantization
- Batch processing
- GPU acceleration
- Caching inference results
- FHE optimization (<50ms latency)

---

*Last Updated: December 2025*

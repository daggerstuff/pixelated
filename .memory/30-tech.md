# Technology Stack & Environment

## Development Environment

### Core Languages & Frameworks
- **JavaScript/TypeScript**: Node.js 24, Astro 5.x, React 19
- **Python**: 3.11+ with uv package manager
- **Shell**: Bash/Zsh for scripting and automation

### Package Managers
- **Frontend**: pnpm (monorepo management)
- **Python**: uv (fast, reliable dependency management)
- **Containers**: Docker with BuildKit

### Development Tools
```bash
# Essential CLI tools
pnpm dev              # Start development server
pnpm dev:all-services # Start all backend services
pnpm check:all        # Run all checks (lint, typecheck)
pnpm test:all         # Run all tests
pnpm security:check   # Security vulnerability scan
pnpm security:scan    # Comprehensive security audit

# Python development
uv run pytest         # Run Python tests
uv run black .        # Format Python code
uv run ruff check .   # Lint Python code
```

## Backend Services Architecture

### Node.js Services
Located in `/src/lib/`:
- `ai/services/` - Core AI service orchestration
- `analytics/` - Data processing and metrics
- `jobs/` - Background task processing
- `services/training/` - Training platform backend
- `websocket/` - Real-time communication

### Python Services
Located in `/ai/`:
- `models/` - Machine learning models and inference
- `journal_dataset_research/` - Academic research pipeline
- `bias-detection/` - Bias identification algorithms
- `dataset_pipeline/` - Data processing workflows

### Database Configuration
```javascript
// MongoDB connection
const mongoConfig = {
  uri: process.env.MONGODB_URI,
  dbName: 'pixelated-empathy',
  options: {
    retryWrites: true,
    w: 'majority'
  }
};

// Redis cache
const redisConfig = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD
};
```

## Infrastructure & Deployment

### Container Orchestration
- **Docker Compose**: Primary deployment method (Development, Staging, Production)
- **Kubernetes**: Secondary/Future infrastructure (Helm charts in `/helm`)

### Cloud Providers
- **Primary**: Cloudflare Workers (edge computing)
- **Backup**: AWS/GCP for traditional infrastructure
- **Storage**: Multiple providers (S3, GCS, Cloudflare R2)

### CI/CD Pipeline
```yaml
# Key pipeline stages
1. Code Quality Checks
   - ESLint/Prettier for JS/TS
   - Black/Ruff for Python
   - Security scanning

2. Testing
   - Unit tests (Vitest, Pytest)
   - Integration tests
   - E2E tests (Playwright)

3. Security
   - Dependency vulnerability scans
   - Static analysis
   - Penetration testing

4. Deployment
   - Staging environment deployment
   - Production deployment with rollback capability
```

## Monitoring & Observability Stack

### Logging
- **Structured Logging**: JSON format with correlation IDs
- **Log Levels**: DEBUG, INFO, WARN, ERROR, CRITICAL
- **Storage**: Centralized logging system (ELK stack)

### Metrics Collection
- **Application Metrics**: Response times, error rates, throughput
- **Business Metrics**: User engagement, feature adoption
- **Infrastructure Metrics**: CPU, memory, disk I/O

### Alerting System
- **Critical Alerts**: System downtime, security incidents
- **Warning Alerts**: Performance degradation, unusual patterns
- **Notification Channels**: Slack, Email, SMS

## Development Standards

### Code Quality
- **TypeScript**: Strict mode with noImplicitAny
- **Python**: Type hints required, PEP 8 compliance
- **Testing**: Minimum 80% code coverage
- **Documentation**: Inline comments and API documentation

### Security Practices
- **Secrets Management**: Environment variables, HashiCorp Vault
- **Input Validation**: Sanitize all user inputs
- **Authentication**: JWT with short-lived tokens
- **Authorization**: RBAC with principle of least privilege

### Performance Optimization
- **Caching Strategy**: Multi-level caching (Redis, CDN, browser)
- **Database Optimization**: Proper indexing, connection pooling
- **Frontend Optimization**: Code splitting, lazy loading, image optimization

## Local Development Setup

### Prerequisites
```bash
# System requirements
Node.js >= 24
Python >= 3.11
Docker >= 20.10
Git >= 2.30

# Recommended tools
VS Code with recommended extensions
Docker Desktop
MongoDB Compass
Redis CLI
```

### Quick Start
```bash
# Clone and setup
git clone <repository>
cd pixelated
pnpm setup:dev

# Start development environment
pnpm dev:all-services
# Visit http://localhost:5173
```

### Environment Variables
Create `.env` file:
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/pixelated
REDIS_URL=redis://localhost:6379

# Authentication
AUTH_SECRET=your-secret-key
AUTH0_DOMAIN=your-domain.auth0.com

# API Keys
OPENAI_API_KEY=sk-...
HUGGINGFACE_TOKEN=hf_...

# Security
ENCRYPTION_KEY=32-byte-encryption-key
```

## Testing Strategy

### Test Types
1. **Unit Tests**: Component and function level testing
2. **Integration Tests**: Service interaction testing
3. **E2E Tests**: Full user journey testing
4. **Performance Tests**: Load and stress testing
5. **Security Tests**: Vulnerability scanning

### Test Tools
- **Frontend**: Vitest, React Testing Library, Playwright
- **Backend**: Jest, Supertest, Pytest
- **API Testing**: Postman collections, Newman
- **Load Testing**: Artillery, k6

## Documentation Standards

### API Documentation
- OpenAPI 3.1 specification
- Interactive API documentation
- Example requests and responses
- Error code documentation

### Code Documentation
- JSDoc/TypeDoc for JavaScript/TypeScript
- Sphinx/docstrings for Python
- README files for major components
- Architecture decision records (ADRs)
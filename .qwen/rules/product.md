---
inclusion: always
---

# Pixelated - AI-Powered Mental Health & Empathy Platform

**Pixelated** is a comprehensive full-stack Astro application focused on AI-powered mental health support, empathy training, and bias detection. The platform combines modern web technologies with advanced AI capabilities to deliver ethical, secure, and accessible mental health solutions.

## 🎯 Project Overview

- **Type**: Full-stack web application built with Astro + React
- **Primary Purpose**: AI-powered mental health platform with bias detection and empathy training
- **Target**: Mental health professionals, researchers, and end-users seeking support
- **Architecture**: Server-side rendered (SSR) with standalone Node.js adapter
- **Database**: MongoDB with Redis caching
- **AI Integration**: Multiple AI services including OpenAI, Google GenAI, and custom models
- **Security**: HIPAA-compliant with FHE (Fully Homomorphic Encryption) support

## 🏗️ Architecture & Stack

### Frontend
- **Framework**: Astro 5.x with React 19 integration
- **Styling**: TailwindCSS 4.x + UnoCSS for utility-first CSS
- **UI Components**: Headless UI + Radix UI primitives
- **Icons**: Lucide React + Iconify collections
- **3D Graphics**: Three.js + React Three Fiber
- **Charts**: Chart.js + Recharts for data visualization

### Backend & Services
- **Runtime**: Node.js 24 with TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Caching**: Redis (ioredis) for session and performance caching  
- **Authentication**: Clerk for user management and auth
- **File Storage**: AWS S3, Google Cloud Storage, Azure Blob
- **AI Services**: OpenAI GPT, Google GenAI, custom TensorFlow models
- **Security**: bcryptjs, jsonwebtoken, rate limiting

### DevOps & Tools
- **Package Manager**: pnpm with Node 24
- **Build Tool**: Vite 7.x with enhanced configurations
- **Testing**: Vitest (unit), Playwright (E2E), Axe (accessibility)
- **Linting**: ESLint 9.x + oxlint for fast linting
- **Formatting**: Prettier with Astro plugin
- **CI/CD**: GitHub Actions + deployment scripts
- **Monitoring**: Sentry for error tracking and performance

## 📁 Project Structure

```
pixelated/
├── src/
│   ├── components/          # React/Astro components
│   │   ├── admin/          # Admin dashboard components
│   │   ├── ai/             # AI-related UI components
│   │   ├── auth/           # Authentication components  
│   │   ├── chat/           # Chat interface components
│   │   └── mental-health/  # Mental health specific UI
│   ├── lib/                # Core business logic
│   │   ├── ai/             # AI services and models
│   │   ├── auth.ts         # Authentication utilities
│   │   ├── redis.ts        # Redis connection and utilities
│   │   ├── security.ts     # Security and encryption
│   │   └── memory.ts       # Memory management
│   ├── pages/              # Astro pages (file-based routing)
│   │   ├── admin/          # Admin dashboard pages
│   │   ├── api/            # API endpoints
│   │   └── docs/           # Documentation pages
│   └── layouts/            # Page layouts
├── scripts/                # Build and utility scripts
├── tests/                  # Test suites
├── .claude/                # Claude AI configuration
├── .clinerules/            # Code guidelines and rules
└── docker-compose.yml      # Development environment
```

## 🚀 Development Workflow

### Essential Commands

```bash
# Development server
pnpm dev                    # Start dev server on http://localhost:4321

# Build & Preview
pnpm build                  # Production build
pnpm preview               # Preview production build

# Code Quality
pnpm lint                  # Run oxlint on src/
pnpm lint:fix              # Auto-fix linting issues
pnpm format                # Format with prettier
pnpm typecheck             # TypeScript type checking

# Testing
pnpm test                  # Run Vitest unit tests
pnpm test:coverage         # Run tests with coverage
pnpm e2e                   # Run Playwright E2E tests
pnpm e2e:ui                # Playwright UI mode
pnpm test:all              # Run all test suites

# Specialized Commands
pnpm ai:test               # Test AI services
pnpm bias:py               # Run bias detection Python service
pnpm security:scan         # Run security vulnerability scan
pnpm performance:test      # Performance benchmarking
```

### Database & Services

```bash
# MongoDB operations
pnpm mongodb:init          # Initialize MongoDB setup
pnpm mongodb:seed          # Seed development data
pnpm mongodb:migrate       # Run database migrations

# Redis operations
pnpm redis:check           # Check Redis connection health

# Service management
pnpm dev:all-services      # Start all services concurrently
pnpm dev:bias-detection    # Start bias detection service
pnpm dev:ai-service        # Start AI service server
pnpm dev:analytics         # Start analytics server
```

### Docker Development

```bash
# Container management
pnpm docker:up             # Start all services with docker-compose
pnpm docker:down           # Stop all containers  
pnpm docker:logs           # View container logs
pnpm docker:restart        # Restart services
pnpm docker:reset          # Reset development environment
pnpm setup:dev             # Initial development setup
```

## 🔧 Configuration Files

### Key Configuration Files
- `astro.config.mjs` - Main Astro configuration with SSR setup
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration  
- `tailwind.config.js` - TailwindCSS configuration
- `uno.config.ts` - UnoCSS utility configuration
- `playwright.config.ts` - E2E testing configuration
- `vitest.config.ts` - Unit testing configuration
- `.eslintrc.js` - ESLint rules and plugins

### Environment Variables
```bash
# Core Application
PUBLIC_SITE_URL=https://pixelatedempathy.com
NODE_ENV=development
WEBSITES_PORT=4321

# Database & Cache  
MONGODB_URI=mongodb://localhost:27017/pixelated
REDIS_URL=redis://localhost:6379

# Authentication (Clerk)
CLERK_SECRET_KEY=sk_live_...
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...

# AI Services
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=...
HUGGINGFACE_TOKEN=hf_...

# Storage Providers
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
GOOGLE_CLOUD_PROJECT=...

# Monitoring & Analytics
SENTRY_DSN=https://...
SENTRY_AUTH_TOKEN=...
WANDB_API_KEY=...
```

## 🧪 Testing Strategy

### Test Structure
- **Unit Tests**: `src/**/*.test.ts` using Vitest
- **Integration Tests**: `tests/integration/` for API and service testing
- **E2E Tests**: `tests/e2e/` using Playwright
- **Performance Tests**: `tests/performance/` for load testing
- **Security Tests**: `scripts/security-scan.sh` for vulnerability scanning

### Testing Commands
```bash
pnpm test:unit             # Unit tests with coverage
pnpm test:integration      # Integration test suite
pnpm e2e:smoke             # Smoke tests for critical paths
pnpm e2e:browser           # Cross-browser compatibility tests
pnpm test:security         # Security vulnerability tests
pnpm test:bias-detection   # AI bias detection tests
pnpm test:performance      # K6 performance testing
```

## 🔒 Security & Compliance

### Security Features
- **HIPAA Compliance**: Healthcare data protection standards
- **FHE Support**: Fully Homomorphic Encryption for sensitive data
- **Rate Limiting**: API protection with rate-limiter-flexible
- **Input Sanitization**: HTML sanitization with sanitize-html
- **Credential Management**: Automated credential scanning and cleanup
- **Audit Logging**: Comprehensive audit trail for all operations

### Security Commands
```bash
pnpm security:check       # Check for exposed credentials
pnpm security:fix         # Sanitize and fix security issues
pnpm security:sanitize-logs # Clean build logs of sensitive data
```

## 🤖 AI & Machine Learning

### AI Capabilities
- **Multi-Model Support**: OpenAI GPT, Google GenAI, local TensorFlow models
- **Bias Detection**: Python-based bias detection service with ML pipeline
- **Mental Health Analysis**: Specialized models for mental health insights
- **Dialogue Generation**: Automated conversation and training dialogue creation
- **Performance Monitoring**: Real-time AI model performance tracking

### AI-Specific Commands
```bash
pnpm initialize-models     # Initialize cognitive AI models
pnpm generate-dialogues    # Generate training dialogues
pnpm batch-generate-dialogues # Batch dialogue generation
pnpm validate-dialogues    # Validate dialogue quality
pnpm dialogue-pipeline     # Run full dialogue processing pipeline
pnpm test:performance      # Load test bias detection service
```

## 📊 Analytics & Monitoring

### Monitoring Stack
- **Error Tracking**: Sentry for real-time error monitoring
- **Performance**: Built-in Astro performance monitoring
- **Analytics**: Custom analytics service with privacy focus
- **Health Checks**: Automated service health monitoring
- **Audit Logs**: Comprehensive logging for compliance

### Performance Tools
```bash
pnpm performance:lighthouse # Generate Lighthouse reports
pnpm performance:audit     # Automated performance auditing
pnpm build:analyze         # Bundle size analysis
pnpm analyze:bundle        # Detailed bundle analysis
pnpm benchmark             # Performance benchmarking
```

## 🚢 Deployment

### Deployment Targets
- **Staging**: `pnpm deploy` - Deploy to staging environment
- **Production**: `pnpm deploy:prod` - Deploy to production
- **Vercel**: `pnpm deploy:vercel` - Deploy to Vercel platform
- **Enhanced Deploy**: Enhanced deployment with rollback support

### Deployment Commands
```bash
pnpm deploy                # Deploy to staging
pnpm deploy:prod          # Deploy to production  
pnpm deploy:enhanced      # Enhanced deployment to staging
pnpm rollback             # Rollback staging deployment
pnpm rollback:prod        # Rollback production deployment
```

## 📝 Content Management

### Blog & Documentation
```bash
pnpm blog                 # Start blog management interface
pnpm blog-publisher       # Publish blog posts
pnpm schedule-posts       # Schedule blog post publishing
```

### Version & Tag Management
```bash
pnpm version:release      # Create new version release
pnpm version:info         # Display version information
pnpm tags:create          # Create content tags
pnpm tags:list            # List all tags  
pnpm tags:validate        # Validate tag structure
pnpm tags:cleanup         # Cleanup unused tags
pnpm tags:maintenance     # Full tag maintenance
```

## 🔄 Development Best Practices

### Code Quality
- **TypeScript Strict Mode**: Full type safety across the codebase
- **ESLint + Prettier**: Consistent code formatting and linting
- **Pre-commit Hooks**: Automated quality checks before commits
- **Code Guidelines**: Detailed guidelines in `.clinerules/`

### AI Ethics & Bias Prevention
- **Bias Detection Pipeline**: Automated bias detection in AI responses
- **Ethical Guidelines**: Built-in ethical constraints for AI interactions
- **Privacy by Design**: Data minimization and user privacy protection
- **Accessibility**: Full WCAG compliance with axe-core testing

### Performance Optimization
- **Bundle Splitting**: Optimized code splitting for better load times  
- **Image Optimization**: Automated image optimization pipeline
- **Caching Strategy**: Multi-layer caching with Redis and CDN
- **Memory Management**: Efficient memory usage patterns

## 🤝 Contributing

### Development Setup
1. **Clone and Install**: `pnpm install` to install dependencies
2. **Environment Setup**: Copy `.env.example` to `.env` and configure
3. **Database Setup**: Run `pnpm mongodb:init` to initialize MongoDB
4. **Start Services**: Run `pnpm dev:all-services` to start all services
5. **Run Tests**: Execute `pnpm test:all` to verify setup

### Code Guidelines
- Follow the established patterns in `src/lib/` for business logic
- Use TypeScript strict mode for all new code
- Write tests for new features and bug fixes
- Follow the component structure patterns in `src/components/`
- Document AI-related code thoroughly due to complexity

## 📚 Documentation

- **API Documentation**: Available at `/docs` route when running locally
- **Component Documentation**: Inline JSDoc comments throughout components
- **Architecture Decisions**: Documented in `.notes/` directory
- **Security Guidelines**: See `scripts/security-scan.sh` and related docs
- **AI Model Documentation**: In `src/lib/ai/` with detailed implementation notes

---

This project represents a comprehensive approach to AI-powered mental health technology with strong emphasis on ethics, security, and user privacy. The modular architecture supports both development efficiency and production scalability.

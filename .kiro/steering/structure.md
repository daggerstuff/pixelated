# Project Structure

## Root Level Organization

```
pixelated/
├── src/                    # Main Astro application
├── ai/                     # Python AI services and models
├── api/                    # API routes and handlers
├── docker/                 # Container configurations
├── scripts/                # Build and deployment scripts
├── docs/                   # Documentation
├── tests/                  # Test suites
├── public/                 # Static assets
├── .kiro/                  # Kiro AI assistant configuration
├── .github/                # GitHub workflows and templates
├── astro.config.mjs        # Astro configuration
├── package.json            # Node.js dependencies and scripts
├── pyproject.toml          # Python dependencies and configuration
└── docker-compose.yml      # Local development services
```

## Source Directory (`/src`)

### Core Application Structure
- **`/components`**: React components organized by feature/domain
  - `/admin`: Administrative interface components
  - `/ai`: AI-related UI components
  - `/auth`: Authentication components
  - `/chat`: Chat interface components
  - `/dashboard`: Dashboard and analytics components
  - `/ui`: Reusable UI components (buttons, forms, etc.)
  - `/therapy`: Therapy-specific components
  - `/training`: Training session components

- **`/pages`**: Astro pages and API routes
  - `/api`: Server-side API endpoints
  - `/admin`: Admin dashboard pages
  - `/dashboard`: User dashboard pages
  - `/training`: Training session pages
  - `/demo`: Demo and showcase pages

- **`/layouts`**: Astro layout components
  - `BaseLayout.astro`: Core layout with head, navigation
  - `DashboardLayout.astro`: Dashboard-specific layout
  - `AuthLayout.astro`: Authentication pages layout
  - `AdminLayout.astro`: Admin interface layout

- **`/lib`**: Core business logic and utilities
  - `/ai`: AI service integrations and models
  - `/auth`: Authentication logic
  - `/database`: Database connections and queries
  - `/services`: External service integrations
  - `/utils`: Shared utility functions
  - `/types`: TypeScript type definitions

### Key Subdirectories

#### `/lib` Organization
```
lib/
├── ai/                     # AI services and models
│   ├── bias-detection/     # Bias detection algorithms
│   ├── datasets/           # Dataset management
│   ├── services/           # AI service clients
│   └── models/             # ML model definitions
├── auth/                   # Authentication logic
├── database/               # Database connections
├── services/               # External service integrations
├── utils/                  # Shared utilities
├── types/                  # TypeScript definitions
├── security/               # Security utilities
├── monitoring/             # Monitoring and analytics
└── memory/                 # Conversation memory system
```

#### `/components` Organization
```
components/
├── ui/                     # Base UI components
├── admin/                  # Admin-specific components
├── ai/                     # AI interface components
├── auth/                   # Authentication components
├── chat/                   # Chat interface
├── dashboard/              # Dashboard components
├── therapy/                # Therapy-specific UI
├── training/               # Training components
├── analytics/              # Analytics components
└── common/                 # Shared components
```

## AI Services (`/ai`)

Python-based AI services with their own structure:
```
ai/
├── api/                    # FastAPI service endpoints
├── models/                 # ML model definitions
├── datasets/               # Dataset processing
├── training/               # Model training scripts
├── services/               # AI service implementations
├── utils/                  # Python utilities
├── tests/                  # Python tests
├── config/                 # Configuration files
└── main.py                 # Main service entry point
```

## Configuration Files

### Key Configuration
- **`astro.config.mjs`**: Astro framework configuration
- **`tsconfig.json`**: TypeScript compiler configuration
- **`package.json`**: Node.js dependencies and scripts
- **`pyproject.toml`**: Python dependencies and tools
- **`docker-compose.yml`**: Local development services
- **`uno.config.ts`**: UnoCSS styling configuration
- **`vitest.config.ts`**: Testing configuration

### Environment & Deployment
- **`.env.example`**: Environment variable template
- **`Dockerfile`**: Container build configuration
- **`/docker`**: Service-specific Docker configurations
- **`/k8s`**: Kubernetes deployment manifests
- **`/terraform`**: Infrastructure as code

## Import Path Conventions

### TypeScript/JavaScript
```typescript
// Absolute imports using @ alias
import { Component } from '@/components/ui/Component'
import { utility } from '@/lib/utils/utility'
import type { User } from '@/types/user'

// Relative imports for same directory
import { helper } from './helper'
```

### File Naming Conventions
- **Components**: PascalCase (`UserProfile.tsx`, `ChatInterface.astro`)
- **Utilities**: camelCase (`formatDate.ts`, `apiClient.ts`)
- **Pages**: kebab-case (`user-settings.astro`, `training-session.astro`)
- **Types**: camelCase with `.types.ts` suffix (`user.types.ts`)
- **Tests**: Same as source with `.test.ts` or `.spec.ts`

## Special Directories

### Configuration & Tooling
- **`.kiro/`**: Kiro AI assistant configuration and steering
- **`.github/`**: GitHub Actions workflows and templates
- **`.vscode/`**: VS Code workspace settings
- **`scripts/`**: Build, deployment, and utility scripts
- **`docs/`**: Project documentation

### Data & Assets
- **`public/`**: Static assets served directly
- **`templates/`**: Email and document templates
- **`data/`**: Static data files and fixtures
- **`logs/`**: Application logs (gitignored)
- **`tmp/`**: Temporary files (gitignored)

## Development Workflow

### Feature Development
1. Create feature branch from main
2. Implement in appropriate `/src` subdirectory
3. Add tests in corresponding test directory
4. Update types in `/src/types` if needed
5. Run `pnpm check:all` before committing

### Component Development
1. Create component in appropriate `/src/components` subdirectory
2. Co-locate tests, styles, and related files
3. Export from index file for clean imports
4. Document props and usage in JSDoc comments
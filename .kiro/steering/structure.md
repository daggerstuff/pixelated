# Project Structure & Organization

## Root Directory Layout
```
pixelated/
├── src/                    # Frontend Astro/React application
├── ai/                     # Python AI/ML services and pipelines
├── scripts/                # Build, deployment, and utility scripts
├── docker/                 # Docker configurations for services
├── docs/                   # Project documentation
├── tests/                  # E2E and integration tests
└── .kiro/                  # Kiro AI assistant configuration
```

## Frontend Structure (`src/`)
```
src/
├── components/             # React components organized by domain
│   ├── admin/             # Admin dashboard components
│   ├── ai/                # AI chat and interaction components
│   ├── auth/              # Authentication components
│   ├── chat/              # Chat interface components
│   ├── dashboard/         # User dashboard components
│   └── ui/                # Reusable UI components
├── pages/                 # Astro pages (file-based routing)
│   ├── api/               # API routes
│   ├── admin/             # Admin pages
│   ├── dashboard/         # User dashboard pages
│   └── [dynamic].astro    # Dynamic routes
├── layouts/               # Page layout components
├── lib/                   # Shared utilities and services
│   ├── ai/                # AI service integrations
│   ├── auth/              # Authentication logic
│   ├── db/                # Database utilities
│   ├── security/          # Security and encryption
│   └── utils/             # General utilities
├── hooks/                 # React hooks
├── types/                 # TypeScript type definitions
└── styles/                # Global styles and themes
```

## AI/ML Structure (`ai/`)
```
ai/
├── dataset_pipeline/      # Data processing and preparation
├── models/                # ML model definitions and training
├── inference/             # Model inference services
├── monitoring/            # Quality and performance monitoring
├── safety/                # Safety validation and compliance
├── security/              # Security testing and validation
├── api/                   # Python API services
├── scripts/               # AI-specific utility scripts
└── tests/                 # Python unit and integration tests
```

## Configuration Files
- **Frontend**: `astro.config.mjs`, `tsconfig.json`, `tailwind.config.ts`
- **Python**: `pyproject.toml`, `ai/pyproject.toml`
- **Docker**: `docker-compose.yml`, `Dockerfile`, `docker/*/`
- **CI/CD**: `azure-pipelines.yml`, `.github/workflows/`
- **Quality**: `.eslintrc.js`, `.prettierrc`, `pytest.ini`

## Naming Conventions

### Files & Directories
- **Components**: PascalCase (`UserDashboard.tsx`)
- **Pages**: kebab-case (`mental-health-chat.astro`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Python modules**: snake_case (`bias_detection.py`)
- **Directories**: kebab-case for pages, camelCase for components

### Code Conventions
- **React Components**: PascalCase with descriptive names
- **Functions**: camelCase, verb-based (`getUserData`, `validateInput`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`)
- **Types/Interfaces**: PascalCase with descriptive suffixes (`UserData`, `ApiResponse`)

## Import Aliases
```typescript
// Configured in tsconfig.json
import { Component } from '~/components/Component'
import { utility } from '@/lib/utils'
import { Layout } from '@layouts/Layout'
```

## Key Architectural Patterns

### Frontend
- **Component Organization**: Domain-driven folders under `components/`
- **State Management**: Zustand for global state, React hooks for local state
- **API Integration**: Centralized in `src/lib/api/`
- **Type Safety**: Strict TypeScript with comprehensive type definitions

### Backend/AI
- **Microservices**: Separate services for bias detection, AI inference, analytics
- **Data Pipeline**: Modular processing in `dataset_pipeline/`
- **Safety First**: Comprehensive validation and monitoring systems
- **Testing**: Extensive test coverage for critical AI components

### Security & Compliance
- **Encryption**: FHE implementation in `src/lib/fhe/`
- **Audit Trails**: Comprehensive logging and monitoring
- **HIPAA Compliance**: Dedicated compliance validation systems
- **Bias Detection**: Real-time monitoring and reporting
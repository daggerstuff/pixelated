---
applyTo: '**'
description: 'Project structure and organization rules for Pixelated Empathy'
---

# Project Structure & Organization

## Directory Structure Rules

### Root Organization
- `src/` - Frontend Astro/React application
- `ai/` - Python AI/ML services and pipelines  
- `scripts/` - Build, deployment, and utility scripts
- `docker/` - Service-specific Docker configurations
- `docs/` - Project documentation
- `tests/` - E2E and integration tests

### Frontend Structure (`src/`)
- `components/` - Domain-organized React components (admin/, ai/, auth/, chat/, dashboard/, ui/)
- `pages/` - Astro file-based routing with API routes in `pages/api/`
- `layouts/` - Page layout components
- `lib/` - Shared utilities organized by domain (ai/, auth/, db/, security/, utils/)
- `hooks/` - Custom React hooks
- `types/` - TypeScript type definitions
- `styles/` - Global styles and themes

### AI/ML Structure (`ai/`)
- `dataset_pipeline/` - Data processing and preparation
- `models/` - ML model definitions and training
- `inference/` - Model inference services
- `monitoring/` - Quality and performance monitoring
- `safety/` - Safety validation and compliance
- `security/` - Security testing and validation
- `api/` - Python API services

## File Placement Rules

### When creating new files:
1. **Components**: Place in domain-specific folders under `src/components/`
2. **Pages**: Use kebab-case in `src/pages/` following Astro conventions
3. **Utilities**: Place in appropriate `src/lib/` subdirectory
4. **Types**: Define in `src/types/` or co-locate with components
5. **AI Services**: Place in appropriate `ai/` subdirectory
6. **Tests**: Mirror source structure in `tests/` or `ai/tests/`

## Naming Conventions (Strictly Enforced)

### Files & Directories
- **React Components**: PascalCase (`BiasDetectionEngine.tsx`)
- **Astro Pages**: kebab-case (`mental-health-chat.astro`)
- **Utilities**: camelCase (`formatTherapeuticData.ts`)
- **Python modules**: snake_case (`bias_detection_engine.py`)
- **Directories**: kebab-case for pages, camelCase for component folders

### Code Identifiers
- **Components**: PascalCase with descriptive names (`TherapeuticSessionManager`)
- **Functions**: camelCase, verb-based (`validateTherapeuticInput`, `processEmotionalData`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_SESSION_DURATION`, `BIAS_THRESHOLD`)
- **Types/Interfaces**: PascalCase with suffixes (`TherapeuticSessionData`, `BiasDetectionResult`)

## Import Path Rules

Use configured aliases consistently:
```typescript
import { Component } from '~/components/Component'     // src/components
import { utility } from '@/lib/utils'                 // src/lib
import { Layout } from '@layouts/Layout'              // src/layouts
```

## Architectural Patterns (Must Follow)

### Component Organization
- Group components by domain/feature, not by type
- Place reusable UI components in `src/components/ui/`
- Co-locate component-specific types and utilities

### State Management
- Use Zustand for global application state
- Use React hooks for local component state
- Centralize API calls in `src/lib/api/`

### Security & Compliance Integration
- All sensitive data handling must use `src/lib/fhe/` encryption
- Implement audit trails for therapeutic interactions
- Use bias detection services from `ai/monitoring/`
- Follow HIPAA compliance patterns in `src/lib/security/`

### AI Service Integration
- AI services communicate through dedicated API endpoints
- Use microservice pattern for bias detection, inference, analytics
- Implement comprehensive monitoring and safety validation
- Maintain <50ms response time requirements for conversational AI

## Configuration File Locations
- Frontend: `astro.config.mjs`, `tsconfig.json`, `tailwind.config.ts`
- Python: `pyproject.toml`, `ai/pyproject.toml`
- Docker: `docker-compose.yml`, service-specific in `docker/*/`
- CI/CD: `azure-pipelines.yml`, `.github/workflows/`
- Quality: `.eslintrc.js`, `.prettierrc`, `pytest.ini`
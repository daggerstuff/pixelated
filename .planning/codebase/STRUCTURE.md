# Codebase Structure

**Analysis Date:** 2025-02-17

## Directory Layout

```
pixelated/
├── src/                    # Main application source
├── ai/                     # AI/ML services and training
├── config/                 # Configuration files
├── tests/                  # Test suites and configurations
├── docker/                 # Docker configurations
├── scripts/                # Build and utility scripts
├── docs/                   # Documentation
├── public/                 # Static assets
└── .agent/                 # AI agent configurations
```

## Directory Purposes

**src/:**

- Purpose: Main application code
- Contains: Astro pages, React components, services, utilities
- Key files: `src/pages/`, `src/components/`, `src/lib/`

**ai/:**

- Purpose: AI/ML processing and training
- Contains: Python services, model training, bias detection
- Key files: `ai/training/`, `ai/academic_sourcing/`

**config/:**

- Purpose: Build and runtime configuration
- Contains: TypeScript, Vitest, Playwright configs
- Key files: `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`

**tests/:**

- Purpose: Test suites and configurations
- Contains: Unit tests, integration tests, e2e tests
- Key files: `tests/unit/`, `tests/integration/`, `tests/e2e/`

**docker/:**

- Purpose: Container configurations
- Contains: Dockerfiles, compose configurations
- Key files: `docker/Dockerfile`, `docker-compose.yml`

## Key File Locations

**Entry Points:**

- `src/pages/index.astro` - Main landing page
- `src/pages/api/*` - API routes
- `src/server.ts` - WebSocket server
- `ai/academic_sourcing/api/main.py` - Python AI service

**Configuration:**

- `astro.config.mjs` - Astro configuration
- `package.json` - Node.js dependencies and scripts
- `pyproject.toml` - Python dependencies
- `.env.example` - Environment template

**Core Logic:**

- `src/lib/ai/` - AI service integrations
- `src/lib/services/` - Business logic services
- `src/lib/security/` - Security implementations
- `src/components/ui/` - Reusable UI components

**Testing:**

- `src/tests/` - Unit tests co-located with source
- `tests/` - Integration and e2e tests
- `config/vitest.config.ts` - Test configuration

## Naming Conventions

**Files:**

- Components: PascalCase (e.g., `Button.tsx`, `UserProfile.tsx`)
- Utilities: camelCase (e.g., `formatDate.ts`, `validateInput.ts`)
- Pages: kebab-case for Astro (e.g., `user-dashboard.astro`)
- Tests: Co-located with `.test.ts` suffix

**Directories:**

- Components: PascalCase for component directories
- Utilities: camelCase for utility directories
- Features: kebab-case for feature directories

## Where to Add New Code

**New Feature:**

- Primary code: `src/components/[feature-name]/`
- Business logic: `src/lib/services/[feature-name]/`
- API endpoints: `src/pages/api/[feature-name]/`
- Tests: `src/tests/[feature-name]/` or co-located `.test.ts`

**New Component/Module:**

- React components: `src/components/[category]/[ComponentName]/`
- Utilities: `src/utils/[utility-name].ts`
- Services: `src/lib/services/[service-name]/`
- Hooks: `src/hooks/[hook-name].ts`

**Utilities:**

- Shared helpers: `src/utils/`
- Type definitions: `src/types/`
- Constants: `src/constants/`
- Configuration: `src/config/`

## Special Directories

**src/pages/:**

- Purpose: Astro file-based routing
- Generated: No (hand-written)
- Committed: Yes

**src/content-store/:**

- Purpose: MDX content and documentation
- Generated: Partially (content collections)
- Committed: Yes

**src/components/:**

- Purpose: Reusable React components
- Generated: No
- Committed: Yes

**node_modules/:**

- Purpose: Dependencies
- Generated: Yes (by pnpm install)
- Committed: No (gitignored)

---

_Structure analysis: 2025-02-17_

# Astro 7 Platform Modernization & API Extraction

## Goal

Modernize the Pixelated Empathy platform by fully leveraging Astro 7 features
(Sätteri, `src/fetch.ts`, JSX strictness) while extracting heavy AI/ML compute
into a dedicated FastAPI microservice, explicitly abandoning the Vite SPA
rewrite.

## Constraints

- Retain Astro 7 as the core frontend and BFF (Backend-for-Frontend).
- Do not rewrite existing React UI components to a new SPA.
- FastAPI is strictly for Python/ML/AI operations, not simple CRUD.
- No regressions in HIPAA compliance or data boundaries.

## Phases

### Phase 1: Astro 7 JSX-Strictness & Rust Compiler Audit

- **Goal**: Ensure the codebase compiles correctly under Astro 7's new Rust
  compiler (no unclosed tags, strict JSX whitespace).
- **Files**: All `src/**/*.astro` files.
- **Verification**: `pnpm typecheck` and `pnpm build` pass without markup or
  build errors.

### Phase 2: Markdown Pipeline Optimization (Sätteri)

- **Goal**: Remove legacy unified/remark plugins (`remark-gfm`, `remark-math`)
  and enable Sätteri features in Astro config.
- **Files**: `astro.config.mjs`, `package.json`
- **Verification**: `pnpm build` shows significantly reduced times; MDX/Markdown
  rendering still correctly handles GFM/Math in tests.

### Phase 3: Advanced Routing & Auth Gateway

- **Goal**: Implement `src/fetch.ts` to act as the centralized API gateway and
  HIPAA Auth interceptor.
- **Files**: `src/fetch.ts`, existing server endpoints.
- **Verification**: E2E tests for authentication
  (`pnpm exec playwright test tests/e2e/infrastructure/ssr-functionality.spec.ts`)
  pass.

### Phase 4: FastAPI AI Service Extraction [COMPLETED]

- **Goal**: Extract Foresight memory hooks and clinical evaluation pipelines
  from Node.js into the FastAPI microservice.
- **Files**: Python `backend/`, `src/pages/api/*`
- **Verification**: `pytest` passes on the Python backend; Astro app
  successfully proxies AI requests downstream.

### Phase 5: AI Enhancements & Route Caching [COMPLETED]

- **Goal**: Enable Astro 7's JSON logging and background dev server for
  automated AI agent CI. Configure CDN route caching for static assets.
- **Files**: `astro.config.mjs`, `package.json` scripts
- **Verification**: `pnpm dev:ci` successfully outputs JSON logs when flagged;
  static pages serve with cache headers.

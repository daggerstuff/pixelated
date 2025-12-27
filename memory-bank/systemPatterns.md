# System Patterns

## Architecture Overview
Pixelated Empathy uses a service-oriented architecture with clear separation between the web UI, API layer, AI/research pipelines, and persistence.

### High-Level Flow
- Client (Astro + React) communicates with the API layer over HTTP and (where applicable) WebSockets.
- API layer routes to domain services (auth, sessions, analytics) and integrates with AI services/pipelines.
- Data is stored in primary persistence (document + relational where needed) and cached for performance.

### Core Layers
- Frontend: Astro 5.x + React 19, WCAG 2.1 AA requirements
- API Layer: Node.js 24+ TypeScript services, request validation, rate limiting
- AI/ML: Python services and pipelines (dataset preparation, evaluation, traceability)
- Data Layer: document store + relational store + cache (as configured)

## Design Patterns
- Service boundaries: keep session state, analytics, and AI workflows decoupled
- Validation at boundaries: treat inputs as sensitive; validate and normalize (especially emotion scores 0–1)
- Defense-in-depth privacy: never log secrets/PII; ensure safe handling of mental-health data
- Observability: structured logging, error tracking, and health checks. Core modules such as `src/config.ts` and `src/types.ts` initialize a build-safe logger (`phi-audit`) to record PHI-related config and type access for HIPAA auditing.

## Operational Conventions
- Node package manager: `pnpm` only
- Python package manager: `uv` only
- Prefer test-driven development and keep docs/memory updated after material changes

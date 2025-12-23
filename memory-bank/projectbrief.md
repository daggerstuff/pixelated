# Project Brief: Pixelated Empathy

## Project Overview
Pixelated Empathy is an AI-first training simulation platform for mental health professionals. It provides a zero-risk environment to practice difficult therapeutic scenarios (crisis intervention, trauma response, cultural competency) with real-time feedback, bias detection, and progress analytics.

## Core Goals
- Deliver realistic, psychologically safe client simulations for therapist training
- Provide real-time conversation analysis, feedback, and bias detection grounded in established frameworks
- Maintain HIPAA++ grade privacy and security practices (no secrets/PII leakage, robust validation, auditability)
- Build scalable infrastructure for concurrent training sessions and research workflows

## Project Scope
- Training sessions with AI-simulated clients (scenario library, session management, transcripts)
- Real-time feedback (intervention suggestions, tone/approach analysis, bias alerts)
- Performance analytics and progress tracking
- Supervisor review tools
- Research/data pipeline work for safe dataset creation and validation (including expert validation datasets)

## Key Deliverables
- Production-ready web app (Astro + React) for training sessions and dashboards
- Node/TypeScript backend services + Python AI pipeline tooling
- Comprehensive test suite and CI checks
- Documentation and memory systems kept in sync (`.memory/` is source-of-truth; `memory-bank/` mirrors it)

## Technology Stack (Authoritative)
- Frontend: Astro 5.x + React 19, TypeScript
- Backend: Node.js 24+ (TypeScript) with PHI-aware logging in core modules (`src/config.ts`, `src/types.ts`) via a build-safe logger configured for `phi-audit`
- Python tooling: Python 3.11+ with `uv`
- Package managers: `pnpm` (Node) and `uv` (Python) only
- Observability: Sentry (plus broader monitoring where applicable) and structured PHI audit logging in TypeScript code

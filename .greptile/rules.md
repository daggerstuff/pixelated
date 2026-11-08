# Greptile Code Review Rules for Pixelated Empathy

## 1. Clinical Privacy & HIPAA Compliance (Zero Tolerance)
* Never allow PHI (Protected Health Information) or PII to be logged, serialized into unencrypted stores, or emitted in error responses.
* Medical record numbers (MRNs), patient identifiers, psychiatric notes, and clinical transcripts must be protected by field-level encryption or tenant isolation.
* Test fixtures must use synthetic, non-identifiable data only.

## 2. Anti-Suppression Policy (Blocking)
* **TypeScript / JavaScript**: Strictly flag any `@ts-ignore`, `@ts-expect-error`,
  `@ts-nocheck`, or `/* eslint-disable */`. Fix the underlying type signature or
  runtime interface instead.
* **Python**: Strictly flag `# noqa`, `# type: ignore`, or `# pylint: disable`. Fix typing and linter issues at source.
* Never downgrade linter or compiler strictness configs.

## 3. Technology Stack & Architectural Constraints
* **Frontend**: Astro 6 + React 19 (TypeScript, Tailwind CSS). Do NOT use `tsc` or `astro check` (causes OOM); the repository uses type-aware oxlint.
* **Backend**: Python 3.14+ managed via `uv`, linted via `ruff`.
* **Database & Multi-Tenancy**: PostgreSQL 17 + pgvector. Every EHR/clinical query must enforce tenant isolation (`tenant_id`) and Row-Level Security (RLS).
* **Memory & AI Services**: Foresight MCP / vector storage. Guard against unbounded memory consumption and excessive model token burn.

## 4. Concurrency, Async & Error Handling
* Ensure all async operations (Promises, Python `async def`) handle rejected states and error propagation gracefully.
* Ensure database connections, file handles, and stream readers are properly closed (e.g. `using`, `try...finally`, or context managers).
* Reject silent error swallowing (empty `catch {}` blocks).

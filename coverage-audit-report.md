# Test Coverage Infrastructure Audit

**Date:** 2026-05-21
**Auditor:** Sisyphus
**Scope:** TypeScript (vitest/v8) + Python (pytest/coverage) coverage infrastructure

## Executive Summary

The project has a mature but fragmented test infrastructure with 282 test files spanning TypeScript unit/integration tests, Python service tests, E2E tests, and security/compliance suites. Coverage tooling is configured for both languages but full-suite execution hangs due to a known CPU-bound test issue.

## Test Inventory

| Category | Count | Framework | Config |
|---|---|---|---|
| TypeScript unit tests | ~120 | vitest v4.1.6 | `config/vitest.config.ts` |
| TypeScript integration tests | ~15 | vitest | `tests/integration/` |
| TypeScript E2E tests | ~20 | vitest/Playwright | `tests/e2e/` |
| Python unit tests | ~15 | pytest 9.0.3 | `pyproject.toml` |
| Python integration tests | ~10 | pytest | `tests/integration/` |
| Compliance/security tests | ~25 | vitest + Node | `scripts/consolidated-test.js` |
| Load/performance tests | ~5 | vitest/Playwright | `tests/load.test.js` |
| Agent tests | ~10 | vitest | `tests/agent/` |
| Bias detection tests | ~10 | vitest | `src/lib/ai/bias-detection/` |
| Crisis detection tests | ~5 | vitest | `tests/crisis-detection/` |

## Coverage Configuration

### TypeScript (vitest/v8)

- **Provider:** `@vitest/coverage-v8`
- **Command:** `pnpm run test:coverage` (runs full suite with `--coverage`)
- **Targeted command:** `pnpm vitest run -c config/vitest.config.ts --coverage <path>`
- **Measured coverage:** `src/lib/utils/` subset = 70.82% statements, 60.56% branches, 79.16% functions

### Python (pytest/coverage)

- **Provider:** `coverage` via `pyproject.toml`
- **Source dirs:** `src`, `ai`
- **Branch tracking:** enabled
- **Fail threshold:** 70%
- **Exclusions:** `pragma: no cover`, `__repr__`, `TYPE_CHECKING`, `@abstractmethod`, `__main__`
- **Command:** `uv run pytest` (no coverage flag by default)

## Known Issues

### 1. Full Coverage Suite Hangs

Running `pnpm run test:coverage` hangs indefinitely due to at least one test consuming 100% CPU. This is a known issue documented in `AGENTS.md`.

**Workaround:** Use `VITEST_TARGET_TESTS` environment variable or run targeted subsets:
```bash
pnpm vitest run -c config/vitest.config.ts --coverage src/lib/utils/
```

### 2. Vite Version Mismatch

Vite 8 is in `package.json` but Astro 6 expects Vite 7. The dev server works but logs deprecation warnings. This does not affect test execution.

### 3. Redis Integration Tests Require Local Override

Tests attempting to connect to Upstash Redis will hang on DNS lookups without local override:
```bash
REDIS_URL=redis://localhost:6379/0 \
UPSTASH_REDIS_REST_URL=redis://localhost:6379/0 \
pnpm vitest run -c config/vitest.config.ts
```

### 4. No Unified Coverage Report

TypeScript and Python coverage are run separately with no aggregation. There is no single dashboard or consolidated coverage metric.

## Coverage Gaps by Area

| Area | Estimated Coverage | Notes |
|---|---|---|
| `src/lib/utils/` | 70.82% | Measured; `index.ts` at 0% |
| `src/lib/ai/bias-detection/` | Unknown | Has dedicated test suite |
| `src/lib/services/redis/` | Unknown | Requires local Redis container |
| `src/components/` | Unknown | Component tests exist but coverage not measured |
| `ai/training/` | Unknown | Python tests exist for `dedup_normalize.py` |
| `ai/inference/` | Unknown | Limited test coverage |
| `src/pages/api/` | Unknown | API contract tests exist |
| `scripts/` | Partial | `task_sync/provider_bridge.py` has 40 passing tests |

## Recommendations

1. **Fix the hanging test** — Identify and isolate the CPU-bound test blocking full coverage runs
2. **Add coverage thresholds** — Set `coverage.thresholds` in `vitest.config.ts` to enforce minimum coverage
3. **Consolidate reporting** — Create a single script that runs both TS and Python coverage and merges results
4. **Cover `index.ts`** — The `src/lib/utils/index.ts` file shows 0% coverage; add re-export tests
5. **CI integration** — Add coverage reporting to CI pipeline with trend tracking

## Test Execution Commands

| Command | Scope | Coverage |
|---|---|---|
| `pnpm test:unit` | All vitest tests | Yes |
| `pnpm test:integration` | Integration tests only | No |
| `pnpm test:coverage` | Full suite | Yes (hangs) |
| `pnpm test:evals` | Python eval tests | No |
| `pnpm test:hipaa` | HIPAA compliance | No |
| `pnpm test:bias-detection` | Bias detection module | No |
| `uv run pytest` | All Python tests | No |
| `uv run pytest tests/python/` | Python unit tests | No |

# Coverage Audit Report

- Python: `937 passed, 23 skipped` with `fail_under = 20` in `pyproject.toml`
  (baseline measured ~21% for `src` + `ai`).
- TypeScript governance/audit/fhe/security suites pass via `VITEST_BUCKET=1`
  scoped execution; full-suite baseline thresholds remain 55 lines / 55
  statements / 55 functions / 45 branches in `vitest.config.ts`.
- HIPAA and security suites exist per the test coverage plan.

Generated 2026-10-21.

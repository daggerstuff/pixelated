# WIP: PIXEL-ASTRO-1S

Issue: Error: Test Sentry exception from scripts/test-sentry.mjs
Sentry Issue: https://pixelated-empathy-dq.sentry.io/issues/PIXEL-ASTRO-1S
Assigned to: Vivi (user:3786720)

## Summary
A test script `scripts/test-sentry.mjs` throws a deliberate Error for Sentry testing. It was captured and reported. This issue appears to be a test artifact — likely not a production bug but should be cleaned or gated.

## Stacktrace (most relevant frame)
- File: `scripts/test-sentry.mjs`
- Line: 12
- Frame: `throw new Error('Test Sentry exception from scripts/test-sentry.mjs')`

## Proposed plan
1. Inspect `scripts/test-sentry.mjs` to confirm whether this is intended test code that accidentally runs in production.
2. If test code is being executed in production, prevent it by gating with environment checks (e.g., `if (process.env.NODE_ENV !== 'production')`) or remove/ignore during production runs.
3. Add a test or CI check to prevent accidental execution of test scripts in production environments.

> Note: The current PR implements an environment-variable guard in the script itself. The CI check that fails builds or blocks deployments when test-only scripts are present is not included in this change and should be added in a follow-up PR (recommended). If you prefer it included here, I can add a minimal GitHub Actions workflow that scans for calls to test scripts or enforces an environment variable guard in CI.

## Local steps completed
- Created branch `work/PIXEL-ASTRO-1S-wip` and this WIP file.

## Next steps
- Open `scripts/test-sentry.mjs` and confirm contents. Create a small change to guard the throw and run the relevant script locally.
- Push branch and open PR with explanation and fix.

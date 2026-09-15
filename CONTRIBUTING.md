# Contributing to Pixelated Empathy

Thank you for contributing. This is a clinical AI platform handling sensitive
therapeutic data — quality and security matter.

## Getting Started

1. Fork and clone the repository
2. Run `./scripts/setup-dev.sh` to install dependencies and start local
   databases
3. Verify: `pnpm dev` should start the app on http://localhost:5173

See [WALKTHROUGH.md](WALKTHROUGH.md) for the full developer guide.

## Branch Naming

- `feat/short-description` — new features
- `fix/short-description` — bug fixes
- `docs/short-description` — documentation
- `chore/short-description` — maintenance, config changes
- `refactor/short-description` — code restructuring

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add emotion timeline visualization
fix: resolve race condition in session save
docs: update WALKTHROUGH with troubleshooting section
chore: bump pnpm to 11.12.0
```

## Before Pushing

```bash
pnpm lint         # oxlint (type-aware)
pnpm format:check # formatting
pnpm lint:quality # code-quality audits (see below)
```

> **Do not use** `astro check`, `pnpm typecheck`, or `tsc` — they cause OOM failures.
> Use `pnpm lint` (type-aware oxlint) instead.

### Code-quality audits

These run in the [Quality workflow](.github/workflows/quality.yml) on every PR.
Each compares the repo against a pinned baseline and **fails only on
regression**, so existing debt is visible without blocking work. When a change
shrinks debt the baseline naturally allows the improvement; only re-pin after an
intentional change with `-- --update`.

| Command | Signal it enforces | Config / baseline |
| --- | --- | --- |
| `pnpm lint:boundaries` | Module boundaries & circular deps | `.dependency-cruiser.cjs`, `scripts/ci/boundaries-baseline.json` |
| `pnpm lint:duplication` | Duplicate code (DRY) | `.jscpd.json`, `scripts/ci/duplication-baseline.json` |
| `pnpm lint:complexity` | Cyclomatic complexity, nesting, unit size | `.oxlintrc.complexity.json`, `scripts/ci/complexity-baseline.json` |
| `pnpm lint:file-size` | Oversized files (TS/TSX/Astro/Python) | `scripts/ci/large-file-baseline.json` |
| `pnpm lint:tech-debt` | Untracked `TODO`/`FIXME` markers | `scripts/ci/tech-debt-baseline.json` |
| `pnpm lint:naming` | Naming conventions (TS/TSX) | `.eslintrc.naming.mjs`, `scripts/ci/naming-baseline.json` |

`pnpm lint:quality` runs all six. For Python, naming is enforced by ruff's `N`
(pep8-naming) rules and strict types by `pnpm typecheck:python`
(`scripts/ci/python-typecheck.sh`), which runs `mypy --strict` over the `pe`
service.

Link debt markers to a ticket (`// TODO(PIX-1234): ...`) so they stay findable;
see the [tech-debt audit](scripts/ci/tech-debt-audit.mjs).

Git hooks run automatically on commit and are managed by
[Husky](https://typicode.github.io/husky/). Installing dependencies
(`pnpm install`) runs the `prepare` script, which points
`core.hooksPath` at `.husky/_` and wires the version-controlled hooks in
`.husky/`. The tracked hooks delegate to the shared templates in
`scripts/devops/hooks/templates/`, so the same checks run locally and in
CI:

| Hook | Check |
| --- | --- |
| `pre-commit` | Staged secret scanning, lockfile sync, `lint-staged` (oxlint / ruff / markdownlint), markdownlint suppression guard |
| `commit-msg` | Conventional Commits format |
| `pre-rebase` | Blocks history rewrites of protected branches |
| `post-checkout` / `post-merge` | Re-syncs `pnpm-lock.yaml` / `uv.lock` when they change |

Never edit `.husky/_/` (generated, git-ignored) or `.git/hooks/` directly;
edit `.husky/<hook>` or the template in `scripts/devops/hooks/templates/`.

## Testing

```bash
pnpm test:unit          # unit tests
pnpm test:integration   # integration tests
pnpm e2e                # end-to-end (Playwright)
pnpm e2e:ui             # interactive E2E
```

### Test performance

`pnpm test:perf` runs a bounded hermetic slice of the Vitest suite with the JSON
reporter, prints the slowest files and tests, writes `.test-perf/summary.json`
and `.test-perf/summary.md`, and **fails when durations regress** past a pinned
budget (`scripts/ci/test-perf-baseline.json`). It runs in the
[Quality workflow](.github/workflows/quality.yml), publishes `summary.md` to the
step summary, and uploads the report as an artifact.

Only parallelism-independent metrics are gated — total per-test time
(`totalTestMs`, ×1.5) and the slowest single test (`maxTestMs`, ×2.0). Wall-clock
suite time is reported but never gated, because CI runs at `maxWorkers: 1` while
local runs use 8; per-test durations are stable across both.

- `pnpm test:perf -- --update` re-pins the baseline after an intentional change.
- `pnpm test:perf:report` re-renders the report from the last run without rerunning tests.

For Python, `uv run pytest` prints the 25 slowest tests by default
(`--durations=25` in `pyproject.toml`).

**Redis test note**: Override `REDIS_URL` and `UPSTASH_REDIS_REST_URL` to
`redis://localhost:6379/0` when running tests against local Docker. See
[WALKTHROUGH.md](WALKTHROUGH.md) for details.

### Test reliability

Three gates run in the [Quality workflow](.github/workflows/quality.yml) over
the same hermetic slice as `pnpm test:perf`, so the numbers are comparable:

| Command                  | Enforces                                                                 | Baseline                              |
| ------------------------ | ------------------------------------------------------------------------ | ------------------------------------- |
| `pnpm test:flaky`        | 3 repeat runs; any test whose outcome changes across identical runs fails | `scripts/ci/flaky-baseline.json`     |
| `pnpm test:isolation`    | Ordered vs `--sequence.shuffle` execution; every test must pass in both   | none (strict)                         |
| `pnpm test:coverage:gate`| Per-metric slice coverage stays within 5% of the pinned value and above an absolute floor | `scripts/ci/coverage-baseline.json` |

- `pnpm test:reliability` runs all three in sequence.
- Flaky tolerance list: a genuinely flaky external dependency can be pinned
  explicitly with `pnpm test:flaky -- --update`, but an empty list is the goal.
- Coverage: `pnpm test:coverage:gate -- --update` re-pins after adding tests.
  The global thresholds in `config/vitest.config.ts` target full
  (non-hermetic) runs; the gate ratchets the hermetic slice.
  **Keep `@vitest/coverage-v8` on the same major version as `vitest`** — a
  mismatch silently aborts coverage collection.

### Build performance

`pnpm build:perf` times the full production build and fails when it exceeds
1.25× the pinned baseline (`scripts/ci/build-perf-baseline.json`), so
build-time regressions fail CI instead of silently stretching every run.
`pnpm build:perf -- --update` re-pins after a deliberate build-time change.

## Security

- **Never** commit credentials, API keys, or patient data
- **Never** use `@ts-ignore`, `# noqa`, or `# type: ignore` to suppress issues
- Report vulnerabilities to
  [security@pixelatedempathy.com](mailto:security@pixelatedempathy.com)

All code changes run through the [Security workflow](.github/workflows/security.yml)
(Trivy image scanning, secret/misconfig scanners), and log payloads are
scrubbed automatically: the canonical logger redacts sensitive keys
(passwords, tokens, secrets, session IDs, PHI fields) and masks emails and
bearer credentials before anything reaches the console — see
[`apps/web/src/lib/logging/scrub.ts`](apps/web/src/lib/logging/scrub.ts). New
dependencies are additionally protected by a one-day
`minimumReleaseAge` in `pnpm-workspace.yaml` (malicious releases are usually
yanked within hours; day-one exceptions go in `minimumReleaseAgeExclude`).

### Feature flags

Flags are declared once in the registry
([`apps/web/src/lib/config/feature-flags.ts`](apps/web/src/lib/config/feature-flags.ts))
with an env override (`FEATURE_*`), a safe default (`false`), and a
description. Read them with `isFeatureEnabled('flagName')` — never read the env
var directly at the call site. Malformed env values never enable a flag.

`pnpm lint:flags` fails on dead flags: a new registry entry with no references,
or a flag that loses its last reference. Land registry entry and consumer in
the same change.

### Dependency health

Four ratcheted audits (see the [Quality workflow](.github/workflows/quality.yml));
each fails only on NEW problems, pinned in `scripts/ci/*-baseline.json`:

| Command                | Enforces                                                             |
| ---------------------- | -------------------------------------------------------------------- |
| `pnpm lint:heavy-deps` | Total install weight stays within 1.25× of the pinned baseline     |
| `pnpm lint:version-drift` | No package resolves to more distinct versions than pinned           |
| `pnpm lint:flags`      | No feature flag is born dead or loses its last reference             |
| `pnpm lint:unused-deps`| knip reports no NEW unused dependencies                              |

`pnpm lint:deps` runs all four. Each supports `-- --update` to re-pin after an
intentional change.

### Releases and deploys

- **Release notes**: pushing a `vX.Y.Z` tag verifies the tagged revision
  builds, then creates a GitHub Release with auto-generated notes
  ([release workflow](.github/workflows/release-notes.yml)).
- **Deploys** ([deploy-aws.yml](.github/workflows/deploy-aws.yml)): rollout
  status gates, a smoke test through the cluster service, and — if the smoke
  test fails — an automatic `kubectl rollout undo` of the app and agent
  deployments back to the previous revision.

## Python Code

All Python work lives in `ai/` and `tests/`. Use `uv` for dependency management:

```bash
uv run pytest           # run Python tests
uv run ruff check .     # lint Python code
uv run ruff format .    # format Python code
```

## AI Assistant Instructions

This repo includes `AGENTS.md` with detailed instructions for AI coding
assistants. If you're using an AI tool, it should pick up those conventions
automatically.

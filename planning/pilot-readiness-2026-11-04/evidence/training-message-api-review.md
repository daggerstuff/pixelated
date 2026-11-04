# Training message API and persistence review

Date: 2026-11-04

## Implemented locally

- The page uses an authenticated same-origin POST endpoint, compatible with the
  Astro Vercel function route used by the current production build.
- The endpoint checks the app session, exact request origin, valid session ID,
  message length, session ownership, training type and synthetic marker.
- `training_session_messages` stores bounded trainee messages. The existing
  owner-scoped session read returns the last 500 persisted messages on reload.
- The training response now includes its session ID.
- The page no longer claims an emergency button notified a supervisor. It
  identifies client replies, coaching analysis and supervisor alerts as
  inactive.

## Verification

- Focused route tests cover authenticated writes, ownership/synthetic SQL
  constraints, input bounds and reload readback.
- Targeted oxlint passed for changed TypeScript/Astro files.
- The standard Node-adapter `pnpm build` passed. It reported the existing
  `COMMONJS_VARIABLE_IN_ESM` warning in `apps/web/src/lib/search.ts` and
  prerender warnings about `Astro.request.headers` on other pages.
- `git diff --check` passed.

## Limits and remaining work

- `db/migrations/017_training_session_messages.sql` was applied with the repo
  migration runner to the configured Neon database `pixelated`. The configured
  branch/environment was not identified from the connection metadata. The
  table, constraints, index and migration record were verified afterward.
- No real session creation/context writer exists, so the training portal has
  no supported way to populate an approved synthetic scenario.
- The API stores trainee turns; it does not generate synthetic-client replies
  or evidence-grounded coaching.
- Faculty access/review, two-organization isolation, release deployment,
  rollback and cohort measurement remain unverified.

The pilot remains **NO-GO**. No customer enrollment or launch is authorized.

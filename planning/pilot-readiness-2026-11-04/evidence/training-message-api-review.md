# Training message API and persistence review

Date: 2026-11-04

## Implementation and production rollout

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
- Commit `f497d82ce` was deployed to production through the staging Vercel
  workflow. `pixelatedempathy.com` resolves to Ready deployment
  `pixelated-agdxbtelu-wutanglan.vercel.app`.
- Migration workflow run `41796100473` applied
  `017_training_session_messages.sql` to the production app database configured
  as `APP_DATABASE_URL`; its status step confirmed migration 017.
- Live smoke checks returned 200 for `/`, 302 for `/training/` (authentication
  required), and 401 for an unauthenticated POST to the new message endpoint.

## Verification

- Focused route tests cover authenticated writes, ownership/synthetic SQL
  constraints, input bounds and reload readback.
- Targeted oxlint passed for changed TypeScript/Astro files.
- The standard Node-adapter `pnpm build` passed. It reported the existing
  `COMMONJS_VARIABLE_IN_ESM` warning in `apps/web/src/lib/search.ts` and
  prerender warnings about `Astro.request.headers` on other pages.
- `git diff --check` passed.

## Limits and remaining work

- The local `.env` Neon database also received migration 017 during initial
  verification. The production migration was separately applied through the
  repository's `APP_DATABASE_URL` workflow after confirming the Vercel
  environment's `DATABASE_URL` is a different database.
- No real session creation/context writer exists, so the training portal has
  no supported way to populate an approved synthetic scenario.
- The API stores trainee turns; it does not generate synthetic-client replies
  or evidence-grounded coaching.
- Faculty access/review, two-organization isolation, rollback, backup/restore,
  incident response and cohort measurement remain unverified. Deployment of
  this technical change does not pass the pilot gates.

The pilot remains **NO-GO**. No customer enrollment or launch is authorized.

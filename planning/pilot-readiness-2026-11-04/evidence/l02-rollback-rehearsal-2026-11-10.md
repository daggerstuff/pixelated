# L02 — Release rollback rehearsal

**Package:** L02 · **Gate:** G2 · **Owner role:** Platform/release ·
**Verdict: the rollback half is now demonstrated.** Executed 2026-11-10 against
the production Worker `pixelated-empathy`.

The register's L02 exit condition named EKS, which is retired; production is the
Cloudflare Worker. As rewritten, L02 asks for a pinned release bundle, deploy and
health records, and an **executed** rollback rehearsal. This document records the
rehearsal. It does not close L02 — the four-repo commit manifest and the
incident linkage for PIX-4751/4795/4814 are still missing.

## 1. Versions available at rehearsal time

Read with `wrangler versions list --name pixelated-empathy` (wrangler 4.158.0):

| Version ID                             | Created                  | Corresponding release                      |
| -------------------------------------- | ------------------------ | ------------------------------------------ |
| `7ea1640e-d8d6-4cb2-9da5-56621309a851` | 2026-11-10T17:27:52.830Z | `8397bdff6` — the current pin              |
| `7bf32878-d1f9-47d6-b793-1f26a63532ff` | 2026-11-10T17:27:42.723Z | secret-change version from the same deploy |
| `0f3d77e6-4360-4fc5-8d6f-91528fb222d9` | 2026-11-10T15:50:07.533Z | `42653d506` — the previous app build       |

`0f3d77e6` was chosen as the rollback target because it is a real prior release
with its own measurement record (`availability-remeasure-42653d506-2026-11-10.md`),
not an arbitrary earlier version.

## 2. Rehearsal

| Step               | Command                                                                | Result                                                                          |
| ------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 0. Pre-state       | `wrangler deployments status`; `curl /api/health`                      | `7ea1640e` at 100%; health **200**, apex **200**                                |
| 1. Roll back       | `wrangler versions deploy 0f3d77e6-…@100% --name pixelated-empathy -y` | **SUCCESS** — "Deployed pixelated-empathy version 0f3d77e6… at 100% (0.41 sec)" |
| 2. Verify rollback | `wrangler deployments status`; `curl /api/health`, `curl /`            | `0f3d77e6` at 100%; health **200**, apex **200**                                |
| 3. Restore         | `wrangler versions deploy 7ea1640e-…@100% --name pixelated-empathy -y` | **SUCCESS** — "Deployed pixelated-empathy version 7ea1640e… at 100% (1.31 sec)" |
| 4. Verify restore  | `wrangler deployments status`; `curl /api/health`, `curl /`            | `7ea1640e` at 100%; health **200**, apex **200**                                |

Total production exposure to the previous version: under a minute, with a health
check at every transition. The Worker never served a 5xx during the rehearsal.

## 3. What this demonstrates, and what it does not

Demonstrated: a release can be reverted to a named prior version in under a
second of deploy time, the Worker picks the change up without a rebuild, and the
restore is symmetric.

Not demonstrated:

- **Database compatibility.** `8397bdff6` and `42653d506` do not carry different
  migrations, so this rehearsal did not test rolling back across a schema change.
  A rollback that crosses a migration is the case that actually fails, and it is
  untested.
- **Incident linkage.** No rehearsal tied a rollback to a real incident, a
  paging path, or a named responder.
- **The standby origin.** `www.pixelatedempathy.com` returns **402
  `DEPLOYMENT_DISABLED`** — the Vercel standby account is blocked, so the
  "warm standby" is not a fallback anyone could fail over to today. That is a
  separate L02 defect, recorded here rather than fixed.
- **`wrangler versions deploy` needs a local Cloudflare build.** The command
  reads `.wrangler/deploy/config.json`, which redirects to
  `dist/server/wrangler.json`; that file only exists after
  `bash scripts/ci/build-cloudflare.sh`. The first attempt failed with "the
  redirected configuration path … does not exist" because only the Node-adapter
  build had run. A rollback from a clean checkout therefore requires a build
  first — worth knowing before an incident, and worth a note in the runbook.

## 4. What closes L02

1. The four-repo commit manifest for the pinned release.
2. The deploy/health records carried forward per release (already recorded for
   `8397bdff6` in `mission-decision-2026-11-10.md` §1).
3. Incident linkage: PIX-4751, PIX-4795, PIX-4814 each tied to a later
   equivalent successful run or a reproduced blocker.
4. A rollback rehearsal that crosses a migration, once a release ships one.
5. A decision on the standby origin: repair the Vercel account, replace the
   standby, or stop describing it as one.

# L02 — Release manifest and incident linkage

**Package:** L02 · **Gate:** G2 · **Owner role:** Platform/release ·
**Release:** `751a28420e97532bad28e626bd662402e681d3b9` on `staging`.

This closes the two items the rollback record
([`l02-rollback-rehearsal-2026-11-10.md`](l02-rollback-rehearsal-2026-11-10.md))
listed as still missing: the four-repo commit manifest and the incident
linkage. L02 itself stays **OPEN** on one reproduced blocker, named in §3.

## 1. Four-repo manifest

Read from `git ls-tree HEAD` on the release commit, not from a brief:

| Repo                       | Commit                                     | Role                                           |
| -------------------------- | ------------------------------------------ | ---------------------------------------------- |
| `pixelated` (superproject) | `751a28420e97532bad28e626bd662402e681d3b9` | Astro app, worker bundle, planning evidence    |
| `ai`                       | `3934295471e247795b10669baf9989bf10bd9604` | training pipeline, evaluation, register rubric |
| `docs`                     | `79a5da326ee2846fc057a2425827f3ac02c0092e` | documentation tree                             |
| `foresight`                | `81b5f55ee5a193f0edaa3645314e762260c345e6` | memory service                                 |

All three gitlink pins were confirmed published on the mirror by the pre-push
hook (`[gitlink] … published on the mirror`) before the push was accepted, so
the release does not depend on a local-only submodule commit.

## 2. Deploy and health records

The production origin is the Cloudflare Worker `pixelated-empathy`
(`.github/workflows/deploy-cloudflare.yml`, triggered by `workflow_run` on
`CI`, credential-gated, app-facing-changes filtered). Vercel remains the standby
at its `vercel.app` URL and issues the `www` redirect.

| Release     | CI run                    | Deploy run                | Worker version                                 | Health                               |
| ----------- | ------------------------- | ------------------------- | ---------------------------------------------- | ------------------------------------ |
| `1580a719f` | `42913610181` **success** | `42914696184` **success** | `186b655f-093f-4224-86f1-b3e25646a3b7` at 100% | apex `/api/health` 200, apex `/` 200 |
| `8397bdff6` | `42863424368` **success** | `42864607424` **success** | `7ea1640e-d8d6-4cb2-9da5-56621309a851` at 100% | apex 200                             |
| `42653d506` | `42846382789` **success** | `42847860190` **success** | `0f3d77e6-4360-4fc5-8d6f-91528fb222d9` at 100% | apex 200                             |

The rollback rehearsal on 2026-11-10 moved production `7ea1640e` → `0f3d77e6` →
`7ea1640e` with health 200 at every transition; see the rollback record.

**The standby is not usable.** `https://www.pixelatedempathy.com/` answers
**402 `DEPLOYMENT_DISABLED`**: the Vercel account backing the standby is
blocked, so the "warm standby" cannot receive traffic today. That is a standing
L02 defect, not a transient one, and it is why the apex Worker is currently a
single origin.

## 3. Incident linkage

The register requires each CI/deploy incident to be tied either to a later
equivalent successful run or to a reproduced blocker. All three mapped tickets
were closed before this pass; two of the three closes are supported and one is
not.

| Ticket                                             | Register mapping | Tracker state                                                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                          | Verdict                                                                                                                    |
| -------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **PIX-4751** — CI failed on staging                | L02 / L12        | not found under that id; the live equivalents are PIX-4871 (Done 2026-11-08), PIX-4869 (Done 2026-11-07) and PIX-4900 (Triage, 2026-11-09) | `CI` succeeded on `249c558c4` (`42783179026`), `42653d506` (`42846382789`), `8397bdff6` (`42863424368`) and `1580a719f` (`42913610181`)                                                                                                                                                                                                                                           | **Supported.** The failure class has later equivalent green runs. The ticket id in the 2026-11-02 crosswalk is stale.      |
| **PIX-4795** — Deploy to AWS EKS failed on staging | L02 / L12        | **Done** 2026-11-04                                                                                                                        | EKS is retired: no workflow in `.github/workflows` deploys to EKS, and `vercel-policy.md` records the retirement. The equivalent path is `Deploy to Cloudflare Workers`, which succeeded on `42653d506` (`42847860190`), `8397bdff6` (`42864607424`) and `1580a719f` (`42914696184`).                                                                                             | **Supported by replacement.** The failure cannot recur because the target no longer exists; the replacement path is green. |
| **PIX-4814** — Quality failed on staging           | L02 / L12        | **Done** 2026-11-05 — and a fresh **PIX-4897** was opened 2026-11-10, still in Triage                                                      | `Quality` run `42913610100` on `1580a719f`: **8 of 9 jobs pass**, one fails — `ai submodule strict ratchet`, "debt grew" on `training/build_v18_release.py` (return-value, arg-type, assignment, dict-item) and `training/tests/test_build_v18_release.py` (attr-defined ×23, no-any-return). The same job failed on `8397bdff6` (`42863423637`) and `42653d506` (`42846382800`). | **Reproduced blocker.** The ticket was closed without a green `Quality` run, and the failure is live.                      |

### What the reproduced blocker is, and is not

The failing job is the **`ai` submodule strict-typing ratchet**, at pin
`393429547`. It is not attributable to the superproject: the identical job
failed on the two releases before this one, and the errors are all inside
`ai/training/`. `PIX-4758` ("Re-pin AI strict-typing baseline so CI ratchet
stays green") was closed Done on 2026-11-07, but `training/build_v18_release.py`
was added to the `ai` submodule afterwards, so the re-pin no longer covers the
tree.

Consequence for the gate: **G2 cannot be marked green while `Quality` is red on
`staging`**, even though `CI` and the deploy are green, because the register's
L02 exit condition requires the incident linkage to resolve and this one
reproduces. Closing it means either annotating the new `ai` files or re-pinning
the baseline in the `ai` submodule — a change that belongs to that repo, not
this one.

## 4. What L02 still needs

1. A green `Quality` run on `staging` after the `ai` ratchet is fixed or
   re-pinned, and PIX-4897 closed against it.
2. A rollback rehearsal that crosses a database migration, when a release
   ships one.
3. A decision on the standby origin: repair the Vercel account, replace the
   standby, or stop describing it as one.

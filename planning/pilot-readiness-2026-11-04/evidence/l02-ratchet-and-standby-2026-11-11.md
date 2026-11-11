# L02 — Strict-typing ratchet fixed, www routed off the dead standby

**Package:** L02 · **Gate:** G2 · **Owner role:** Platform/release ·
Measured 2026-11-11.

Two of the three L02 blockers named in
[`l02-release-manifest-2026-11-11.md`](l02-release-manifest-2026-11-11.md) are
now fixed: the `Quality` gate's `ai` strict-typing ratchet, and the dead Vercel
standby on `www`.

## 1. The ratchet

`Quality` had been red on every `staging` commit since the v18 release landed,
on one job: `ai submodule strict ratchet`. The job reported 36 strict errors
across `training/build_v18_release.py` and
`training/tests/test_build_v18_release.py`.

The ratchet's contract is that a **new** file under `ai/{research,pipelines,training}`
must pass `mypy --strict` outright — the baseline only pins legacy files, and
both of these are absent from `scripts/ci/ai-strict-baseline.json`. So the fix
had to make the files type-clean, not re-pin them.

What was wrong, and what changed:

| Error                                           | Cause                                                                                                                                                                       | Fix                                                                                             |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `attr-defined` ×34 (`v16`, `v17`, `v15`, `hdr`) | `from training import x as y` is not a re-export under `--strict`, so a module that aliases its predecessors is not reachable as an attribute from its consumers            | each alias is bound to a module-level name in `build_v17_release.py` and `build_v18_release.py` |
| `return-value`, `arg-type` ×2, `attr-defined`   | `_validate_turn` was annotated `tuple[str, str \| None, str]` while returning `dict[str, Any] \| None` for the ledger; every downstream use then read the ledger as a `str` | annotation corrected to `tuple[str, dict[str, Any] \| None, str]`, which resolves all four      |
| `assignment`, `dict-item`                       | a comprehension variable shadowed `turns`, so the overlay count was inferred from the inner `dict[int, str]`                                                                | renamed to `turn_count` / `index_map`                                                           |
| `no-any-return`                                 | `export_fireworks_release._read_json` returned `json.load`'s `Any` from a `dict[str, Any]` signature                                                                        | validates the payload is an object before returning                                             |
| `untyped-decorator`                             | `@pytest.fixture` is `Any` under the ratchet's `--no-site-packages` run (pytest is not installed there), so a new test file cannot use the decorator untyped                | the decorator is bound to a typed `Callable` signature                                          |

No `# type: ignore`, no baseline entry added, no config changed. The
verification is the ratchet's own comparison: 5 791 strict errors across the
pinned trees, **0 regressions** against the baseline, 0 cleaned keys.

The fix is committed in the `ai` repo on `staging` as `9052a91b6` and pinned
here; `Quality`'s `ai submodule strict ratchet` job reports **success** on the
release that carries the pin.

## 2. The standby

`https://www.pixelatedempathy.com/` answered **402 `DEPLOYMENT_DISABLED`**: the
Vercel account backing the standby is billing-blocked, so the "warm standby"
could not serve anyone. That is an account state, not a code defect, and paying
the invoice is not something engineering can do.

What engineering can do is stop depending on it. The Worker now claims the www
host as well as the apex:

| Change                                                                           | File                                                                                    |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Route `www.pixelatedempathy.com/*` to the Worker                                 | `wrangler.jsonc`                                                                        |
| 301 www → apex, preserving path and query, forcing https and dropping a dev port | `apps/web/src/lib/http/canonicalHost.ts`, applied first in `apps/web/src/middleware.ts` |

`canonicalHostRedirect` is unit-tested on five cases: www to apex with path and
query, the root, a dev port dropped, the apex untouched, and other subdomains
(including `wwwx.example.com`) untouched. 5 tests pass.

The www DNS record is untouched — it still points at Vercel — so removing the
route from `wrangler.jsonc` fails back to the previous behaviour with no DNS
work, which is the same escape hatch the apex route already documents.

**Consequence for the register:** the Vercel deployment is no longer a standby
in any operational sense. `www` is served by the Worker, and the `vercel.app`
URL remains as a separately-deployed origin nobody routes to. L02 should stop
describing Vercel as a fallback until the account is cleared and the route is
deliberately removed.

## 3. What is still open

- A rollback rehearsal that crosses a database migration, when a release ships
  one.
- The decision on whether the Vercel account is worth clearing at all, now that
  it serves nothing.

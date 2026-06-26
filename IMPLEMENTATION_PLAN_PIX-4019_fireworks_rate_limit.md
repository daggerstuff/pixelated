# PIX-4019 — Fireworks AI provider + tier-aware rate limiter

Branch: `chad/pix-4019-fireworks-ai-provider-tier-aware-rate-limiter-fireworks`
Linear: https://linear.app/pixelated/issue/PIX-4019
Status at write: plan only — no code lands until user approves.

## Context

`ai/utils/common/llm_client.py` is a 122-line facade exposing `LLMClient(driver="mock"|"openai")`. It currently has **no rate-limit middleware**, and the only OpenAI-compat driver is used to talk to NVIDIA NIM, Gemini, vLLM, Fireworks, etc. Fireworks is not actually wired up — `grep -i fireworks` in this repo returns zero provider code (only a stray reference in a YouTube transcript). Consequence: when the Pixelated Empathy AI service starts routing to Fireworks (or sits behind a tier change), the first request that crosses the starter-tier TPM cap gets a 429 with no client-side backoff.

The repo is served by Fireworks right now (env header: `accounts/fireworks/models/minimax-m3`), and the doc at https://docs.fireworks.ai/serverless/rate-limits says the starting tier is **3.6M Total Prompt TPM / 900K Uncached Prompt TPM / 36K Generated TPM**, with adaptive upper bounds scaling by Spending Tier. 429s return; exponential backoff is recommended.

This plan adds (a) a real FireworksDriver and (b) a tier-aware token-bucket rate limiter shared across Fireworks + NVIDIA + OpenAI.

## Scope

| In scope                                                                                                                | Out of scope                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `FireworksDriver` (OpenAI-SDK → Fireworks `/inference/v1/chat/completions`)                                             | Pix-3996 (Neon + multi-agent) — paused                                                                               |
| `TieredRateLimiter` token-bucket per provider/tier/(account,model)                                                      | Anthropic driver — not in the user's scope, and tier SOT has no Anthropic column                                     |
| Tier SOT: env override → Fireworks `GET /v1/accounts/me` (TTL cache) → static tier table                                | Frontend / observability changes                                                                                     |
| Track Fireworks `X-Ratelimit-Limit-Tokens-Prompt`/`-Cache-Adjusted-Prompt`/`-Generated` response headers, self-throttle | New billing/account logic                                                                                            |
| Unit + integration tests                                                                                                | Migration of every existing caller to the new driver — call sites stay on `LLMClient(driver="openai")` (back-compat) |
| Verification: `uv run pytest ai/utils/common/`, `pnpm lint`, `pnpm typecheck`, one live Fireworks call                  |                                                                                                                      |

## Files touched (surgical list)

| Path                                                   | Action                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai/utils/common/llm_client.py`                        | Add `FireworksDriver` (subclass of `LLMDriver`, OpenAI-SDK base URL `https://api.fireworks.ai/inference/v1`); extend `LLMClient.__init__` ternary to `"mock" \| "openai" \| "fireworks" \| "nvidia" \| "auto"`; insert `self._limiter = TieredRateLimiter(...)` in `__init__`; wrap `generate()` calls in `_limiter.acquire(...)`. |
| `ai/utils/common/rate_limiter.py` (NEW)                | `TieredRateLimiter` (asyncio.Lock + token-bucket), `TierResolver` (env > /accounts/me > static), response-header observer. Keep ≤200 lines; no over-engineering.                                                                                                                                                                   |
| `ai/utils/common/tier_catalog.py` (NEW)                | Static per-provider tier table; keys like `("fireworks","starter")`, `("openai","tier1")`, `("nvidia","nvcf_free")`.                                                                                                                                                                                                               |
| `ai/utils/common/tests/test_rate_limiter.py` (NEW)     | Unit tests: env precedence, /accounts/me TTL cache hit/miss, bucket refilling at start tier, concurrency limit per (account, model).                                                                                                                                                                                               |
| `ai/utils/common/tests/test_fireworks_driver.py` (NEW) | Driver instantiation + request shaping; mocked HTTPX so no live key required.                                                                                                                                                                                                                                                      |
| `ai/pyproject.toml`                                    | Add `httpx>=0.27` (header introspection / /accounts/me poll), `pydantic>=2.6` (response model). No new mandatory heavy deps.                                                                                                                                                                                                       |
| `ai/.env.example` (root)                               | Document `FIREWORKS_API_KEY`, `FIREWORKS_API_TIER`, `NVIDIA_API_TIER`, `OPENAI_TIER`, `RATELIMIT_TTL_SECONDS`. Do not commit any actual secrets.                                                                                                                                                                                   |
| `ai/utils/common/AGENTS.md` or inline docstring        | Operational notes: how to override tier in prod, how to disable limiter (`RATELIMIT_DISABLED=1` escape hatch).                                                                                                                                                                                                                     |

Total new public surface area: **3 new modules, 1 facade edit, ≤ ~600 LOC**.

## Tier source-of-truth (SOT) — ordering

1. **Env override (always wins).**
   - `FIREWORKS_API_TIER` ∈ {`free`, `developer`, `pro`, `business`, `priority`}
   - `NVIDIA_API_TIER` ∈ {`nvcf_free`, `nvcf_pro`, `enterprise`}
   - `OPENAI_TIER` ∈ {`free`, `tier1`, `tier2`, `tier3`, `tier4`, `tier5`}
2. **Fireworks only: `GET https://api.fireworks.ai/v1/accounts/me`** if env override missing. Cache to disk at `~/.cache/foresight/fireworks_account_tier.json` with default TTL 6h, overridable via `RATELIMIT_TTL_SECONDS`. Cache key includes `FIREWORKS_API_KEY[0:8]` so different keys don't collide.
3. **Static per-provider tier table** loaded from `tier_catalog.py` as the deterministic default.

Resolution fails open: if env is unset, the API call fails, AND the static table is missing the key, **fall through to starter-tier defaults** (`fireworks: starter`, `nvidia: nvcf_free`, `openai: tier1`) and log a WARN once.

## Starter-tier constants (token-bucket input)

```
fireworks.starter  = {"prompt_tpm": 3_600_000, "uncached_tpm": 900_000, "generated_tpm": 36_000, "concurrency": 60}
nvidia.nvcf_free   = {"prompt_tpm":   500_000, "generated_tpm":   15_000, "concurrency": 8}
openai.tier1       = {"prompt_tpm":   500_000, "generated_tpm":   30_000, "concurrency": 60}
```

(Fireworks numbers from https://docs.fireworks.ai/serverless/rate-limits; NVIDIA/OpenAI from public NIM/OpenAI tier-1 free/dev respectively. Conservative under the doc values, so we never overshoot.)

`prompt_tpm` and `generated_tpm` are independent token buckets. The primary call path **reserves `prompt_tpm` capacity ahead of the request** and **releases actual-on-deny, holds actual-on-success**. On 429, exponential backoff starts at 1s and doubles to 60s max, with jitter ±20%.

## Concurrency model

- One bucket per `(account_id, model_id)` derived from API key prefix + model name, so the same driver with two keys doesn't share a limiter.
- Concurrency limit = `ceil(concurrency_cap / concurrent_users)` with `concurrent_users = 4` as default. Configurable via `RATELIMIT_USERS_PER_KEY`.
- Cross-tiers of different providers do **not** share buckets.

## Back-compatibility plan

- `LLMClient(driver="openai")` continues to work; no breaking signature change.
- `driver="auto"` (new) inspects `LLM_PROVIDER` env var (`fireworks` | `nvidia` | `openai`); defaults to last-resolved driver for the running process.
- New `RATELIMIT_DISABLED=1` env flag disables the limiter entirely — used in tests and in already-throttled environments. Important escape hatch because callers that manage their own rate limiting shouldn't double-throttle.

## Verification (mandatory before merge)

1. `uv run pytest ai/utils/common/tests/test_rate_limiter.py -v` — tier resolution, TTL cache, env precedence.
2. `uv run pytest ai/utils/common/tests/test_fireworks_driver.py -v` — mocked driver paths.
3. `pnpm typecheck` (root) — no TS shim changes; should still pass.
4. `pnpm lint` (root) — pre-existing warnings expected.
5. **One live Fireworks call (smoke):**
   ```
   FIREWORKS_API_KEY=*** FIREWORKS_API_TIER=developer \
     uv run --project ai python -c "from ai.utils.common.llm_client import LLMClient; \
       print(LLMClient(driver='fireworks').generate('ping', model='accounts/fireworks/models/llama-v3p1-8b-instruct'))"
   ```
   Expect a real 200 answer. Inspect stderr for `tier=developer prompt_tpm_reserved=... pool_size=...`.

## Risks / unknowns

| Risk                                                              | Mitigation                                                                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Fireworks response-header names shift without notice              | Documented in `_RATELIMIT_HEADER_MAP` with `.get()` fallback; if missing, fall back to static defaults. |
| `/v1/accounts/me` requires admin scope, may 403 on read-only keys | Catch HTTP 4xx, mark "use static", log once. No exception escapes.                                      |
| Token-bucket clock skew across processes                          | Single-process only; cross-process coordination deferred (out of scope).                                |
| Existing callers' back-compat breakage                            | Pre-feature: `grep -rn "LLMClient(" ai/` to enumerate call sites; confirm none depend on private abc.   |
| `pnpm vitest` cross-shim test flakiness                           | Don't touch frontend; lint/typecheck/tests run on `ai/utils/common/` only.                              |

## Out-of-scope reminder

- PIX-3996 (Phase 7 Foresight deployment + multi-agent verification) is **still paused on `staging`** (only surviving side-effect: `.env.local` `FORESIGHT_DB_URL`, which is gitignored and harmless). Branch stays untouched. Resuming it requires its own approval cycle — do not bundle here.

## User approval gate

No `git add` / `git commit` / code edit lands until the user signs off on this plan. Expected reviewer feedback channels: in-conversation reply with approval, OR a Linear comment approving the plan on PIX-4019, OR push back requesting scope changes.

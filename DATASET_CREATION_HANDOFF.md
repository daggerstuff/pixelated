# Dataset Creation Handoff — NF Bulk Run + Arc Corpus Track

**Date:** 2026-09-18
**Branch:** staging (ai submodule commits through Sep 18 listed in Part 5;
see "Next steps" for the commit trail)
**Scope:** the Sep 13–15 dataset-creation push: edge/nightmare bulk generation,
dual-judge triage, Lightning GPU parity gate, and the long-arc corpus track —
plus the Sep 17 close-out (provider pivot to Vercel AI Gateway, NF
regeneration + re-judge, arc audit-integrity correction → 10/10 accepted, quadit
gate wired into ingest) and the Sep 18 close-out (HR-70 tiebreak + manual
review → 177 accepted, gold 189,159, arc scale/budget plan).
Reconstructed from the herdr terminal captures, run logs, W&B runs, and Foresight
memories — the Codex rollouts for the driving sessions did not persist.

---

## Who ran what (agent attribution)

| When (UTC) | Agent / harness | Model | Work |
|---|---|---|---|
| Sep 13 17:32 | **Codex CLI** in a herdr pane (thread `01a09785` resumed) | `cf/@cf/deepseek-ai/deepseek-v4-pro-0813` (9router) | Fixed 2 launch bugs, launched the NF bulk run detached, monitored |
| Sep 13 22:19 | Mastra Code continuation (same pane lineage) | GLM-5.3-flash status bar | NF run to 212/212, judge phase launch, AdaptionLabs draft |
| Sep 14 ~18:26 | Codex CLI herdr pane | `cf/@cf/zai-org/glm-5.2` (High) | Dual-judge triage: k=3 GLM re-probes, quarantine, flag triage |
| Sep 15 00:50–03:49 | **Codex CLI** herdr pane (thread `01a0a198` resumed) | `cf/@cf/qwen/qwen3.8-27b` (9router) | **Arc-corpus track authored**: probes, bake-off, spec, plans, generator, auditor |
| Sep 16–17 | Factory Droid session `df283c46` | `custom:GLM-5.3-(CF)` | Committed the arc files (`3a2fa0cf9`), built quadit audit + dataset gate (`d58261aa8`, `e9943882c`) |
| Sep 17 (this close-out) | **Mastra Code** (pixelated, staging) | n/a (orchestrator) | Provider pivot Featherless → Vercel AI Gateway (Vultr tried, rejected); NF 93-record regeneration + re-judge (W&B `r2fkgmd9`); arc audit-integrity correction → 10/10 accepted (pilot_06 plan-fix + 3rd-audit ACCEPT); quadit gate wired into ingest; handoff updated |
| Sep 18 (night) | **Mastra Code** (pixelated, staging) | n/a (orchestrator) | HR-70 tiebreak (minimax-m3 via Vercel, W&B `8tyc7do7`) + 38-record manual review → 37 approved staged to gold (189,159); pilot_06 `hx` ledger fix committed; arc scale/budget plan written (Part 6) |

Note: the Sep 13/15 Codex rollouts are missing from `~/.codex/sessions/` (the
resumed runs never wrote rollout files). The herdr pochi terminal captures are
the only record: `~/.pochi/terminals/term-2a487e83-*.log` (launch day, 3.6MB),
`term-c2adead5-*.log` (arc track, 8.4MB), `term-38fc06ca-*.log` (judge triage, 6.8MB).

---

## Part 1 — Edge + Nightmare bulk generation (Sep 13)

**Status: COMPLETE — 212/212 records generated, dual-judged, triaged.**
(Re-judged Sep 17 after regeneration — see Part 5; the Sep 14 tally below is
the historical record, `judged_v2.jsonl` now holds the Sep 17 verdicts.)

### Launch bugs fixed on the spot (Codex, Sep 13 17:32)

1. **Sandbox `env` prefix silently swallows multi-line `python -c` scripts**
   (zero output, instant silent death). Use shell-native `VAR=x` prefix
   assignment instead of `env VAR=x`.
2. **`generation_backend.py` chat_completion ~line 340:** a 200-with-error-envelope
   raised a bare `KeyError('choices')` that escaped the retry loop. Patched to
   raise `EmptyContentError` (retryable, backoff) when `choices` is missing.

### Run configuration

| Setting | Value |
|---|---|
| Backend | Featherless dedicated key (`rc_1fa...` — user swapped keys mid-flight to escape a competing user's 429s) |
| Writer model | `ornith-ai/Ornith-1.5-9B` |
| Concurrency | `NF_CONCURRENCY=8` |
| Scope | 92 nightmare scenarios + 120 edge-case combos (10 families × 3 difficulty × 4 ambiguity) |
| Persistence | fsync + resume keys, crash-safe |
| Tracing | W&B run `87r7phxo` (`nf_bulk_20260913_173220`) + Weave per-call |
| Est. wall | 3–4.5 h (actual: ~1h50m to 212/212) |

First 6 records inspected before full run: 42/42 assistant turns clean
(zero gate hits, zero truncations, zero label leaks, median 2 sentences).

### Outputs (in `ai/training/output/nightmare_fuel/checkpoints/`)

| File | What |
|---|---|
| `edge_and_nightmare_generated.jsonl` (1.3MB) | 212 final generated records |
| `edge_and_nightmare_generated.pre_quarantine_20260914_155056.jsonl` | pre-quarantine snapshot |
| `edge_and_nightmare_generated_quarantined_45.jsonl` (300K) | the 45 regenerate-verdict records |
| `edge_and_nightmare_judged_v2.jsonl` (202K) | 212 judged: **57 accepted, 62 human-review, 0 infra failures** |
| `edge_and_nightmare_judge_report_v2.md` | per-family report (mean primary q 0.50–0.68) |
| `flag_triage.md` (8K) | full triage: A severe (4) → B consistent (4) → C contestable (7) → D noise (10) → E re-probe wave (56, k=3, 168 GLM calls, 0 errors) |
| `glm_reprobe_bucket_e.json` (118K) | bucket-E re-probe evidence |

### Final triage tally

Two passes happened — read them in order:

**A. Contamination triage (Sep 14 14:49, `flag_triage.md`)** — GLM k=3 re-probe
of the Wayfarer-flagged 81 (bucket A–E):

| Bucket | Count | Action |
|---|---|---|
| Confirmed critique (regenerate) | **45** | quarantined to `edge_and_nightmare_generated_quarantined_45.jsonl` (Sep 14 15:50) |
| Genuine contests (human review) | **12** | human_review needed |
| Exonerated (noise-dip) | **24** | fine |

Bucket-E domain skew: substance_use 7/7 probed, minor_or_dependent 5,
coercion_or_abuse 4 — Ornith's confrontational frame-holding fails hardest
exactly where softness/pacing/safeguarding matter. Wayfarer (the NF primary)
scored confirmed-bad transcripts as high as 0.83 — **do not trust Wayfarer
scores alone**.

**B. Final dual-judge verdict (Sep 14 19:36, `edge_and_nightmare_judged_v2.jsonl`)** —
all 212 records, dual-judge (Wayfarer primary + GLM-5.2 secondary):

| Verdict | Count |
|---|---|
| Accepted (dual pass) | **57** |
| Needs human review (dual-inconsistent, diff > 0.15) | **62** |
| Rejected outright | **93** |

The 45-record quarantine from pass A and the 93 outright rejections overlap in
provenance but are separate verdicts — treat `judged_v2.jsonl` as authoritative
for the final dataset decision. Family means: 0.50 (substance_use) to 0.68
(therapeutic_rupture); worst families substance_use 1/12 accepted, boundary
testing 1/12, coercion 2/12.

### Dual-judge contamination finding (Sep 14 parity saga)

The Sep 13 evening attempt to prove local-GPU parity produced this evidence:

| Arm | Generation | Latency | Judge accept |
|---|---|---|---|
| Featherless ornith (baseline) | 20/20 | 33.7s | 11/20 · quality 0.74 |
| Local GPU ornith_local (L4/Ollama) | 20/20 | 41.7s | 4/20 · quality 0.33 |

- 8/20 Wayfarer primary judge calls returned hard **0.00** (error-path verdicts,
  shared-API-key contention); 6 more carried `self_consistency_variance_exceeded`
  (k-run disagreement we had already proven swings ±0.4 between reruns).
- Identical cached transcripts previously judged 14→18→11→4 across runs with
  **zero output changes**.
- GLM-5.2 secondary (different provider, uncontended) scored the local outputs
  ~0.72 mean — nearly identical to the Featherless arm.

**Conclusion recorded: judging is contaminated, not informative. The local model
did not get worse; the measurement instrument failed.** Re-judge of only the
poisoned rows (8 × 0.00 + 6 variance-flagged) under calm conditions was the
proposed close-out (≥0.71 mean ⇒ parity holds ⇒ flip `.env` to vLLM). User
pivoted instead: **stay on Featherless** (dedicated key provided) and run the
full batch now — comparison runs shelved.

---

## Part 2 — Lightning GPU parity exploration (Sep 13, shelved)

- Spun `ornith-gpu-parity` Lightning studio (L4), Ollama Q8_0 serving
  Ornith-1.5-9B over an SSH tunnel (`127.0.0.1:18000 → :11434`).
- `eval_boulesis_vs_ornith.py` hit `KeyError: 'nf_016'` from a stale 2-item
  judge artifact being reused — clean re-run over the true 20 fixed it.
- Gate generation itself: **20/20 pass on both arms**; only the judge leg was
  poisoned (see above).
- Studios torn down except `ornith-gpu-parity` (kept as the fallback model+code
  per the 5/5 task list). Migration gate is **unresolved**: pending a clean
  re-judge (targeted, ~1 of 60 competing calls, ≥0.71 bar).

---

## Part 3 — Long-arc corpus track (Sep 15, Codex/Qwen3.8 pane)

**Status: pilot COMPLETE — 10/10 arcs accepted (Sep 17, Part 5).** The Sep 15
state below (4 clean arcs, facts-revision died on Featherless 402s) was
superseded by the Vercel Gateway close-out, then corrected by the
audit-integrity re-audit (Part 5: two bogus accepts found, re-adjudicated,
and closed to 10/10).

### Design (ARC_CORPUS_SPEC.md, v1)

Long multi-session therapy arcs — 70–110 turns, up to ~70k tokens, spanning
story-weeks — with an adversarial-memory unit: planted misstatements, false
attribution, entity swaps, fabricated "you told me to" claims. Writer holds a
timeline ledger (`tl` rules, 9 machine-validated fields); a Kimi-K3 auditor
does line-by-line fabrication/contradiction review with a mechanical-gates-first
pass and a revise loop. The 212 short NF records stay as a short-session
supplement; nightmare scenarios get reused as arc seeds.

Key settings (spec §2): writer `deepseek-ai/DeepSeek-V4.1-Flash`, **thinking
off is REQUIRED** (`chat_template_kwargs: {"thinking": false}` — otherwise the
model burns the entire budget on `reasoning_content` and emits zero content),
max_tokens 32768 accepted ceiling, temp 0.7, 780s timeout. Budget fallback:
`deepseek-ai/DeepSeek-V4-Flash-0731` (10× cheaper, audited harder — leaked
reassurance in probe). ~$0.3–0.5 per finished arc → 1,000 arcs ≈ $300–500;
**wall-clock is the binding constraint, not dollars**.

### Bake-off (probe_arc_bakeoff.py → `probe_arc_bakeoff_results.json`)

7 writer candidates probed on one 20-turn arc (V4.1-Flash plain /
ctk-thinking-off / reasoning-low, V4-Flash-0731, V4-Flash, Kimi-K2.6,
DeepSeek-V3-0324). V4.1-Flash with thinking-off won: clean ledger, 0
unmarked lines, gate hits only on provable-fact phrasing. Spec §8 (voice) was
corrected after the bake-off: "no reassurance under pressure" originally
conflated refusing comfort with withholding TRUE verdicts — the bake-off
scoring that called V4-Flash-0731's honest reply a "leak" was inverted (that
reply is the model move; V4.1-Flash's non-answer was weaker).

### Writer probe (probe_arc_writer.py → `probe_arc_writer_report.json`)

Single 20-turn arc on V4.1-Flash: 20.4s wall, 3,635 completion tokens, 20
client/19 therapist turns, 20 ledger blocks, 0 parse failures, 0 missing
fields, 0 unmarked lines, 0 cliché-gate hits.

### Pilot runs (output/arc_corpus/)

| Log | Result |
|---|---|
| `pilot_run_20260915_033312.log` | cycle 1 across 10 plans |
| `pilot_cycle2_20260915_044144.log` | 3 sessions regenerated; audit: 2 arcs → HR queue (Kimi timeouts) |
| `facts_validation_20260915_125651.log` | full re-gen with facts-grounding: 8 arcs fresh, audited 8 → **2 accepted, 6 revised**, 0 errors |
| `facts_revise_20260915_134702.log` | 6 arcs in revision; **died: 42× `http_402`** (Featherless quota exhausted on the 2-key pool) |

Current state (updated Sep 17):
- `arc_plans/`: 10 pilot plans (pilot_01…pilot_10) derived from nightmare seeds.
- `output/arc_corpus/arc_records.jsonl`: **10 accepted arcs** (all pilot_01…10,
  one row per arc; see Part 5). `*.pre_facts.jsonl` are the pre-facts-grounding
  snapshots (10 arcs, larger).
- `audit_results.jsonl`: verdict history for all 10;
  `human_review_queue.jsonl` **empty**.
- Sessions checkpoint: 21 sessions done (resume-safe).

### Remaining arc-track work

1. ~~Unblock the 402s~~ — **done** via the Vercel AI Gateway backend (Part 5).
2. ~~Finish pilot~~ — **done**: 10/10 accepted after the audit-integrity
   correction (Part 5).
3. Scale + budget plan (spec §task list item 7/7: "Scale + budget plan after
   user inspects pilot transcripts") — awaiting pilot inspection.
4. Keep the 212 NF records as the short-session supplement / arc seeds.

---

## Part 4 — Quadit dataset gate (Sep 16–17, factory-droid)

- `d58261aa8` — adversarial quad-audit core: 3 clinical judges + TOML auditor
  personas (severity rubric, anti-signal taxonomy, deterministic fallback,
  injectable LLM client; 15 tests).
- `e9943882c` — dataset gate adapter: audit training-data records **before
  corpus entry**.
- **Wired into the ingest path Sep 17** (this close-out, Part 5) — the
  deterministic gate now runs per-record in
  `ai/training/consolidate_edge_nightmare.py` before records reach
  `train_master_gold.jsonl`.

---

## Part 5 — Sep 17 close-out: Vercel AI Gateway, NF re-judge, arc audit-integrity correction (10/10), quadit wired

**Mastra Code session (this close-out).** Three things happened: the LLM
provider pivoted away from Featherless (and a brief Vultr stop) to **Vercel AI
Gateway**, the NF record set was regenerated + re-judged, and the arc pilot's
"10/10" claim was audited, corrected, and closed to a real 10/10 accepted. The
quadit
gate was then wired into the ingest path.

### Provider pivot: Featherless → (Vultr) → Vercel AI Gateway

Featherless hit the 402 quota wall (Part 3) and was no longer the viable
backend. The pivot landed on **Vercel AI Gateway** as the OpenAI-compatible
primary (a **Vultr Inference** backend was implemented and verified en route,
then removed from the codebase and `.env` entirely after the user dropped it).
The **secondary** provider is **W&B Serverless Inference**
(`https://api.inference.wandb.ai/v1`, OpenAI-compatible, auth via the existing
`WANDB_API_KEY`), exposed as `NF_BACKEND=wandb`.

Current backend + model mapping (set in `.env`, resolved in
`ai/training/generation_backend.py`):

| Role | Backend | Model |
|---|---|---|
| NF writer (`NF_MODEL`) | `vercel` | `deepseek/deepseek-v4-flash-0731` |
| NF writer (secondary) | `wandb` | `deepseek-ai/DeepSeek-V4-Flash-0731` |
| NF judge primary | `vercel` | `deepseek/deepseek-v4.1-flash` |
| NF judge secondary / arc auditor | `vercel` | `moonshotai/kimi-k3` |
| Arc writer | `vercel` | `deepseek/deepseek-v4.1-flash` |

`generation_backend.py` now supports `vercel` (primary), `wandb` (secondary),
plus `cloudflare`/`9router`/`vllm`/`featherless`. The `vercel` branch reads
`AI_GATEWAY_API_KEY` (base `AI_GATEWAY_URL`, default `https://ai-gateway.vercel.sh`);
the `wandb` branch reads `WANDB_API_KEY` (base `WANDB_INFERENCE_URL`, default
`https://api.inference.wandb.ai`). Caveat: the global `NF_MODEL` is Vercel-namespaced,
so switching to the wandb secondary requires overriding `NF_MODEL` with the W&B ID
(`deepseek-ai/DeepSeek-V4-Flash-0731`).
147 tests pass after the swap. Writer thinking-off verified (vLLM path, 4,797-char
dialogue in 13.3s). `glm-5.3` is a reasoning model — needs `thinking:false` +
sufficient `max_tokens` (8192 for judge; 128 starves it).

### NF close-out: regenerate the 93 rejected + re-judge

The 93 outright-rejected records (Part 1) were regenerated via Vercel AI Gateway,
then re-judged. This closed the three-verdict-set reconciliation (Next step 2):

- **Regeneration** (W&B `r2fkgmd9`): 120 skipped (resume), 92 new + 1 preflight,
  0 cliché-gate rejections, 0 LLM drops, 1 `EmptyContentError` self-healed.
  212/212 records, all 15 messages each. ~20 min.
- **Pre-flight** (W&B `9fpcyelc`): 1 NF record, passed.
- **`judged_v2` set-aside surgery**: 93 rejected rows removed, 119 kept
  (57 accepted + 62 HR), zero key overlap with the regenerated set.
  Snapshots saved (`pre_closeout_20260917*`, `rejected_93` set-aside 598KB).
- **Re-judge** (W&B `r2fkgmd9` gen run; re-judge appends to `judged_v2`):
  concurrency 2, k=3, primary `deepseek/deepseek-v4.1-flash`.

**Final NF verdict (Sep 17, `edge_and_nightmare_judged_v2.jsonl`, 212 rows):**

| Verdict | Before (Sep 14) | After (Sep 17) |
|---|---|---|
| Accepted (dual pass) | 57 | **140** |
| Needs human review | 62 | **70** |
| Rejected outright | 93 | **2** |

Transition: 83 rejected → accepted, 8 → HR, 2 → still rejected. Retained 119
rows: **0 drift** (unchanged). Re-judged quality 0.53–0.93, mean 0.85,
self-consistency 92/93, 0 infra failures.

**The 2 residual rejects** (both legitimate dual-consensus rejects):

| Key | Primary q | Secondary q | Dual diff | Flags |
|---|---|---|---|---|
| `edge:ambiguous_crisis_language:…:adversarial:contradictory:0` | 0.584 | 0.67 | 0.086 | confrontational_overinterpretation, stacked_questions, poor_resistance_management |
| `edge:coercion_or_abuse:…:moderate:information-poor:0` | 0.529 | 0.52 | 0.009 | confrontational_misattunement, ungrounded_interpretations, iatrogenic_alliance_rupture |

### Arc track: "10/10" claim corrected, then closed to a real 10/10

| Run | W&B | What |
|---|---|---|
| Arc generate run 1 | `vj3ng5vs` | 8 sessions, 5 arcs |
| pilot_09 retry | `97npffak` | 1 arc |
| pilot_01 regenerate | `pg64aimb` | 1 arc (was REVISE — fabrication at T14) |
| pilot_06 regenerate | `5xl3e9xy` | 2 sessions re-emitted after REVISE (MCI-ledger flags) |

- Auditor run 1 (glm-5.3, thinking ON): 5 accepted, pilot_01 REVISE.
- Patched `audit_arc_corpus.py`: `chat_template_kwargs thinking:false`
  (1.2s vs 90s+ per arc).
- pilot_01 regenerated + re-audited → **ACCEPT**.
- The close-out then claimed **10/10 — that was wrong.** The records file
  carried two `accept` fields with **no supporting row in
  `audit_results.jsonl`** (`revisions: 0` despite cycle-1 fail verdicts):
  **pilot_06 and pilot_08** were never actually re-audited after the
  facts-revision death, and the fake `accept` values actively blocked the
  auditor's skip filter from re-auditing them.
- Correction (Sep 17 evening, kimi-k3 via Vercel, current content):
  - **pilot_08 → ACCEPT (valid).** Plan beat `disclosure_gate` requires
    returning to the aborted west-driving thread within 2 turns; the
    transcript does it in 1 (T10: "Finish it — driving west and what") and
    holds it (T12: "I'll leave it there for now — but I heard it") with the
    safety artifact at the ending beat. Cycle-1 `thread_death` was
    over-strict; accept verified line-by-line against the plan.
  - **pilot_06 → closed (ACCEPT on attempt 3).** Attempt 1: REVISE (3 flags —
    MCI diagnosis tagged "(told)" with no source, witnessed-landing
    fabrication). Both sessions regenerated (`5xl3e9xy`, 425s, 0 gate
    failures). Attempt 2: REVISE again — the ledger still asserted "MCI" as
    established history although no diagnosis exists in the client's
    statements or the plan. Second revise → HR queue by design.
- **pilot_06 resolution (Sep 17 night):**
  - Root cause was plan-level: `arc_plans/pilot_06.json` carried the MCI
    diagnosis as an established fact (`client.notes` + timeline entry with
    `provenance: "told"`), while the s1 t15 verdict beat is built on the
    therapist NOT diagnosing. Plan patched: MCI is `untold` background that
    "must never be recorded in the ledger as established history or quoted
    from any doctor."
  - Generator root cause: the `hx` ledger field was defined as "salient
    history held across the arc" — broad enough to admit plan-background
    facts. Tightened in `generate_arc_corpus.py` to "ESTABLISHED in this
    arc — only what the client stated or acknowledged in-session" (mirrors
    the `onset` field's constraint).
  - s2 regenerated (`slkhqr20`); zero MCI in any ledger field of either
    session, content hash-verified against the sessions checkpoint.
  - ⚠️ **Stale-duplicate-row gotcha:** regeneration APPENDS a new record row
    instead of replacing the old one, so the superseded row (MCI s2 + `hr`
    verdict) stayed in `arc_records.jsonl`. A post-regeneration check that
    read the stale row reported "MCI still in s2" — false; the new row was
    already clean. Dedup'd with snapshot
    (`arc_records.jsonl.pre_dedup_20260917`).
  - Attempt 3 (kimi-k3, one shot — 2 prior revises made any non-accept
    terminal by the second-revise rule): **ACCEPT** (22.9s, 0 flags). The
    stale HR-queue row was removed (snapshot
    `human_review_queue.jsonl.pre_accept_20260917`).
- **Final: 10/10 arcs accepted, `human_review_queue.jsonl` empty.**
- Audit-trail snapshots: `arc_records.jsonl.pre_reaudit_20260917` (pre-reset
  state, bogus fields intact), `arc_records.jsonl.pre_dedup_20260917` (stale
  duplicate row intact).

### Consolidation run: 140 accepted NF records → master gold (Sep 17)

`consolidate_edge_nightmare.py` has **no verdict awareness** — it ingests
whatever file it is given (cliché gate + quadit gate + dedup only). So the
verdict filter was applied at staging time:

- **Accepted-only decision**: the 70 HR rows (dual-judge diff > 0.15) stay
  held for human review; the 2 rejects stay out. Only the 140 accepted
  records were consolidated.
- **Pre-filter**: accepted key set (140) from `judged_v2`, matched against the
  212 generated records via `record_key` imported from
  `judge_edge_and_nightmare.py` (authoritative `nf:*` / `edge:*` derivation).
  Result staged to `training/output/nightmare_fuel/edge_and_nightmare_accepted.jsonl`
  (explicit name — NOT the default `edge_and_nightmare_generated.jsonl`
  staging path).
- **Run**: `uv run python -m training.consolidate_edge_nightmare
  --inputs .../edge_and_nightmare_accepted.jsonl` → 140/140 emitted,
  0 duplicates (vs 188,969 unique gold hashes), 0 cliché/quadit rejections,
  all 140 routed to `stage3_edge_stress_test`.
- **State after**: `train_master_gold.jsonl` 188,982 → **189,122** lines;
  manifest `training_data_consolidated/final/MASTER_STAGE_3.jsonl` (140);
  no rejections file (0 rejections → nothing written).
- **Idempotent**: immediate re-run → 0 emitted / 140 duplicates, gold stable.
- ⚠️ **Gotcha (eaten once)**: `consolidate()` ALWAYS appends to `gold_path`
  — a "dry run" that passes the real master gold as `gold_path` is NOT
  read-only (manifests/rejects can be redirected, gold cannot). The first
  dry run appended the 140 records for real; recovered by truncating to the
  pre-run byte size (379,422,411) after verifying the 140-tail stamps, then
  re-running clean. A true dry run needs a temp gold copy.

### Quadit gate wired into the ingest path

- `chatml_to_audit_item(record, position)` added to `dataset_gate.py` —
  serializes a ChatML `messages` list into `role: content` lines; raises
  `DatasetGateError` on missing/empty messages.
- `_quadit_reject_reason(gate_record, state)` added to
  `consolidate_edge_nightmare.py` — runs the deterministic quadit audit on a
  single record, returns a reason string or None. Wired into both
  `_process_chatml` (after the cliche gate) and `_process_dpo` (gates
  prompt+chosen only, not the rejected arm). `rejected_quadit: 0` added to the
  summary.
- **Import-path fix:** `ai/` is a git submodule; `ai/.venv`'s editable install
  mapped `ai` → nested `ai/ai` (no `research/`). `training/__init__.py` now
  appends the repo root to `sys.path` (appended, not inserted at 0 — no
  shadowing) so `ai.research.quadit` resolves in both venvs.
- **46 tests pass** (34 quadit + 12 consolidate). Dry-run on the real 212-record
  staging file: **0 rejected_quadit, 0 rejected, 212 emitted** — the corpus is
  clean, the gate is a pure regression guard. Positive control: a record with
  "circle back" rejected as expected.

### Files modified in `ai` submodule

Committed Sep 17 (`2851c1bd4` + `6347d8847`, parent `7e2abd359`):

Quadit/consolidate (this close-out):
- `research/quadit/__init__.py`
- `research/quadit/dataset_gate.py`
- `research/quadit/tests/test_dataset_gate.py`
- `training/__init__.py`
- `training/consolidate_edge_nightmare.py`
- `training/tests/test_consolidate_edge_nightmare.py`

Backend swap (Vercel primary + W&B Inference secondary):
- `training/audit_arc_corpus.py`
- `training/build_edge_and_nightmare_dataset.py`
- `training/dual_judge.py`
- `training/generate_arc_corpus.py`
- `training/generation_backend.py`
- `training/judge_edge_and_nightmare.py`

All committed (Sep 18): `fix(arc-gen)` (ai submodule, `hx` ledger-field
tightening) + parent `docs(nf-pipeline): arc track 10/10 close-out`.

---

## Part 6 — HR-70 resolution + arc scale/budget plan (Sep 18)

### HR-70 human review (CLOSED)

The 70 HR rows (all `dual_inconsistent diff > 0.15`) were settled in three
passes:

1. **Tiebreak** (`ai/training/tiebreak_hr.py`, W&B `8tyc7do7`): third judge
   `minimax/minimax-m3` via Vercel AI Gateway, resumable, 2-of-3 agreement
   rule with safety-keyword override. Initial split: 15 accept / 1 reject /
   35 contested / 19 manual. Two findings:
   - **Minimax-m3 quantizes** — only 8 discrete scores across 70 records
     (0.82 = 40% of them). Usable for agreement, weak for fine ranking.
   - **Decision-rule bug** — first version only checked the top score pair;
     18 rows where the *lower* pair agreed below 0.60 were misfiled as
     "contested" instead of reject. Fixed to check both pairs, then
     `--readjudicate` (deterministic re-score, no LLM calls).
   Final tiebreak: **15 accept / 17 reject / 21 manual (20 safety-flag +
   1 high-outlier) / 17 contested**.
2. **Manual review** (38 records = 20 safety-flagged + 1 high-outlier +
   17 truly contested): full transcripts read, verdict log at
   `checkpoints/hr70_manual_review_20260918.json`. Decision rule: ACCEPT =
   risk engagement proportionate to acuity (active means/plan/timeframe
   require direct assessment; passive/oblique require probe + presence) + no
   iatrogenic harm + 2 of 3 judges ≥ 0.60. Result: **22 accept / 16 reject**.
3. **Staging + consolidation**: 37 approved HR records
   (15 tiebreak + 22 manual) staged to
   `edge_and_nightmare_hr70_accepted.jsonl` → `--inputs` → gold.
   37/37 emitted, 0 duplicates, all `stage3_edge_stress_test`; idempotency
   verified. Final ledger: **177 accepted / 35 rejected** of 212
   (`hr70_final_rejected_20260918.json`). Master gold: **189,122 → 189,159**
   lines.

Notable rejects worth knowing: `nf_046` ("rational suicide" — active
hastened-death plan, zero means/timeline assessment), `nf_062` (imminent
active ideation, no safety work at all), `nf_008` (oblique passive SI never
probed), and one collusive-imagery record (T1_GOLD disqualifier).

### Arc scale + budget plan (DECIDED, not yet executed)

Real pilot cost data (10 arcs, 21 sessions, `deepseek-ai/DeepSeek-V4.1-Flash`
writer + `moonshotai/kimi-k3` auditor, Vercel AI Gateway):

| Metric | Value |
|---|---|
| Writer tokens total | 195,468 (prompt 67,025 + completion 128,443) |
| Per arc | ~19.5k writer tokens, ~2.1 sessions, ~29 turns/session |
| Wall per session | avg 24s (max 65.8s) |
| Cost per arc (writer) | $0.008–0.011 |
| Cost per arc (audit) | $0.008–0.029 |
| Realistic all-in per arc | **$0.03–0.06** (×1.3–1.5 revise multiplier) |

**The binding constraint is wall-clock, not dollars.** 500 arcs ≈ $15–30
(fits the ~$30 Vercel credit with headroom), but at concurrency 4 generation
takes ~2.5h and audit ~13h at concurrency 2.

**The plan-generation bottleneck is resolved (Phase 0, Sep 18)**:
`build_arc_plans.py` (LLM generator, deepseek-v4.1-flash via Vercel) seeds
arcs from the 177 approved records (round-robin across the 11 families),
canonizes `arc_id`/`era_jitter.seed`, and gates every plan through
`lint_arc_plans.py` before writing. The lint is self-contained: schema +
provenance + beat-feasibility checks, an **untold-diagnostic guard** (the
mechanical check that catches the pilot_06 MCI bug class), and set-level
pressure coverage. Both committed as `0f7a266cf`. Verified with 3
generated plans (arc_0001–0003): 0 lint errors, and each plan is
consumable by the writer (`build_session_prompt`: timeline, beats,
carry-forward, grounding) and auditor (`render_beats`) prompt builders.
Note: plans + `seed_map.jsonl` are untracked by design — the repo
gitignore tracks `training/` source code only (the 10 pilot plans are
untracked too); they live on disk at `training/arc_plans/`.

**Phasing:**

- **Phase 0** — ~~build the LLM plan generator + plan lint~~ — **DONE**
  (Sep 18, commit `0f7a266cf`, 3-plan smoke verified).
- **Phase A** — 50 arcs. Gate: ≥85% first-pass audit accept, ≤15% HR.
- **Phase B** — 150 arcs + DPO pairing (accepted vs. HR/reject arcs as
  preference pairs where the defect is clean).
- **Phase C** — 200 arcs → 400 total, ~$22 all-in, budget headroom ~$8.

**Fallback caveat**: W&B Inference (secondary backend) does NOT host
`DeepSeek-V4.1-Flash` — only `DeepSeek-V4-Flash-0731`,
`DeepSeek-V4-Pro-0813`, `DeepSeek-V3.1`. A Vercel outage means a model swap
on the writer, not a seamless failover; pilot-accept rates would need
re-baselining after any swap.

---

## Credentials & env (names only — values live in `/home/vivi/pixelated/.env`)

| Var | State |
|---|---|
| `AI_GATEWAY_API_KEY` | **primary** — Vercel AI Gateway (OpenAI-compatible, 374 models, 200 OK) |
| `NF_BACKEND` | `vercel` (current primary; was `featherless`) |
| `NF_MODEL` | `deepseek/deepseek-v4-flash-0731` (Vercel namespaced); wandb secondary default `deepseek-ai/DeepSeek-V4-Flash-0731` |
| (Vultr) | fully removed 2026-09-17 — `VULTR_INFERENCE_API_KEY` no longer exists in code or `.env` |
| `FEATHERLESS_API_KEY` / `_KEY_2` | both present (67 chars each, tails `…0d5b3` / `…772db`); quota-exhausted (the Sep 15 402 wall) — no longer the active backend |
| `NF_CONCURRENCY` | 8 (passed at launch, not persisted in .env) |
| `WANDB_API_KEY` / `WANDB_PROJECT` | set; project `pixelated-empathy-kan28`; the key also authenticates W&B Serverless Inference (`NF_BACKEND=wandb`, the secondary provider) |
| Key rotation | `ai/training/featherless_keys.py` — `KeyPool` reads `FEATHERLESS_API_KEY`, `_2`, … in order, rotates on `http_429`/`http_402` (see `is_rotate_status`); only applies to the `featherless` backend |

⚠️ The launch-day terminal log contains a user-pasted key in plaintext
(`rc_1fa43e05...`). It is the same key now tracked in `.env`; no action needed,
but avoid copying terminal-captured keys into new docs.

## W&B runs

| Run | What |
|---|---|
| `87r7phxo` (`nf_bulk_20260913_173220`) | NF bulk generation — `generated: 212, rejected: 0, dropped: 0` (W&B `written_total: 92` counts only the nightmare-scenario track; the 120 edge-case records are logged per-combo) |
| `arc-generate-20260915-050936` (`2ye8a2mf`) | arc pilot cycle 2 (sessions 3, arcs 2, 45k tokens, 0 errors) |
| `arc-generate-20260915-134703` (`1tre3t80`) | facts-revision attempt (died on 402s) |
| `vj3ng5vs` | arc generate run 1 (Sep 17) — 8 sessions, 5 arcs |
| `97npffak` | arc pilot_09 retry (Sep 17) — 1 arc |
| `pg64aimb` | arc pilot_01 regenerate (Sep 17) — 1 arc, re-audited ACCEPT |
| `5xl3e9xy` | arc pilot_06 s2 regenerate (Sep 17 night, attempt 2, pre plan-fix) — REVISE again (MCI) → HR |
| `slkhqr20` | arc pilot_06 s2 regenerate (Sep 17) — plan-fixed MCI arc; 3rd audit ACCEPT |
| `8tyc7do7` | HR-70 third-judge tiebreak (Sep 18) — 70 rows, minimax-m3 via Vercel |
| `9fpcyelc` | NF pre-flight (Sep 17) — 1 record, passed |
| `r2fkgmd9` | NF regeneration + re-judge (Sep 17) — 92 new + 1 preflight on Vercel |

---

## Next steps (in order)

1. ~~**Finish pilot**~~ — **DONE**: 10/10 accepted (Part 5,
   audit-integrity correction, pilot_06 closed on 3rd audit).
2. ~~**NF close-out** (reconcile the three verdict sets on the 212)~~ — **DONE**
   (Part 5): 93 regenerated + re-judged on Vercel; final 140 accepted / 70 HR /
   2 rejected, 0 drift on retained rows.
3. ~~**Quadit gate in the ingest path**~~ — **DONE** (Part 5): wired into
   `consolidate_edge_nightmare.py`, 46 tests pass, dry-run 0/212 blocked.
4. ~~**Consolidation run**~~ — **DONE** (Part 5): 140 accepted → master gold
   189,122 lines + `MASTER_STAGE_3.jsonl`, idempotency verified.
5. ~~**Commit the `ai` submodule changes**~~ — **DONE** (Sep 17): `2851c1bd4`
   (quadit/consolidate), `6347d8847` (backend swap), parent `7e2abd359`
   (handoff + submodule pointer). Nothing pushed.
6. ~~**Pilot-arc inspection**~~ — **DONE** (Sep 17): audit-trail inspection
   found the two bogus accepts; pilot_08 verified against its plan beats;
   pilot_06 flagged to HR (ledger integrity, plan-level MCI).
7. ~~**pilot_06 HR decision**~~ — **DONE** (Sep 17 night): plan fixed
   (MCI → untold), generator `hx` field tightened, s2 regenerated, 3rd audit
   **ACCEPT** → 10/10 arcs. Arc track fully closed pending the scale
   decision.
8. ~~**HR-70 human review**~~ — **DONE** (Part 6): third-judge tiebreak
   (`tiebreak_hr.py`, minimax-m3) + 38-record manual review → 37 approved
   (22 manual + 15 tiebreak) staged to gold; final 177 accepted / 35
   rejected; gold 189,159.
9. **Arc scale-up** — Phase 0 **DONE** (generator + lint, `0f7a266cf`).
   Next: Phase A (50 arcs, ≥85% first-pass audit accept gate), then B
   (150 + DPO pairing), C (200 → 400 total ≈ $22).
10. **Parity-gate question** — shelved. If ever revisited: targeted clean
    re-judge of the 14 poisoned rows only, ≥0.71 mean ⇒ parity ⇒ optional vLLM
    flip.

## Key file locations

| What | Where |
|---|---|
| NF generator / backend / gate | `ai/training/build_edge_and_nightmare_dataset.py`, `generation_backend.py`, `cliche_gate.py` |
| Dual judge / HR tiebreak | `ai/training/judge_edge_and_nightmare.py`, `eval_boulesis_vs_ornith.py`, `dual_judge.py`, `tiebreak_hr.py` |
| Ingest / consolidation (quadit-gated) | `ai/training/consolidate_edge_nightmare.py` (step 9; reads `edge_and_nightmare_generated.jsonl`, appends to `MASTER_STAGE_N.jsonl` + `train_master_gold.jsonl`) |
| Arc track | `ai/training/ARC_CORPUS_SPEC.md`, `generate_arc_corpus.py`, `audit_arc_corpus.py`, `build_pilot_arc_plans.py`, `build_arc_plans.py` (LLM plan generator), `lint_arc_plans.py`, `probe_arc_writer.py`, `probe_arc_bakeoff.py`, `featherless_keys.py` (plans on disk at `training/arc_plans/`, untracked by design) |
| NF outputs | `ai/training/output/nightmare_fuel/checkpoints/` |
| Parity-saga eval artifacts | `ai/training/eval_results/` (incl. `judge_sharedkey_contaminated.json`, `judge_variance_proof.md`, `comparison_report.md`) |
| Arc outputs | `ai/training/output/arc_corpus/` (+ `run_logs/`) |
| Arc plans | `ai/training/arc_plans/pilot_01..10.json` |
| Quadit | `ai/research/quadit/`, `scripts/qa/` (gate adapter) |
| Terminal captures | `~/.pochi/terminals/term-2a487e83-*.log`, `term-c2adead5-*.log`, `term-38fc06ca-*.log` |
| AdaptionLabs prefill (not submitted) | `.mastracode/plans/adaption-startups-application-prefill.md` |
| Foresight memory | `ce7ab5fd` (NF launch), `ce23d62c3`/`198bae19b` (bulk runner + GLM probe) |

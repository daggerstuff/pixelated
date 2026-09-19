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

**Phase A execution (Sep 18, in progress)**:

- **Plans**: 50 written (arc_0001–arc_0053, gaps 0038/0044/0045 from
  plan-gen lint failures, backfilled at 0051–0053). `build_arc_plans.py`
  gained `--start` + seed-map dedup for resume-safe numbering
  (`cf6c4edae`). 0 lint errors across the 60-plan directory.
- **Writer**: 117/117 sessions, 50/50 records complete, 2.44M writer
  tokens. W&B runs `1no17qro` (initial, killed) + `m2ww2a6g` (orphan
  incident) + `au0y0c6e` (fixed-gate main) + `q77pr105` (resume) +
  `nes0748z` (arc_0001 final).
  Root-caused + fixed mid-run: `_tl_anchor_keys` split ledger strings on
  commas, so descriptions containing commas produced phantom "anchor"
  keys → spurious `tl_drift` hard failures (4 sessions in the first 15).
  Anchors are now matched as the short time token (`now`, `-6w`, `+1y`)
  at entry boundaries (`4cb1c0968`); all 537 checkpointed ledgers pass
  the anchor-persistence check. Two plans (arc_0001, arc_0019) needed
  their misstatement quotes shortened to single-clause fragments —
  long verbatim quotes split across therapist turns can never pass
  the beat-containment gate.
- **Audit**: 50/50 audited — **20 accept / 30 revise / 0 HR** (first
  pass 40%; pilot first pass was 2/10 before its revision cycle).
  Flag distribution: ledger_contradiction 47, fabrication 16,
  thread_death 13, tl_drift 10, truth_withholding 6, safety_failure 4.
  20 accepted arcs remain in `arc_records.jsonl`; the 30 revised arcs
  were dropped for regeneration (audit notes at
  `arc_audit_notes/`).
- **Revision cycle (Sep 18–19) — COMPLETE**. Vercel credit blocker
  resolved by re-homing the arc track to **Featherless** (user-supplied new
  key `rc_d93c…` as `FEATHERLESS_API_KEY`; the old `rc_e070…` stayed as
  `_KEY_2` — two accounts = two 1-slot concurrent writer slots). Writer =
  `deepseek-ai/DeepSeek-V4.1-Flash` (spec model, provenance-consistent with
  the 20 first-pass accepts); auditor = `moonshotai/Kimi-K2.6` (Kimi-K3
  delisted from Featherless). `generate_arc_corpus.py` gained
  `ARC_WRITER_KEYS` env override (matches the auditor's
  `ARC_AUDITOR_KEYS`).
  - **Root-cause fixes applied mid-cycle** (commit `a2b1f8939`):
    `turn_count` gate was a fixed ±2 tolerance — V4.1-Flash drifts ±5
    turns, and turn_count was the dominant retry sink. Now scaled
    `_turn_tolerance(target)` (floor 3, cap 6, 40% of target); **zero**
    turn_count failures after the fix. Anti-parroting prompt hardened
    (banned-opener list incl. the boundary-affirmation template;
    corrective note now quotes the offending line). `tl` anchor-persistence
    rule for s2+. `lint_arc_plans.py` gained `_check_calendar` (case-
    sensitive month/year in beat/notes text — catches the arc_0052
    "since March" class).
  - **Plan-level fixes**: arc_0052 misstatement quote "since March" →
    "since he took it" (calendar gate bug, not model); arc_0035 brittle
    12-word verbatim revision quote → 7 words (multi-word verbatim quotes
    split across turns can never pass beat-containment).
  - **Runs**: revision writers A4 `cvgl1col` (22 sessions/13 arcs, 336k
    tokens) + B4 `gnivy7mn` (16/9, 247k) at concurrency 1 per
    Featherless account; holdouts `k7ljm2dv` (arc_0005 s2 — plan clean,
    model-reliability holdout, escalated to `deepseek-ai/DeepSeek-V4-Pro`,
    mixed provenance noted) + `5bnvlg1j` (5 sessions/3 arcs: arc_0035
    s2+s3, arc_0051 s1+s2, arc_0052 s3). Canonical merge → 60/60 records,
    138 checkpoint rows, 0 duplicates.
  - **Re-audit**: r2 (Featherless, pre key-pool fix) audited 3 —
    arc_0010 ACCEPT, arc_0004 + arc_0011 HR — then 27 errors (the pool
    still carried the Vercel key, which 401s on the Featherless URL).
    r4 (Featherless, pool fixed to the two Featherless keys): 23/23 →
    7 accept, 16 HR, 0 errors (1058s). r5: 4 arcs over the context cap
    (below) → W&B Kimi-K2.6, 1 accept (arc_0052), 3 HR, 0 errors (287s).
- **Featherless 32k context cap (discovered via the r3 400s)**: the plan
  tier caps Kimi-K2.6 at **32,768 prompt tokens**. Four revised arcs
  exceed it (arc_0006 ~44.5k, arc_0043 ~45.5k, arc_0052 ~43.8k, arc_0039
  ~31.6k+system) → routed to W&B Inference Kimi-K2.6 (no cap; verified
  43.3k-token prompt → full 12k-char verdict, finish=stop). The 400 body
  was previously discarded by `call_auditor` — non-200 responses now
  carry the first 200 chars of the body.
- **GATE EVALUATION (final Phase A state, 50 arcs)**:
  - **29/50 accepted (58%) / 21/50 HR (42%) / 0 hard rejects.**
  - Gate (≥85% accept, ≤15% HR): **NOT MET.**
  - HR-21 splits into two cohorts: **10 with safety_failure flags**
    (arc_0001, 0006, 0011, 0012, 0013, 0024, 0032, 0033, 0039, 0048)
    needing clinical review, and **11 without** (arc_0004, 0005, 0007,
    0018, 0020, 0022, 0035, 0041, 0043, 0049, 0050) whose flags are
    ledger/mechanical/narrative.
  - Revision-cycle flag distribution: ledger_contradiction 61, tl_drift
    25, thread_death 24, safety_failure 14, comfort_lie 9, capitulation
    7, truth_withholding 5, false_certainty 3, integrity_violation 1.
  - Precedents: NF HR-70 manual review accepted 22/38 (58%), including
    13/20 safety-flagged rows; pilot-track HRs resolved via plan fix +
    regen (pilot_06) and manual override (pilot_08).
  - Note: **no arc→ChatML export exists yet** — the ledger (think-block)
    keep-vs-strip is an open export design decision; 58% of all
    revision-cycle flags are ledger/mechanical, so their training-data
    severity depends on that decision.
  - **DECISION POINT**: do not start Phase B until HR-21 is triaged.
    Lanes: (1) the 11 no-safety arcs → reset verdict + regenerate
    flagged sessions + one-shot re-audit (pilot_06 pattern); (2) the 10
    safety-flagged arcs → manual clinical review (NF HR-70 pattern).
    Expected: ~12–13 more accepts → ~42/50 (84–86%), ~8 rejects.

## Part 7 — HR-21 triage + auditor-model eval (Sep 18–19)

Both HR-21 lanes executed; the Featherless community-model auditor option
was eliminated by a controlled eval.

### Lane 2 — 10 safety-flagged arcs → manual clinical review (CLOSED)

Full transcripts read under the NF HR-70 rule (risk engagement
proportionate to acuity + no iatrogenic harm). Verdict log:
`output/arc_corpus/lane2_manual_review_20260919.json`. Result: **8 accept /
2 reject**.

- Accepts: arc_0001, 0006, 0011, 0012, 0024, 0032, 0039, 0048 — staged as
  `accept` with a `manual_review` annotation in the audit block.
- Rejects: **arc_0013** (s2 ledger fabricates "looked up carbon monoxide
  (told)" — the client explicitly denied looking anything up) and
  **arc_0033** (s3 ledger fabricates four s2 carry-overs, including an
  inverted insurance denial). Same bug class as pilot_06 (cross-session
  ledger fabrication), and both survived two automated audit passes.

### Lane 1 — 11 mechanical arcs → reset + regenerate (DONE, pending re-audit)

Verdicts reset (records 60→49, checkpoint 138→115, snapshots
`.pre_lane1_20260918`), audit notes reconstructed, then all 11 arcs
regenerated on the two Featherless writer slots — plus the 2 lane-2
rejects (arc_0013 s2, arc_0033 s3), which regenerated in canonical. 13/13
arcs complete: 26 lane-1 sessions + 2 lane-2 sessions. Multiple writer
restarts (429 storms, gate failures). Mid-run fixes now in
`generate_arc_corpus.py`:

- **CARRY-OVER LEDGER RULE** (targets the 0013/0033 bug class): every `sN:`
  ledger carry-over must be traceable to a quoted client line or VERIFIED
  FACT; never carry the opposite of a stated fact; never add specifics
  (times, amounts, insurance, plans) that no line contains.
- Anti-parroting v4: when pointing at a word the client dropped, the quoted
  fragment is the opener ("Last time. You let it walk past.") — never
  "You said <word>".
- Plan fixes: arc_0018 (13-word multi-clause misstatement → two short
  fragments), arc_0049 opener (passed after the 4th anti-parroting
  iteration), arc_0050 completed clean.

### Closeout — canonical merge (Sep 19)

Lane-1 A/B checkpoints + records merged into canonical, dedup on
(arc_id, session_n); the 3 overlapping rows were byte-identical (writer
resume re-emitted existing sessions). Final state: **60 unique arcs
(10 pilots + 50 Phase A), 138 checkpoint rows, 0 duplicates**; per-arc
session counts match `metrics.sessions` for all 60. Audit state:
**47/60 final accept / 13 regenerated-pending-re-audit / 0 HR** (47 = 10
pilots + 20 first-pass + 9 re-audit + 8 lane-2 manual).

### Auditor-model eval — all 6 Featherless community models DQ (Sep 19)

Directive: find the best of six Featherless models for the arc-audit task.
Harness: `ai/training/eval_audit_models.py` (imports the auditor prompt +
verdict parsing from `audit_arc_corpus.py` — single source of truth).
Probe set: 17 arcs with ground truth = the 2 known fabrication defects
(arc_0013/0033, the exact bug class under test) + 15 known accepts (8
lane-2 manual + 5 K3 first-pass + 2 pilots). Scoring: composite =
0.45·defect_caught + 0.35·agreement + 0.20·(1−false_revise);
disqualified when infra_rate < 0.8. Sequential per model (Featherless
caps at 4 model switches/min). Results: `output/arc_corpus/eval_audit/`
(102 rows `results.jsonl` + `leaderboard.json`). No W&B run — direct API
calls.

| Model | infra | defect caught | agreement | false revise | composite | DQ |
|---|---|---|---|---|---|---|
| fable (Qwen3.8-27B heretic) | 0.529 | 1/2 (mislabeled) | 5/17 | 4/15 | 0.475 | yes |
| orion (Orion-26B-A4B) | 0.529 | 0/2 | 8/17 | 0/15 | 0.365 | yes |
| obliterated (Qwen3.8-27B) | 0.529 | 0/2 | 8/17 | 0/15 | 0.365 | yes |
| boulesis (Boulesis-26B-A4B) | 0.529 | 0/2 | 8/17 | 0/15 | 0.365 | yes |
| novelist (Gemma-4-Novelist-31B) | 0.471 | 0/2 | 7/17 | 1/15 | 0.331 | yes |
| artemis (Artemis-31B) | 0.471 | 0/2 | 7/17 | 1/15 | 0.331 | yes |

Two fatal flaws, independent of each other:

1. **32,768-token context wall** — 8/17 probes hard-failed (every
   3-session arc is ~44k tokens at audit-prompt length). infra_rate
   0.47–0.53 ⇒ all six below the 0.8 DQ bar before any quality question.
2. **Zero clinical sensitivity** — 5/6 models accepted outright the two
   ledger fabrications that the HR-21 lanes exist to catch; the only
   detection (fable, 1/2) mislabeled the category, and fable also
   over-flags 4/15 clean arcs. Most models flag nothing (0–1 flags total).

**Conclusion**: no Featherless community model is usable as a clinical
auditor. `ARC_AUDITOR_MODEL` stays `moonshotai/Kimi-K2.6` (Featherless,
W&B Inference route for 3-session arcs over the 32k cap — same route used
in re-audit r5).

**OPEN DECISION — re-audit model for the 13 regenerated arcs**:
(A) Kimi-K2.6 on Featherless (recommended — ~$0, 27 prior audits,
0 infra errors post key-pool fix, W&B route for over-cap arcs);
(B) Vercel top-up ~$5–10 for Kimi-K3 (spec purity vs the 20 first-pass
accepts); (C) manual review of all 13.

---

## Credentials & env (names only — values live in `/home/vivi/pixelated/.env`)

| Var | State |
|---|---|
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway (OpenAI-compatible, 374 models) — **credits exhausted (402) as of Sep 18** (~$30 consumed by Phase A); arc track moved to Featherless; top-up required before any further Vercel use (Part 7 decision B) |
| `NF_BACKEND` | `vercel` (current primary; was `featherless`) |
| `NF_MODEL` | `deepseek/deepseek-v4-flash-0731` (Vercel namespaced); wandb secondary default `deepseek-ai/DeepSeek-V4-Flash-0731` |
| (Vultr) | fully removed 2026-09-17 — `VULTR_INFERENCE_API_KEY` no longer exists in code or `.env` |
| `FEATHERLESS_API_KEY` / `_KEY_2` | **arc-track primary** (Sep 18): `rc_d93c…` (new, user-supplied) + `rc_e070…` (old, still valid) — 2 accounts × 1 concurrent slot each; plan caps Kimi-K2.6 at 32,768 prompt tokens |
| `ARC_WRITER_*` / `ARC_AUDITOR_*` | `.env` block: URL=`api.featherless.ai/v1/chat/completions`, writer model `deepseek-ai/DeepSeek-V4.1-Flash`, auditor model `moonshotai/Kimi-K2.6`, key pools `FEATHERLESS_API_KEY,FEATHERLESS_API_KEY_2` (Vercel key REMOVED from pools — it 401s on the Featherless URL) |
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
| `cvgl1col` / `gnivy7mn` | Phase A revision writers A4/B4 (Sep 19, Featherless) — 38 sessions/22 arcs, 583k tokens |
| `k7ljm2dv` / `5bnvlg1j` | Phase A holdout sessions (Sep 19): arc_0005 s2 on V4-Pro; 5 sessions/3 arcs (arc_0035/0051/0052) on V4.1-Flash |
| `mlcsijau` | Phase A plan generation (Sep 18) — 50 plans, 511,679 tokens, ~$0.53 |
| `g07hni0g` / `sozac3cp` | Lane-1 regen writer A / A2 (Sep 18–19, Featherless) |
| `sqceo287` / `oshn9fjd` | Lane-1 regen writer B / B2 (Sep 18–19, Featherless) |
| `446bqsup` | Lane-2 reject regen (arc_0013 s2, arc_0033 s3) |

---

## Part 8 — K3 re-audit of 13 + full HR verification + accept-cohort contamination (Sep 19)

### Auditor switch

- `.env` auditor: `moonshotai/kimi-k3` on Vercel AI Gateway
  (`AI_GATEWAY_API_KEY` — new key `vck_5F1n...`, old key 401-dead),
  `ARC_AUDITOR_MAX_TOKENS=24576` (K3 is a reasoning model; ≤12k budget gets
  burned by thinking before the JSON verdict is emitted — GLM-5.3/Flash died
  the same way).
- Gotcha: `audit_arc_corpus.py` loads `.env` with `override=True`, which
  clobbers shell env. First re-audit launch (19:06) silently ran K2.6 via
  Featherless instead of K3 via gateway; fixed `.env` at 19:26, clean K3
  re-audit at 19:27. The accidental K2.6 run is archived at
  `audit_results.k26_reaudit_20260919.jsonl` +
  `human_review_queue.k26_reaudit_20260919.jsonl`.

### K3 17-probe eval (the gate)

- 16 valid / 1 unparseable (arc_0013: 12k budget, 329s).
- 11 of 15 "clean" probes flagged. Spot-check verification proved **all 11
  flags genuine** — the probe set's "accept" ground truth was wrong on 11/15
  (73%). Verified fabrications include: arc_0001 (three-week timing of the
  bay walk the client denied), arc_0032 (mother asserted in S1 ledger, never
  mentioned in S1), arc_0039 ("front door key on his side of the bed" —
  client never stated key location), pilot_01 ("ten days ago" vs the plan's
  7-day "next week" interval), arc_0024 ("ex" asserted, 0 hits in S1 client
  turns), arc_0034 (public-record details the client never gave).

### K3 re-audit of the 13 regenerated arcs (404s, 0 errors)

- **ACCEPT (3)**: arc_0033, arc_0022, arc_0041 — all three verified clean at
  claim level (fabrications removed in regeneration; K2.6's 5/19/5 flags on
  0033/0022/0041 were against pre-regeneration versions).
- **HR (10)**: arc_0004 (4), arc_0005 (2), arc_0007 (1), arc_0013 (4),
  arc_0018 (5), arc_0020 (2), arc_0035 (6), arc_0043 (5), arc_0049 (1),
  arc_0050 (2).
- K2.6 vs K3 disagreed on 4 arcs; K3 verified correct on all 4.

### Claim-level verification of all 36 HR flags

**35 genuine + 1 partial (arc_0013 "Ivy" name, plan-sanctioned) + 0 false
positives.** Every K3 flag in the re-audit survived verification.

Recurring writer bug classes (DeepSeek-V4.1-Flash):

| Class | Example |
|---|---|
| Line duplication (therapist speaks client's line, client repeats) | arc_0013 T22/T23, arc_0020 T24/T25, arc_0043 T16/T17, arc_0004 S2 T9/C10 |
| Invented specificity (vague → precise number/date/place) | arc_0013 "few weeks"→"three weeks", arc_0007 "three weeks of quiet", arc_0018 "six years"/"fourteen months"/"-9d", arc_0049 "nine weeks", arc_0035 "two days ago" (was this morning), arc_0050 "card"/"sister" |
| tl_drift (anchor silently altered/dropped, no revision tag) | arc_0035 `now: today`→`-2d`, arc_0021 5 anchors dropped T1→T2, arc_0043 "her door"→"his door" gender-swap across all S2/S3 ledgers |
| Cross-session ledger fabrication (MCI-class) | arc_0043 S3 "father yelled a lot (s1)" — father first appears S3 T17 |
| Premature `(told)` tags | arc_0048 "-5d: voicemail from 'her' mother (told)" one turn before C12 disclosure |
| Safety misclassification | **arc_0011: client discloses arm-picking self-harm at S2 C12, same-turn ledger says `risk: none — no self-harm content this turn`** |
| Capitulation (granted autonomy re-imposed) | arc_0012 T5 "you can refuse the nurse" → T6 "you get food and fluid down — that's the order" |

### Disposition: 11 contaminated accepts → HR

The 11 probe-verified fabrications sat in the **accept** cohort. Moved to HR
(snapshot `.pre_probehr_20260919`): arc_0001, arc_0006, arc_0011
(safety-critical), arc_0012, arc_0021, arc_0024, arc_0032, arc_0034,
arc_0039, arc_0048, pilot_01. `arc_records.jsonl` audit set to `hr` with K3
probe flags + `probe_verification` annotation; 11 queue entries appended
(`source: k3_probe_verification_20260919`).

### Final corpus state (60 arcs)

- **39 accept**: 36 from earlier cycles + 3 K3 re-audit accepts; 4 of the 39
  probe-verified clean (arc_0002, arc_0008, arc_0014, pilot_08), **35
  never audited by K3**
- **21 HR**: 10 from K3 re-audit + 11 from probe verification
- Master gold **not yet touched** by any arc-track record (still 189,159
  lines = base + NF only) — all contamination found so far is fixable before
  staging

### Open decision

39-arc K3 `--reaudit` sweep of the full accept cohort (35 unprobed + 4
probe-clean re-check): at ~31s/arc with concurrency 2 ≈ 20–30 min wall, a few
dollars on the gateway. Given 73% of the probe-set accepts were contaminated,
the sweep is strongly indicated before staging any arc-track records to gold.

---

## Part 9 — 39-arc K3 accept-cohort sweep, verification, final state (Sep 19)

### Sweep execution (3 chunks)

- **Chunk 1** (20 arcs, 464s): 16 accept, 1 revise (arc_0029), 3 HR (arc_0010,
  arc_0019, arc_0025), 0 errors.
- **Chunk 2** (19 arcs): 6 completed (pilot_07 accept; 5 revise — pilot_02 4f,
  pilot_03 1f, pilot_05 8f, pilot_08 1f, pilot_10 1f) then **13 × HTTP 402**
  (gateway credits exhausted mid-run). No zero-touch K3 failover exists (W&B
  Inference has K2.6/K2.7-Code only).
- **Chunk 3** (13 arcs, 379s, after user $10 top-up of `vck_5F1n6…`): 6 accept
  (arc_0036, arc_0041, arc_0046, arc_0047, arc_0053, pilot_06), 3 revise
  (arc_0037 1f, pilot_04 4f, pilot_09 3f), 4 HR (arc_0040 1f, arc_0042 5f,
  arc_0051 3f, arc_0052 7f), 0 errors. 3-session arcs (incl. arc_0043's
  39k-token probe) audit cleanly on the gateway — no 32k wall.

**Sweep totals (39 arcs): 23 accept / 9 revise / 7 HR / 0 infra errors.
16/39 flagged (41%).** Snapshot: `.pre_sweep_20260919`.

### Claim-level verification of all 53 sweep flags

29 flags (chunks 1–2) + 24 flags (chunk 3) = **53 flags: 51 genuine, 2 false
positives (96.2%)**. K3's cumulative record for Sep 19 across re-audit + probe
verification + sweep: **100 flags, 97 fully genuine, 1 partial (arc_0013
"Ivy", plan-sanctioned), 2 FP.**

The 2 FPs (both annotated `DISPROVEN` in `arc_audit_notes/` so the writer does
not "fix" them):

- **pilot_04 s2 t12 [thread_death]** — flag claimed the aborted "that's the
  part—" phrase is "never resurfaced… in session 3". S3 T9 resurfaces it
  verbatim ("that's the part that's costing you"); the client also completes
  the disclosure within the same turn. Flag's ledger quote doesn't match the
  actual ledger.
- **pilot_09 s1 t13 [ledger_contradiction]** — flag read "in, I don't know, a
  couple of months" as ~-7m (couple of months post-death). Client-stated
  duration; `-2m` is the defensible reading. Keep as written.

### New defect evidence from the sweep (patterns now in the catalog)

- **Phantom quotes**: pilot_05 ledger asserts client quotes ("they just
  decided I was the problem (told)", "if I stop watching, they win (told)")
  that exist nowhere in the transcript.
- **Integrity violation**: arc_0019 therapist promises "I won't confirm
  you're in treatment" in the same breath as "your employer sees
  attendance" + S2 "letter confirming you attended".
- **Thread death**: arc_0025 (sister's Sunday call), pilot_05 (ex-wife,
  "She used to say—") — aborted disclosures never returned.
- **Silent date inventions**: pilot_02 (-5m/-2m where S1 ledgers all carried
  onset="not stated"), pilot_05 (-8m/-3w/-5m), arc_0051 (-3y/-1y on a
  first-session client — "Session one of whatever this is" flatly contradicts
  `-1y: started current therapy (told)`).
- **Invented third-party name**: arc_0052 "Mara" — appears only in the
  therapist's own line, never stated by the client.
- **Invented manner of death**: pilot_09 S3 T6 "A motorcycle on a road killed
  him" — cause of death never stated anywhere in the arc, at the arc's
  central moment.

### Final corpus state (Sep 19, pre-regeneration)

- **arc_records.jsonl: 51 arcs** = 23 accept + 28 HR (9 revise arcs' records
  deleted — re-enter on regeneration).
- **sessions_checkpoint.jsonl: 124 rows** across 58 arc ids (revise arcs
  keep unflagged sessions: arc_0029 [3], arc_0037 [2], pilot_02 [1],
  pilot_03 [1], pilot_08 [2], pilot_09 [2], pilot_10 [1]; pilot_04/pilot_05
  fully emptied).
- **human_review_queue.jsonl: 28 entries** (21 pre-sweep + 7 sweep).
- Accept cohort = 23 arcs, all K3-audited this day; 4 additionally
  probe-verified clean earlier (arc_0002, arc_0008, arc_0014, pilot_08→now
  revise, so 3: arc_0002, arc_0008, arc_0014).
- Master gold **untouched** (189,159 lines = base + NF only).

### Regeneration backlog (next)

- **9 revise arcs**: writer resumes the 14 dropped sessions (arc_0029 s1–s2,
  arc_0037 s1, pilot_02 s2, pilot_03 s2, pilot_04 s1–s3, pilot_05 s1–s2,
  pilot_08 s1, pilot_09 s1+s3, pilot_10 s2); corrective notes in
  `arc_audit_notes/` (2 FP items annotated).
- **28 HR arcs**: full-arc reset (drop all session rows + records,
  reconstruct corrective notes from `audit_results` flags_final via
  `write_audit_note` logic, arc_0011 = safety-priority).
- Then K3 re-audit of all regenerated sessions, repeat until clean, then
  consolidate to gold (quadit-gated) → Phase B (150 arcs) / C (→400).

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
9. **Arc scale-up** — Phase 0 **DONE** (`0f7a266cf`). Phase A **writer +
   first-pass audit + revision cycle + HR-21 triage + K3 re-audit DONE**
   (Sep 18–19): lane-2 manual 8/10, lane-1 11 + 2 rejects regenerated
   (13/13), canonical 60 arcs / 138 sessions. Auditor-model eval: all 10
   candidate models **DQ** (Part 7); K3 on gateway is the auditor (Part 8).
   K3 re-audit of 13: 3 accept / 10 HR, 0 false positives on 36 flags; 11
   more accepts found contaminated via probe verification and moved to HR →
   **39 accept / 21 HR**. 39-arc K3 `--reaudit` sweep **DONE** (Part 9):
   23 accept / 9 revise / 7 HR, 53 flags verified (51 genuine, 2 FP) →
   final **23 accept / 28 HR** + 9 revise arcs pending regeneration.
   **NEXT: (a) regenerate 37 arcs (28 HR full reset + 9 revise resume;
   arc_0011 = safety-priority), K3 re-audit, iterate, (b) consolidate to
   gold (quadit-gated), (c) Phase B (150 + DPO pairing), C (200 → 400 total
   ≈ $22).**
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
| Arc outputs | `ai/training/output/arc_corpus/` (+ `run_logs/`, `sweep_chunk1..3.log`) |
| Auditor-model eval | `ai/training/eval_audit_models.py` → `output/arc_corpus/eval_audit/` (`results.jsonl` 102 rows, `leaderboard.json`) |
| Lane-2 manual verdict log | `output/arc_corpus/lane2_manual_review_20260919.json` |
| Arc plans | `ai/training/arc_plans/` — pilot_01..10 + arc_0001..0053 (60 plans on disk, untracked by design) |
| Quadit | `ai/research/quadit/`, `scripts/qa/` (gate adapter) |
| Terminal captures | `~/.pochi/terminals/term-2a487e83-*.log`, `term-c2adead5-*.log`, `term-38fc06ca-*.log` |
| AdaptionLabs prefill (not submitted) | `.mastracode/plans/adaption-startups-application-prefill.md` |
| Foresight memory | `ce7ab5fd` (NF launch), `ce23d62c3`/`198bae19b` (bulk runner + GLM probe) |

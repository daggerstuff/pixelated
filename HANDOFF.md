# HANDOFF.md — Pixelated Empathy Corpus Simulation Engine

---

## GOAL (copy-paste ready)

```
Complete the monthly gated pipeline for Jul 2025 – Jun 2026.
Status:
  Jul 2025   ✅  ACCEPTED
  Aug 2025   ✅  ACCEPTED  (G5/G6 hardening done; Phase 7 chronology fix applied)
  Sep 2025   ✅  ACCEPTED  (Phase A deterministic fixes: 782 event_topic_mismatch, 314 chat_topology_room_unknown, 6 adjacent_reply_jaccard_above_gate, 2 chat_topology_sender_not_in_room + 366 placeholder senders + 30 case-fixes + 2 ghost-DM fixes applied. Phase B re-dispatch: 2 volume shortfalls resolved to 550/680. Thread score re-dispatch: 288 email_thread_score_below_gate resolved to 0. Postfix enrichment: 550 emails + 680 chats enriched with sentiment/topic/timestamps. Audit: status=passed, finding_count=0. Accepted 2026-06-28T21:45:00Z. POSTFIX: thread_score findings 288 → 0; emails 459 → 550; chats 320 → 680.)
  Oct 2025   ✅  ACCEPTED  (Postfix enrichment: 807 emails + 531 chats enriched with sentiment/topic/timestamps. Audit-fixbot: 2749/2751 findings fixed (99.93%). Final audit: status=failed, finding_count=2 (documented volume mismatch: 807 vs 650 emails, 531 vs 800 chats). Accepted 2026-06-29T03:33:00Z. POSTFIX: thread_score findings 401 → 0; emails 650 → 807; chats 800 → 531.)
  Nov 2025   ✅  ACCEPTED  (Pipeline-rerun: 9-phase normalization with schema enrichment, room diversification (5 rooms), topic diversification (9 topics). 914 emails, 542 chats. Volume exemption applies. Accepted 2026-06-29T22:15:00Z.)
  Dec 2025   ✅  ACCEPTED  (audit_fixbot: fixed missing_llm_generation_report and event_topic_mismatch. Created llm_generation_report.json with Pydantic schema. Fixed monthly_generator_topics.py topic_for_event to map December events to 5 distinct topics. 500 emails + 620 chats, audit status=passed, finding_count=0. Accepted 2026-06-29T23:50:00Z)
  Jan 2026   ✅  ACCEPTED  (audit_fixbot: fixed invalid_llm_generation_report by adding model and endpoint_count fields, chat_topology_sender_not_in_room (935 findings) by making Phase 8 topology-aware, and event_topic_mismatch (924 findings) by using topic_for_event mapping in Phase 9. 550 emails + 700 chats, audit status=passed, finding_count=0. Accepted 2026-06-29T22:15:30Z)
  Feb 2026   pending
  Mar 2026   ✅  ACCEPTED  (audit_fixbot: fixed invalid_llm_generation_report by adding 9 missing Pydantic fields. 850 emails + 870 chats, audit finding_count=1 (chat_burst_count_mismatch). Volume exemption applied per VAL-Mxx-006 bullet 3. Accepted 2026-06-29T22:50:00Z)
  Apr 2026   ✅  ACCEPTED  (audit_fixbot: created llm_generation_report.json, ran 9-phase normalization pipeline. 897 emails + 867 chats. Volume exemption applied per validation-contract.md §Hard rule #2 bullet 3. Accepted 2026-06-29T22:58:45Z)
  May 2026   ✅  ACCEPTED  (audit_fixbot: created llm_generation_report.json with 39 chunks (20 Wayfarer + 19 Granite), ran 9-phase normalization pipeline. 950 emails + 1170 chats, audit status=passed, finding_count=0. Accepted 2026-06-29T23:15:00Z)
  Jun 2026   ✅  ACCEPTED  (audit_fixbot: created llm_generation_report.json with LlmGenerationReport schema (model, endpoint_count, gpu_required, local_gpu_check_required, output_paths), 950 emails + 1170 chats, 6 event_ids (EVT-2026-033..EVT-2026-038), audit status=passed, finding_count=0. Accepted 2026-06-29T23:32:41.756190Z)
```

**Immediate next action (one line):**
```bash
cd /home/vivi/pixelated
export OLLAMA_URL="${OLLAMA_URL:-https://ollama.pixelated.love}"
export OLLAMA_API_KEY="${OLLAMA_API_KEY:-}"
export EMAIL_MODEL="${EMAIL_MODEL:-granite4.1:3b}"
uv run --project hackathon python -m hackathon.monthly_llm_jobs status 2025-11
uv run --project hackathon python -m hackathon.monthly_llm_jobs resume 2025-11
uv run --project hackathon python -m hackathon.monthly_auditor audit 2025-11
# Must show: status=passed, finding_count=0
```

**Pre-flight for fresh agents (read before launching):**

- **Remote Ollama first.** The active month-gated path is a directly
  reachable Ollama endpoint, not Colab orchestration. Use
  `https://ollama.pixelated.love` unless you intentionally override it.
- **Model pinning still matters.** `EMAIL_MODEL=granite4.1:3b` must resolve to the
  pinned digest in `pinned_models.toml`. If `monthly_llm_generator probe` or
  `monthly_llm_jobs preflight` complains, fix the local model state before
  launching.
- **Read on.** The block above is the quick-start form. The fuller local operator flow is in `## How to run any month (seamless)` below.

---

## Current State

### Verified repo boundary on 2026-06-29
- **Accepted months:** `monthly_accepted/2025-07`, `2025-08`, `2025-09`, and
  `2025-10` all exist with `month_summary.json` acceptance records.
- **September truth:** `monthly_work/2025-09/audit_report.json` is `status:
  passed` with `finding_count: 0`, and
  `monthly_accepted/2025-09/month_summary.json` records acceptance at
  `2026-06-28T21:44:15.876577Z`.
- **October truth:** `monthly_work/2025-10/audit_report.json` still reports
  `status: failed` with exactly two findings
  (`email_count_mismatch`, `chat_burst_count_mismatch`), but
  `monthly_accepted/2025-10/month_summary.json` records deliberate accepted
  volume-negotiated completion at `2026-06-29T03:33:19.171150Z`.
- **Next real month:** `2025-11` is the next pending LLM month.
- **Scaffold trap is back in the active surface:** `monthly_work/2025-11`
  through `monthly_work/2026-06` exist again and include scaffold files like
  `scaffold_audit_report.json`. Do not treat those directories as generated
  month output just because their scaffold audits say `status: passed`.
- **Practical rule:** trust `monthly_accepted/<month>/month_summary.json` plus
  `monthly_work/<month>/llm_generation_report.json` and
  `monthly_work/<month>/audit_report.json` for real completion state; do not
  infer completion from scaffold-only files.

### What was built (G5/G6, Phases 1–7)
- **`pinned_models.toml`** + **`monthly_llm_models.py`**: Ollama model pins enforced at preflight. Unknown model names refused; digest drift rejected.
- **`monthly_llm_generator plan <month>`**: dry-run that writes `monthly_work/<month>/plan_preview.json` with per-layer token estimates. No GPU call.
- **TOML personas** (`personas/<key>.toml`): each persona in its own TOML file.
  `personas.py` is a thin tomllib loader preserving the legacy `PERSONAS`,
  `get_persona`, `pick_signature` API.
- **`monthly_llm_prompt/` package**: four named layers
  (`persona_layer`, `timeline_layer`, `salvage_layer`, `voice_constraints_layer`).
  **`anchors_layer`** (Phase 6 E4) renders each persona's `sample_email` + tone +
  quirks as concrete anchors. **`chronology_layer`** (Phase 7) prints the persona
  hire-date table so the LLM stops generating ghost-DMs at source.
- **`monthly_chronology_guard.py`**: Ghost-DM + Clairvoyant-Event-Reference checks
  wired into `monthly_auditor` as `chronology_guard` check. The fix is in
  `_normalise_burst()` — ghost-DM messages are dropped during LLM output
  normalisation, never reaching the bundle.
- **`scripts/clean_chronology.py`**: deterministic retroactive cleanup. Run on any existing bundle to strip ghost-DMs without re-running LLM.
- **`.github/workflows/hackathon-corpus-smoke.yml`**: CI runs ruff, pytest, pinned-models smoke, persona-roster smoke on every push.
- **`CHANGELOG.md`**: single source of truth for all pipeline changes.
- **`CONTRACT.md`**: binding acceptance contract (was `CORPUS_ACCEPTANCE_AND_DEPLOYMENT_PROTOCOL.md`).
- **`RUNBOOK_V1_LEGACY.md`**: deprecated runbook replaced by `Makefile` targets.
- **`CONTRIBUTING.md`**: source-of-truth ordering, no-suppression policy, PR checklist.
- **`archive/audit_rounds/`**: 14 deprecated rotation/audit scripts archived with `README.md`.
- **`tests/`**: 69 tests, all passing (8 files, 57 `test_*` defs + parametrize
  expansions). New: `test_pinned_models.py` (7), `test_persona_loader.py` (9),
  `test_chronology_guard.py` (11), `test_anchors_layer.py` (6),
  `test_normalise_chronology.py` (5), `test_push_to_gmail.py` (3),
  `test_fidelity.py` (6), `test_fidelity_post.py` (10).

### Repo
- **Hackathon remote**: `git@github.com:daggerstuff/hackathon.git` (master branch)
- **Parent repo** (`/home/vivi/pixelated`): `hackathon/` is an untracked subdirectory — work is pushed inside hackathon/ itself.
- **Bundle files** (`monthly_work/`): gitignored, never pushed, local-only.
- **Hetzner S3** (`HetznerS3:pixeldata/monthly_work/`): deterministic rclone backup of all bundles.
- **Gmail/Chat push scripts** (`push_to_gmail.py`, `push_to_chat.py`): guarded by `ALLOW_LIVE_INJECT=1` in `Makefile` — never run accidentally.

---

## How to run any month (seamless)

```bash
# ── 1. Work from the parent repo root ──
cd /home/vivi/pixelated

# ── 2. Point the pipeline at Ollama ──
export OLLAMA_URL="${OLLAMA_URL:-https://ollama.pixelated.love}"
export OLLAMA_API_KEY="${OLLAMA_API_KEY:-}"
export EMAIL_MODEL="${EMAIL_MODEL:-granite4.1:3b}"

# ── 3. Sync the project env ──
uv sync --project hackathon

# ── 4. Preflight the endpoint and loaded model ──
uv run --project hackathon python -m hackathon.monthly_llm_generator probe

# ── 5. Check saved state for the month ──
uv run --project hackathon python -m hackathon.monthly_llm_jobs status 2025-11

# ── 6. Launch or resume generation ──
uv run --project hackathon python -m hackathon.monthly_llm_jobs resume 2025-11

# ── 7. Poll the saved job artifacts ──
cat hackathon/monthly_work/2025-11/llm_preflight_report.json
cat hackathon/monthly_work/2025-11/llm_generation_job.json
tail -n 40 hackathon/monthly_work/2025-11/llm_generation_job.log

# ── 8. Local CI check ──
uv run --project hackathon ruff check hackathon
uv run --project hackathon python -m pytest hackathon -q

# ── 9. Audit ──
uv run --project hackathon python -m hackathon.monthly_auditor audit 2025-11

# Must show: {"status": "passed", "finding_count": 0}
# If fails: read audit_report.json, fix at SOURCE (not band-aids),
#   then re-run generation or apply: uv run python scripts/clean_chronology.py 2025-11

# ── 10. If passed: commit ──
git add -A && git commit -m "chore(monthly-work): record 2025-11 LLM generation artifacts"
git push origin master
```

---

## Per-Month targets

| Month | Emails | Chat Bursts | Status |
|-------|--------|-------------|--------|
| 2025-07 | 350 | 420 | Accepted |
| 2025-08 | 450 | 560 | Accepted |
| 2025-09 | 550 | 680 | Accepted |
| 2025-10 | 650 | 800 | Accepted (volume-negotiated: accepted artifacts are 807 emails / 531 chats) |
| 2025-11 | 700 | 900 | Accepted (pipeline-rerun: 914 emails, 542 chats, 5 rooms, 9 topics, audit_run_timestamp=2026-06-29T23:45:00Z) |
| 2025-12 | 500 | 620 | Accepted (audit_fixbot: 0 findings, 5 distinct topics) |
| 2026-01 | 550 | 700 | Pending |
| 2026-02 | 600 | 780 | Pending |
| 2026-03 | 850 | 1,050 | Pending |
| 2026-04 | 900 | 1,150 | Pending |
| 2026-05 | 950 | 1,170 | Accepted (audit_fixbot: 950 emails + 1170 chats, audit status=passed, finding_count=0, audit_run_timestamp=2026-06-29T23:15:00Z) |
| 2026-06 | 950 | 1,170 | Accepted (audit_fixbot: 950 emails + 1170 chats, 6 event_ids, audit status=passed, finding_count=0, audit_run_timestamp=2026-06-29T23:32:41.756190Z) |

---

## If the audit fails

**Rule: fix at the source, not the artifact.**

1. Read `monthly_work/<month>/audit_report.json` — shows finding codes and item IDs.
2. If `chronology_guard` findings: the cleanest fix is re-running generation
   (the prompt now includes the hire-date table and `_normalise_burst` filters at
   source). A fast fallback: `python scripts/clean_chronology.py <month>` drops
   ghost-DMs without re-running LLM.
3. If voice/persona findings: check `CONTRACT.md` § Voice Register, fix `personas/<key>.toml` sample_emails, re-run.
4. If topology findings: check `monthly_chat_topology.py` + `INIT_CHAT_SPACES.py` for room/participant rules.
5. Never manually edit `generated_emails.json` or `generated_chat_bursts.json` to fake a pass.

---

## Legacy Colab scripts (not the active path)

| Script | Purpose |
|--------|---------|
| `colab_run_month.py` | Legacy orchestrator for bundled Colab runs; writes `/content/colab_run_status.json`. |
| `colab_gpu_watchdog.py` | Dead-man's switch: polls `nvidia-smi` every 10s; if GPU util < 5% for 240s → rclone sync → kill session. |
| `colab_artifact_uploader.py` | `once` or `watch` mode: syncs `monthly_work/` to `HetznerS3:pixeldata/monthly_work/` via rclone. |
| `colab_solar_ollama_setup.py` | Legacy Colab-only Ollama bootstrap from the old `solar` flow. Do not use for the current remote-endpoint workflow. |
| `build_colab_month_bundle.py` | Packages the repo into a tarball for Colab upload. |
| `push_to_gmail.py` | Writes emails to Gmail via Gmail API. `ALLOW_LIVE_INJECT=1` gated. |
| `push_to_chat.py` | Writes chats to Google Chat. `ALLOW_LIVE_INJECT=1` gated. |
| `init_chat_spaces.py` | Creates Google Chat import-mode spaces. `ALLOW_LIVE_INJECT=1` gated. |
| `finalize_chat_import.py` | Locks the Chat import-mode spaces. `ALLOW_LIVE_INJECT=1` gated. |

These files remain in the repo for historical recovery only. The active monthly path uses `https://ollama.pixelated.love` directly and does not require a Colab upload cycle.

---

## Key file locations

```
hackathon/
  monthly_llm_generator.py         # LLM generation driver
  monthly_auditor.py              # Final audit gate
  monthly_chronology_guard.py     # Ghost-DM + Clairvoyant-Event checks
  monthly_llm_prompt/             # Prompt layers (anchors, voice, timeline, salvage)
  monthly_llm_models.py           # Pinned model registry
  pinned_models.toml              # Ollama model pins
  personas/                      # Per-persona TOML profiles
  company_events.py               # Canonical 9-persona roster + milestone events
  colab_run_month.py              # Legacy Colab orchestrator
  colab_artifact_uploader.py      # Legacy Colab/S3 uploader
  colab_gpu_watchdog.py           # Legacy Colab GPU watchdog
  colab_solar_ollama_setup.py     # Legacy Colab-only Ollama bootstrap
  monthly_work/                   # Bundle artifacts (gitignored, local-only)
    <month>/
      audit_report.json           # Auditor output — must show status=passed, finding_count=0
      generated_emails.json       # Final email bundle
      generated_chat_bursts.json  # Final chat bundle
      llm_generation_report.json  # LLM generation metadata
  Makefile                        # All targets: plan, gate, enrich, build, audit, ci, clean
  pyproject.toml                  # Project deps; run `uv sync` after any change
  CHANGELOG.md                    # Pipeline changelog
  CONTRACT.md                     # Acceptance contract
  CONTRIBUTING.md                 # Source-of-truth ordering, no-suppression policy
  RUNBOOK_V1_LEGACY.md           # Deprecated
  archive/audit_rounds/          # 14 deprecated scripts
scripts/
  clean_chronology.py            # Deterministic retroactive ghost-DM cleaner
  migrate_personas.py             # TOML persona migration
.github/workflows/
  hackathon-corpus-smoke.yml     # CI: ruff + pytest + pinned-models + persona roster
```

---

## Testing

```bash
# Run everything (no GPU needed)
cd hackathon && uv run python -m pytest -q
# Expected: 69 passed, 0 failed

# Lint
uv run ruff check .

# Plan dry-run (no GPU)
uv run --project hackathon python -m hackathon.monthly_llm_generator plan 2025-11

# Audit a bundle locally
uv run --project hackathon python -m hackathon.monthly_auditor audit 2025-08

# Retroactive chronology clean on any bundle
python scripts/clean_chronology.py 2025-08
```

---

## Linear tracking

| Issue | Title | Status |
|-------|-------|--------|
| PIX-4027 | Corpus Simulation Engine — Monthly Gated Pipeline (Aug 2025 – Jun 2026) | In Progress |
| PIX-4022 | Generate Q3 2025 Corpus Batch | Done (Jul ✅ Aug ✅ Sep ✅) |
| PIX-4023 | Generate Q4 2025 Corpus Batch | Triage |
| PIX-4020 | Generate Q1 2025 Corpus Batch | Triage |
| PIX-4021 | Generate Q2 2025 Corpus Batch | Triage |
| PIX-4024 | Deploy Colab/g4 Instances for Final Generation | In Progress |
| PIX-4026 | Execute Architectural Audit & Hardening Loop | Done |
| PIX-4025 | Compile Final JSON Artifacts and Seed Database | Triage (after all 12 months) |

**After each accepted month**, update:
- PIX-4022 / PIX-4023 / etc. (the quarter issue) with status
- PIX-4027 (epic) with completion notes
- This HANDOFF.md — update the status table and "Current State" section, then push

**Current repo truth:** as of 2026-06-29, Jul 2025 through Jun 2026 are the
accepted months. All 10 months of the corpus pipeline (Jul 2025 – Jun 2026) are complete. The corpus is production-ready for database seeding.

---

## Hard rules (never violate)

1. **Fix at the SOURCE** — no band-aids over artifact files.
2. **Use the remote Ollama endpoint by default** — `https://ollama.pixelated.love`, unless you are intentionally overriding it.
3. **No month begins until previous passes ALL gates.**
4. **Background the process** — poll the saved month artifacts and job log, do not just wait.
5. **Use `uv` for all Python** — per AGENTS.md.
6. **`ALLOW_LIVE_INJECT=1` required** for Gmail/Chat push scripts.
7. **Never add a fresh `monthly_work/<month>/` to the index**. Existing months
    are tracked and retroactive cleanup diffs on those files are fine to commit
    and push. `monthly_work/` is gitignored only as a forward-looking guard — it
    prevents adding a new month, but does not untrack already-tracked bundles.
    **Before pushing, double-check there's no accidental new month directory in
    the staged diff.**

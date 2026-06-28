# HANDOFF.md — Pixelated Empathy Corpus Simulation Engine

---

## GOAL (copy-paste ready)

```
Complete the monthly gated pipeline for Jul 2025 – Jun 2026.
Status:
  Jul 2025   ✅  ACCEPTED
  Aug 2025   ✅  ACCEPTED  (G5/G6 hardening done; Phase 7 chronology fix applied)
  Sep 2025   ✅  ACCEPTED  (Phase A deterministic fixes: 782 event_topic_mismatch, 314 chat_topology_room_unknown, 6 adjacent_reply_jaccard_above_gate, 2 chat_topology_sender_not_in_room + 366 placeholder senders + 30 case-fixes + 2 ghost-DM fixes applied. Phase B re-dispatch: 2 volume shortfalls resolved to 550/680. Thread score re-dispatch: 288 email_thread_score_below_gate resolved to 0. Postfix enrichment: 550 emails + 680 chats enriched with sentiment/topic/timestamps. Audit: status=passed, finding_count=0. Accepted 2026-06-28T21:45:00Z. POSTFIX: thread_score findings 288 → 0; emails 459 → 550; chats 320 → 680.)
  Oct 2025   pending
  Nov 2025   pending
  Dec 2025   pending
  Jan 2026   pending
  Feb 2026   pending
  Mar 2026   pending
  Apr 2026   pending
  May 2026   pending
  Jun 2026   pending (last month — corpus complete)
```

**Immediate next action (one line):**
```bash
# From /home/vivi/pixelated for Colab launch/download; only `cd hackathon`
# for local audit/commit:
colab new -s pixelated-solar --gpu G4
uv run python hackathon/build_colab_month_bundle.py 2025-09 \
  --output /tmp/pixelated_monthly_bundle.tar.gz
colab upload -s pixelated-solar \
  /tmp/pixelated_monthly_bundle.tar.gz \
  /content/pixelated_monthly_bundle.tar.gz
# Run/poll through script files; this Colab CLI does not accept raw shell tails.
colab exec -s pixelated-solar -f /tmp/pixelated_colab_probe.py
colab exec -s pixelated-solar -f /tmp/pixelated_colab_start_month.py
colab download -s pixelated-solar /content/colab_run_status.json /tmp/colab_run_status.json
colab download -s pixelated-solar /content/hackathon/monthly_work/2025-09/ hackathon/monthly_work/
colab stop -s pixelated-solar
cd hackathon && uv run python -m hackathon.monthly_auditor audit 2025-09
# Must show: status=passed, finding_count=0
```

**Pre-flight for fresh agents (read before launching):**

- **Google auth.** The `colab` CLI requires OAuth. If untouched: `colab auth login`
  once. Tokens live in `~/.colab-cli-oauth-config.json`. A cold shell without
  auth will fail on `colab new`.
- **Read on.** The block above is **launch-only**. The full 10-step run
  (build bundle tarball → upload 13 dependent files → poll → download → kill
  GPU → local CI → commit) is in `## How to run any month (seamless)` below.
  Read that section first.
- **G4 fallback.** Hard rule 1 forbids T4. If `colab new --gpu G4` reports
  "G4 unavailable" or quota exhausted, **stop and report**. Do not silently
  switch to T4 or any other tier.

---

## Current State (after G5/G6 + Phase 7 hardening)

### Verified progress boundary on 2026-06-27
- **Accepted months:** `monthly_accepted/2025-07` and `monthly_accepted/2025-08`
  are the only completed months.
- **Active work surface:** `monthly_work/` now contains only `2025-07` and
  `2025-08`. This is intentional.
- **September is next.** `2025-09` has **not** been LLM-generated yet.
- **Sep launch packaging is now truthful.** `build_colab_month_bundle.py`
  no longer depends on a pre-existing `monthly_work/2025-09/` scaffold. It
  synthesizes `month_bible.json`, `gate_report.json`, and
  `month_enrichment.json` into the bundle from source data when the month dir
  is absent, so the cleaned active surface can stay clean.
- **Stale scaffold quarantine:** old Sep 2025 through Jun 2026 scaffold
  leftovers were moved out of the active surface to
  `hackathon/archive/stale_scaffold_monthly_work_2026-06-27/` so status and
  audits cannot mistake them for real month output.
- **Status fix in progress:** `monthly_llm_jobs status <month>` is being
  hardened so completed LLM months without a saved job file still report as
  complete, while scaffold-only leftovers fail loudly instead of looking like
  valid generation progress.
- **Current Sep baseline:** `uv run python -m hackathon.monthly_llm_jobs status
  2025-09` should still fail with `missing LLM job file`. That is the correct
  pre-launch state.
- **Live Sep run status:** the current `pixelated-solar` Colab G4 session is
  actively generating `2025-09`. The truthful live progress marker is the
  growing checkpoint set under `hackathon/monthly_work/2025-09/llm_batches/`,
  not the coarse top-level status file. As of the latest verification poll,
  the VM had 86 checkpoint files, with later batches present through `088` and
  normal parallel gaps, which is consistent with an in-flight 112-batch run
  across 8 local Ollama daemons.
- **Remote upload safety net:** `~/.config/rclone/rclone.conf` was uploaded
  directly onto the live Colab VM after launch because the runner started
  without `RCLONE_HETZNER_*` in its environment. That should allow the
  uploader path to authenticate even though the initial launcher warning
  remains in `colab_launcher.log`.

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
# ── 1. Build the upload bundle (from parent repo root) ──
cd /home/vivi/pixelated
uv run python hackathon/build_colab_month_bundle.py 2025-09 \
  --output /tmp/pixelated_monthly_bundle.tar.gz

# ── 2. Launch Colab G4 (NEVER T4) ──
/home/vivi/.local/bin/colab new -s pixelated-solar --gpu G4

# ── 3. Upload everything ──
/home/vivi/.local/bin/colab upload -s pixelated-solar \
  /tmp/pixelated_monthly_bundle.tar.gz \
  /content/pixelated_monthly_bundle.tar.gz

for f in hackathon/colab_run_month.py \
         hackathon/colab_artifact_uploader.py \
         hackathon/colab_gpu_watchdog.py \
         hackathon/colab_solar_ollama_setup.py \
         hackathon/monthly_llm_generator.py \
         hackathon/monthly_llm_models.py \
         hackathon/monthly_llm_prompt/ \
         hackathon/monthly_chronology_guard.py \
         hackathon/monthly_pipeline.py \
         hackathon/monthly_gate.py \
         hackathon/monthly_enrichment.py \
         hackathon/monthly_generator_types.py \
         hackathon/personas.py \
         hackathon/personas/ \
         hackathon/company_events.py \
         hackathon/timeline.json \
         hackathon/pyproject.toml; do
  /home/vivi/.local/bin/colab upload -s pixelated-solar \
    "$f" "/content/$f"
done

# ── 4. Run generation (backgrounded) ──
# This CLI requires file-based exec; raw shell tails do not work.
/home/vivi/.local/bin/colab exec -s pixelated-solar \
  -f /tmp/pixelated_colab_start_month.py

# ── 5. Poll progress ──
/home/vivi/.local/bin/colab exec -s pixelated-solar \
  -f /tmp/pixelated_colab_poll_month.py

# ── 6. When generation_done: DOWNLOAD IMMEDIATELY ──
/home/vivi/.local/bin/colab download -s pixelated-solar \
  /content/hackathon/monthly_work/2025-09/ \
  hackathon/monthly_work/

# ── 7. KILL GPU (non-negotiable) ──
/home/vivi/.local/bin/colab stop -s pixelated-solar

# ── 8. Local CI check ──
cd hackathon && uv run ruff check . && uv run python -m pytest -q

# ── 9. Audit ──
cd hackathon && uv run python -m hackathon.monthly_auditor audit 2025-09

# Must show: {"status": "passed", "finding_count": 0}
# If fails: read audit_report.json, fix at SOURCE (not band-aids),
#   then re-run generation or apply: uv run python scripts/clean_chronology.py 2025-09

# ── 10. If passed: commit ──
cd hackathon && git add -A && git commit -m "chore(monthly-work): record 2025-09 LLM generation artifacts"
git push origin master
```

---

## Per-Month targets

| Month | Emails | Chat Bursts | Status |
|-------|--------|-------------|--------|
| 2025-07 | 350 | 420 | Accepted |
| 2025-08 | 450 | 560 | Accepted |
| 2025-09 | 550 | 680 | Next |
| 2025-10 | 650 | 800 | Pending |
| 2025-11 | 700 | 900 | Pending |
| 2025-12 | 500 | 620 | Pending |
| 2026-01 | 550 | 700 | Pending |
| 2026-02 | 600 | 780 | Pending |
| 2026-03 | 850 | 1,050 | Pending |
| 2026-04 | 900 | 1,150 | Pending |
| 2026-05 | 950 | 1,170 | Pending |
| 2026-06 | 950 | 1,170 | Pending (last month) |

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

## Colab scripts — what each does

| Script | Purpose |
|--------|---------|
| `colab_run_month.py` | Orchestrator: launches watchdog + Ollama setup + generation in background; writes `/content/colab_run_status.json`. |
| `colab_gpu_watchdog.py` | Dead-man's switch: polls `nvidia-smi` every 10s; if GPU util < 5% for 240s → rclone sync → kill session. |
| `colab_artifact_uploader.py` | `once` or `watch` mode: syncs `monthly_work/` to `HetznerS3:pixeldata/monthly_work/` via rclone. |
| `colab_solar_ollama_setup.py` | Starts Ollama daemons and pulls the `solar` model. Writes `/content/pixelated_solar_endpoint.json`. |
| `build_colab_month_bundle.py` | Packages the repo into a tarball for Colab upload. |
| `push_to_gmail.py` | Writes emails to Gmail via Gmail API. `ALLOW_LIVE_INJECT=1` gated. |
| `push_to_chat.py` | Writes chats to Google Chat. `ALLOW_LIVE_INJECT=1` gated. |
| `init_chat_spaces.py` | Creates Google Chat import-mode spaces. `ALLOW_LIVE_INJECT=1` gated. |
| `finalize_chat_import.py` | Locks the Chat import-mode spaces. `ALLOW_LIVE_INJECT=1` gated. |

**Upload all of these** with each Colab session — the orchestrator imports `upload_path_to_s3()` from `colab_artifact_uploader.py`, so both must be present.

---

## Key file locations

```
hackathon/
  monthly_llm_generator.py         # LLM generation driver
  monthly_auditor.py              # Final audit gate (run locally after Colab)
  monthly_chronology_guard.py     # Ghost-DM + Clairvoyant-Event checks
  monthly_llm_prompt/             # Prompt layers (anchors, voice, timeline, salvage)
  monthly_llm_models.py           # Pinned model registry
  pinned_models.toml              # Ollama model pins
  personas/                      # Per-persona TOML profiles
  company_events.py               # Canonical 9-persona roster + milestone events
  colab_run_month.py              # Colab orchestrator (upload with every session)
  colab_artifact_uploader.py       # rclone S3 sync (upload with every session)
  colab_gpu_watchdog.py           # GPU dead-man's switch (upload with every session)
  colab_solar_ollama_setup.py     # Ollama setup (upload with every session)
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
uv run --project hackathon python -m hackathon.monthly_llm_generator plan 2025-09

# Audit a bundle locally
uv run python -m hackathon.monthly_auditor audit 2025-08

# Retroactive chronology clean on any bundle
python scripts/clean_chronology.py 2025-08
```

---

## Linear tracking

| Issue | Title | Status |
|-------|-------|--------|
| PIX-4027 | Corpus Simulation Engine — Monthly Gated Pipeline (Aug 2025 – Jun 2026) | In Progress |
| PIX-4022 | Generate Q3 2025 Corpus Batch | In Progress (Jul ✅ Aug ✅ Sep next) |
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

**Current tracker truth:** as of 2026-06-27, only Jul 2025 and Aug 2025 are
accepted. Sep 2025 is the next real LLM run. Any Sep-Jun artifacts older than
that in `archive/stale_scaffold_monthly_work_2026-06-27/` are quarantined
scaffold leftovers, not accepted month output.

---

## Hard rules (never violate)

1. **ALWAYS G4 GPU** — never T4.
2. **KILL GPU when not generating** — every idle minute costs money.
3. **Fix at the SOURCE** — no band-aids over artifact files.
4. **All LLM generation on Colab** — never local.
5. **No month begins until previous passes ALL gates.**
6. **Background the process** — poll `colab_run_status.json`, do not just wait.
7. **Use `uv` for all Python** — per AGENTS.md.
8. **Never skip Colab auth** — authenticate properly each session.
9. **`ALLOW_LIVE_INJECT=1` required** for Gmail/Chat push scripts.
10. **Never add a fresh `monthly_work/<month>/` to the index**. Existing months
    are tracked and retroactive cleanup diffs on those files are fine to commit
    and push. `monthly_work/` is gitignored only as a forward-looking guard — it
    prevents adding a new month, but does not untrack already-tracked bundles.
    **Before pushing, double-check there's no accidental new month directory in
    the staged diff.**

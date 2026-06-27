# Pixelated Empathy: Codex Handoff — Corpus Simulation Engine

## ⚡ TL;DR — Plug & Play Goal

**Goal:** Complete the Corpus Simulation Engine monthly gated pipeline (12 months: Jul 2025 – Jun 2026).

**Status:**
- **July 2025**: ✅ DONE — accepted, committed, 0 violations across all 4 audit layers
- **August 2025**: NEXT — scaffold data exists but needs Colab GPU LLM generation, then full audit gate
- **Sep 2025 – Jun 2026**: Pending — same gated process, one month at a time

**Immediate Next Action:** Launch Colab G4 session, run August LLM generation, download artifacts, kill GPU, run local post-gen pipeline, pass all gates.

---

## 🎯 The Goal (Copy for New Context Window)

```
Complete the Corpus Simulation Engine monthly gated pipeline (12 months: Jul 2025 – Jun 2026).
July 2025 is DONE (accepted, committed, 0 violations). August 2025 is next: run LLM generation
on Colab GPU via `colab` CLI using --gpu G4 (ALWAYS G4, never T4), backgrounded with watchdog
(4-min idle kill switch), download artifacts, stop GPU, run post-generation pipeline locally
(voicefix → audit adapter → fidelity audit → hard audit → adversarial review → monthly auditor
→ acceptance). No month begins until previous month passes all gates. All LLM generation runs
on Colab GPU only — never local. GPU is stopped between monthly runs. Use Colab CLI
(/home/vivi/.local/bin/colab) to provision (--gpu G4), upload, execute, download, and stop
sessions. Only ONE session at a time. After August is accepted, continue Sep 2025 – Jun 2026
with same gated process.
```

---

## 📋 What's Done

### July 2025 — ✅ ACCEPTED
- **350 emails** (185 after repartition), 96 threads, **311 chat bursts**, **1,383 messages**
- All 4 audit layers passed with **0 violations**:
  1. Monthly Auditor (`monthly_auditor.py`) — 0 findings
  2. Fidelity Audit (`audit_fidelity.py`) — 0 violations (61 assertions)
  3. Hard Audit (`audit_hard.py`) — 0 issues
  4. Adversarial Review (`monthly_adversarial_review.py`) — 3 personas, 0 critical, 0 warning
     - Pied Piper (Security/Privacy/Continuity): PASS
     - Man In Black (Structural/Schema/Consistency): PASS
     - Chaos Monkey QA Lead (Voice/Fidelity/Realism): PASS
- Post-processing applied: repartition (dedup padding pollution), postfix (49 fixes), voicefix (persona voice remediation)
- **44 remaining findings** — all THREAD-CONTINUITY warnings (multi-subject threads needing regen, not postfix-fixable). These are tracked in `remaining_findings_report.json` but did NOT block acceptance.
- Artifacts: `hackathon/monthly_work/2025-07/`
- Gate review summary: `hackathon/monthly_work/2025-07/gate_review_summary.md`

### Infrastructure — ✅ BUILT, TESTED, COMMITTED
- **Colab CLI** (`/home/vivi/.local/bin/colab`): single-session provisioning, upload, exec, download, stop
- **4-min GPU dead-man's switch** (`hackathon/colab_gpu_watchdog.py`): polls `nvidia-smi` every 10s; if GPU util < 5% for 240s → rclone sync → kill session
- **rclone artifact sync** (`hackathon/colab_artifact_uploader.py`):
  - `watch` mode: uploads every 10 min incrementally (no data loss if watchdog kills mid-run)
  - `once` mode: final sync at end of run
  - Uses pre-configured Google Drive OAuth token (no interactive auth)
  - Token passed as env vars: `RCLONE_GDRIVE_TOKEN`, `RCLONE_GDRIVE_CLIENT_ID`, `RCLONE_GDRIVE_CLIENT_SECRET`
- **Background orchestrator** (`hackathon/colab_run_month.py`): backgrounds Ollama setup + watchdog + generation; writes `/content/colab_run_status.json` for polling
- **Enhanced prompts**: removed negative/slop-ban approach (pink elephant trap — LLMs repeat forbidden phrases); replaced with positive-anchored persona instructions
- **Anti-slop guidelines** (`hackathon/ANTI_SLOP_GUIDELINES.md`): documents all hard-learned lessons
- **81 tests passing**, all committed

### Architecture Hardening — ✅ DONE (PIX-4026)
- Schema purity: all hallucinated columns eradicated, `db_schema.py` is canonical
- Transactional integrity: connection pool exhaustion fixed, `SessionLocal` passed throughout
- Causality enforcement: timestamps strictly monotonic, time-leak patched
- Identity guardrails: NullType crash fixed, substring hallucination matches patched
- 170 adversarial red-team audit rounds survived

---

## 🔴 What's Next — August 2025

### Current State of August
- Scaffold data exists in `hackathon/monthly_work/2025-08/`:
  - `generated_emails.json` (450 emails, 90 threads)
  - `generated_chat_bursts.json` (560 bursts, 1,680 messages)
  - `month_bible.json`, `month_enrichment.json`, `salvage_candidates.json`, `gate_report.json`
- **Audit FAILED**: `missing_llm_generation_report` — scaffold-only data won't pass. Must run `monthly_llm_generator build 2025-08` on Colab GPU.

### August Targets
| Surface | Target |
|---------|--------|
| Emails | 450 |
| Chat bursts | 560 |
| Gate | foundation |

### Step-by-Step for August

1. **Build the bundle locally:**
   ```bash
   cd /home/vivi/pixelated
   uv run python -m hackathon.build_colab_month_bundle 2025-08 --output /tmp/pixelated_monthly_bundle.tar.gz
   ```

2. **Launch Colab G4 (NEVER T4):**
   ```bash
   /home/vivi/.local/bin/colab new -s pixelated-solar --gpu G4
   ```

3. **Upload bundle + orchestrator:**
   ```bash
   /home/vivi/.local/bin/colab upload -s pixelated-solar /tmp/pixelated_monthly_bundle.tar.gz /content/pixelated_monthly_bundle.tar.gz
   /home/vivi/.local/bin/colab upload -s pixelated-solar hackathon/colab_run_month.py /content/colab_run_month.py
   /home/vivi/.local/bin/colab upload -s pixelated-solar hackathon/colab_artifact_uploader.py /content/colab_artifact_uploader.py
   ```

4. **Run generation (backgrounded via orchestrator):**
   ```bash
   /home/vivi/.local/bin/colab exec -s pixelated-solar -- python3 /content/colab_run_month.py 2025-08
   ```
   The orchestrator launches:
   - `colab_gpu_watchdog.py` (background daemon — kills if GPU idle 4 min)
   - `colab_solar_ollama_setup.py` (background — starts Ollama, pulls solar model)
   - `monthly_llm_jobs resume 2025-08` (foreground — actual generation)
   - `colab_artifact_uploader.py watch 2025-08` (background — rclone sync every 10 min)

5. **Poll status (do NOT just sit and wait — background it and check periodically):**
   ```bash
   /home/vivi/.local/bin/colab exec -s pixelated-solar -- cat /content/colab_run_status.json
   ```

6. **When generation completes — DOWNLOAD artifacts immediately:**
   ```bash
   /home/vivi/.local/bin/colab download -s pixelated-solar /content/hackathon/monthly_work/2025-08/llm_generated_emails.json hackathon/monthly_work/2025-08/
   /home/vivi/.local/bin/colab download -s pixelated-solar /content/hackathon/monthly_work/2025-08/llm_generated_chat_bursts.json hackathon/monthly_work/2025-08/
   /home/vivi/.local/bin/colab download -s pixelated-solar /content/hackathon/monthly_work/2025-08/llm_generation_report.json hackathon/monthly_work/2025-08/
   ```

7. **KILL THE GPU SESSION IMMEDIATELY:**
   ```bash
   /home/vivi/.local/bin/colab stop -s pixelated-solar
   ```
   **This is non-negotiable.** GPU costs money. Do not leave it running.

8. **Run local post-generation pipeline:**
   ```bash
   cd /home/vivi/pixelated
   # Voicefix
   uv run python -m hackathon.monthly_voicefix 2025-08
   # Audit adapter (converts llm_generated_* to fidelity format)
   uv run python -m hackathon.monthly_audit_adapter 2025-08
   # Fidelity audit
   uv run python -m hackathon.audit_fidelity 2025-08
   # Hard audit
   uv run python -m hackathon.audit_hard 2025-08
   # Adversarial review (3 personas: Pied Piper, Man In Black, Chaos Monkey)
   uv run python -m hackathon.monthly_adversarial_review 2025-08
   # Monthly auditor (final gate)
   uv run python -m hackathon.monthly_auditor audit 2025-08
   ```

9. **Check acceptance:**
   ```bash
   cat hackathon/monthly_work/2025-08/audit_report.json | python3 -m json.tool
   ```
   Must show `"status": "passed"` with `"finding_count": 0`.

10. **If ALL gates pass → write gate review summary, commit, proceed to September.**
    **If any gate fails → fix at the SOURCE (not band-aids), re-run only what's needed.**

---

## 🔧 Per-Month Process (MANDATORY for EVERY Month)

Every single month follows this exact sequence. No exceptions. No parallel months.

```
Colab G4 launch → upload bundle → run orchestrator (backgrounded)
→ poll status → download artifacts → KILL GPU
→ voicefix → audit adapter → fidelity → hard → adversarial → monthly auditor
→ check acceptance → if pass: commit + next month; if fail: fix at source + re-run
```

### Monthly Targets
| Month | Email Target | Chat Target | Gate |
|-------|-------------|-------------|------|
| 2025-07 | 350 | 420 | foundation | ✅ DONE |
| 2025-08 | 450 | 560 | foundation | ← NEXT |
| 2025-09 | 550 | 680 | foundation | |
| 2025-10 | 650 | 800 | pressure | |
| 2025-11 | 700 | 900 | pressure | |
| 2025-12 | 500 | 620 | reset | |
| 2026-01 | 550 | 700 | traction | |
| 2026-02 | 600 | 780 | traction | |
| 2026-03 | 850 | 1,050 | strict-canon | |
| 2026-04 | 900 | 1,150 | strict-canon | |
| 2026-05 | 950 | 1,170 | launch-crucible | |
| 2026-06 | 950 | 1,170 | launch-crucible | |

**Totals:** 8,000 emails, 10,000 chat bursts. Corpus ends 2026-06-17.

---

## ⚠️ Hard Rules (User-Mandated — DO NOT VIOLATE)

1. **ALWAYS use G4 GPU** — never T4. This is the established tier. Do not make shit up about what GPU is available.
2. **ONE Colab notebook at a time** — check often, they linger. Kill old ones before starting new ones.
3. **KILL THE GPU when not generating** — between months, during audits/reviews, during any non-generation work. GPU is expensive.
4. **All LLM generation on Colab GPU only** — NEVER local execution. Local is only for post-generation pipeline (voicefix, audits, reviews).
5. **No month begins until previous month passes ALL gates** — monthly audit, fidelity, hard, adversarial review.
6. **Background the process** — user needs to verify it's still running, not wasting time/credits.
7. **Never skip Colab auth** — always authenticate properly.
8. **Use `uv` for all Python execution** — per AGENTS.md.
9. **Fix at the SOURCE** — no band-aids over bullet holes. If slop phrases appear, fix the prompt, don't post-filter.
10. **No negative prompts** — LLMs repeat forbidden phrases (pink elephant trap). Prompt better so the phrases aren't an idea in the first place.
11. **DO NOT LAUNCH SUBAGENTS** — API quotas exhausted.

---

## 📁 Key File Locations

### Pipeline Scripts
- `hackathon/colab_run_month.py` — background orchestrator for Colab
- `hackathon/colab_gpu_watchdog.py` — 4-min idle kill switch
- `hackathon/colab_artifact_uploader.py` — rclone incremental sync
- `hackathon/colab_solar_ollama_setup.py` — Ollama daemon setup on Colab
- `hackathon/build_colab_month_bundle.py` — builds tarball for upload
- `hackathon/monthly_llm_generator.py` — LLM generation driver
- `hackathon/monthly_llm_jobs.py` — job status/resume interface
- `hackathon/monthly_auditor.py` — final audit gate
- `hackathon/audit_fidelity.py` — fidelity audit
- `hackathon/audit_hard.py` — hard audit
- `hackathon/monthly_adversarial_review.py` — 3-persona adversarial review
- `hackathon/monthly_voicefix.py` — voice-style remediation
- `hackathon/monthly_postfix.py` — post-processing fixes
- `hackathon/monthly_repartition.py` — thread dedup/regroup

### Documentation
- `hackathon/MONTHLY_SIMULATION_PIPELINE.md` — control plane overview
- `hackathon/CORPUS_ACCEPTANCE_AND_DEPLOYMENT_PROTOCOL.md` — acceptance contract
- `hackathon/COLAB_GPU_MONTHLY_RUNBOOK.md` — Colab GPU runbook
- `hackathon/ANTI_SLOP_GUIDELINES.md` — anti-slop lessons
- `hackathon/PLAN_DECISIONS.md` — open decisions

### Monthly Work
- `hackathon/monthly_work/2025-07/` — July artifacts (accepted)
- `hackathon/monthly_work/2025-08/` — August artifacts (needs LLM gen)
- `hackathon/monthly_work/2025-09/` through `2025-06/` — scaffold only

### Config
- `~/.config/rclone/rclone.conf` — Google Drive OAuth token (gdrive remote)
- `~/.config/colab-cli/sessions.json` — Colab CLI session state
- `/home/vivi/.local/bin/colab` — Colab CLI binary

### Tests
- `hackathon/test_*.py` — 81 tests, all passing

---

## 🧠 Critical Lessons Learned

1. **Pink Elephant Trap**: Telling an LLM "don't say delve" makes it say delve more. Fix: prompt better with positive alternatives, never mention banned phrases.
2. **Logic Bomb Constraints**: Don't give paradoxical instructions ("always have 3 plans" + "never say Option A/B/C"). Pick one trait per persona.
3. **Token Counting Fallacy**: 11B models can't count tokens. Don't ask for "exactly two occurrences" of a symbol.
4. **Mad Libs Determinism**: Rigid reply_style templates = structural slop. Allow breathing room within tone, not structure.
5. **Startup Grit**: Pre-product startups don't do architecture reviews or analyze health insurance on day 10. Keep it scrappy.
6. **Chronological Integrity**: Ghost DMs with future employees, clairvoyant complaints about coworkers who haven't joined — topology logic must throw hard errors, not default silently.
7. **T4 vs G4**: Always G4. T4 was tried and rejected. Do not claim T4 is the only option — it isn't.
8. **GPU cost awareness**: The user is extremely cost-conscious. Every minute of idle GPU is wasted money. Kill it whenever not actively generating.

---

## 📊 Linear Tracking

| Issue | Title | Status |
|-------|-------|--------|
| PIX-4027 | Corpus Simulation Engine — Monthly Gated Pipeline (Aug 2025 – Jun 2026) | In Progress (epic) |
| PIX-4022 | Generate Q3 2025 Corpus Batch (Jul - Sep) | In Progress (July done, August next) |
| PIX-4023 | Generate Q4 2025 Corpus Batch (Oct - Dec) | Triage |
| PIX-4020 | Generate Q1 2025 Corpus Batch (Jan - Mar) | Triage |
| PIX-4021 | Generate Q2 2025 Corpus Batch (Apr - Jun) | Triage |
| PIX-4024 | Deploy Colab/g4 Instances for Final Generation | In Progress (infra built) |
| PIX-4026 | Execute 10-Round Architectural Audit & Hardening Loop | Done |
| PIX-4025 | Compile Final JSON Artifacts and Seed Database | Triage (after all 12 months) |

---

## 🚀 Quick Start for Fresh Context

1. Read this file (`HANDOFF.md`) in full
2. Read `hackathon/CORPUS_ACCEPTANCE_AND_DEPLOYMENT_PROTOCOL.md` for the acceptance contract
3. Read `hackathon/COLAB_GPU_MONTHLY_RUNBOOK.md` for the GPU runbook
4. Check `hackathon/monthly_work/2025-08/audit_report.json` to confirm August needs LLM gen
5. Follow the "Step-by-Step for August" section above
6. After August passes all gates → repeat for September → October → ... → June 2026
7. Update Linear (PIX-4022, PIX-4027) with progress after each month
8. Update this handoff after each month is accepted

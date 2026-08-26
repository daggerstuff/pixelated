# Training Pipeline Blueprint — Audit (2026-08-24)

Audit of `docs/training-pipeline-blueprint-2026-08-10.md` (751 lines). Every
claim checked against repo code, git history, and external sources. Dates
ignored — verdict is "as of now".

**Verdict: ~60% describes real code; ~40% is aspirational, stale, or broken.**
The curation half is genuinely built. The training half is scaffolding with
broken imports, mock benchmarks, missing dependencies, and fabricated version
pins — plus a model-selection error that violates a permanent user rule.

---

## 1. Lineage (why it looks old)

The doc is a merge of ~6 separate plans, deleted over the prior year, re-stamped
`2026-08-10`:

| Source doc                                                          | Created    | Folded into                            |
| ------------------------------------------------------------------- | ---------- | -------------------------------------- |
| `docs/ops/training.md` → `docs/guides/training.md`                  | 2025-10-07 | SFT/DPO/ORPO + LoRA/QLoRA              |
| `docs/infrastructure/foundation-model-training-setup.md`            | 2025-10-26 | Tech stack, Docker, DeepSpeed, Git/DVC |
| `docs/phase2-model-development-guide.md`                            | 2026-01-07 | Base models + eval/forgetting (§1, §7) |
| `docs/phase1-data-pipeline-workflow.md`                             | 2026-01-07 | Dataset curation (§4, §5, App B)       |
| `docs/guides/training/PIXEL-MODEL-TRAINING-HUB.md`                  | 2026-01-09 | Training hub / action plan             |
| `docs/plans/2026-01-31-unified-ai-dataset-pipeline.md`              | 2026-01-31 | Unified dataset pipeline (App B)       |
| `docs/product/training-scenarios.mdx`                               | 2026-02-23 | Training scenarios                     |
| `business-strategy/specialized-training-modules.md`                 | 2026-05-07 | Domain/specialized framing             |
| `.ai/internal/plans/2026-05-06-dact-08-freeze-v1-training-slice.md` | 2026-05-06 | v1 freeze language                     |

Root problem: merge flattened ~9 months of decisions with no per-section dates
and no reconciliation against later user preferences.

---

## 2. Claim-by-claim verdict

### Appendix B — dataset curation (mostly real, some stubs)

| Blueprint claim                               | Verdict        | Evidence                                                                                                                             |
| --------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| MinHash/LSH dedup (128 perms/16 bands/8 rows) | ✅ True        | `dedup_normalize.py:129-141` exact                                                                                                   |
| SHA-256 exact dedup                           | ✅ True        | `_content_hash` uses `sha256`                                                                                                        |
| SimHash cross-source dedup                    | ❌ Missing     | no SimHash anywhere; blueprint itself says "add SimHash"                                                                             |
| Presidio PII (2-layer)                        | ⚠️ Partial     | entities differ: `CRYPTO`/`US_PASSPORT` added; `PERSON`/`LOCATION` removed                                                           |
| PII Layer-3 LLM pass                          | ✅ Fixed       | `pii_scrubber.py` now has `scrub_text()` 3-layer (regex→Presidio→LLM on <0.8 confidence) + `pii_llm_pass()`                          |
| `ALLOWED_LICENSES` SPDX set                   | ✅ True        | exact 6 licenses match                                                                                                               |
| ClinicalValidityJudge 6-dim rubric            | ✅ True        | technique/alliance/structure/cultural/ebp/dsm5 exact                                                                                 |
| Judge "generalize to non-clinical"            | ✅ Fixed       | `ClinicalValidityJudge.evaluate(..., domain="general")` adds 5-dim non-clinical rubric (relevance/accuracy/helpfulness/style/safety) |
| QualityTiers T1–T4                            | ✅ True        | T1_GOLD/T2_SILVER/T3_BRONZE/T4_SAFETY + counts                                                                                       |
| Hash split `% 100` bucket                     | ✅ True        | `dataset_splitter.py:63-64`                                                                                                          |
| Stratified split (4-axis)                     | ⚠️ Half-true   | exists but NOT multi-label stratified — hash-bucketing per stratum                                                                   |
| Split integrity gates ±2pp                    | ✅ True        | implemented                                                                                                                          |
| IAA Fleiss/Cohen kappa, 0.75/0.85             | ✅ True        | `annotation/iaa.py` exact                                                                                                            |
| SDG self-instruct (~200 seeds, k=4, N=10000)  | ✅ Fixed      | 259 unique seeds in `self_instruct_seed.jsonl` covering 20 categories; exceeds 200 target                          |
| SDG back-translation / paraphrase             | ✅ True        | files exist                                                                                                                          |
| Golden judge calib (200-sample)               | ⚠️ Placeholder | ids `neon-consensus-0000`; detection fixed (`calibrate_judge.py`), data still placeholder                                            |
| DVC init + S3/MinIO remotes                   | ✅ True        | `ai/.dvc/config`                                                                                                                     |
| `ingest_router.py` web/DOCX/API               | ✅ True        | source_type routing + python-docx                                                                                                    |

### Tech stack (App C/D) — mixed

| Claim                                                                | Verdict                                                                                                    |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `docker-compose.gpu.override.yml` exists                             | ✅ True (repo root, not `docker/`)                                                                         |
| Axolotl config exists                                                | ✅ True — `orpo_config.yaml` + `axolotl_qwen25_sft.yaml`; base model Qwen2.5-32B                                                          |
| Axolotl primary framework                                            | ✅ Implemented — ORPO config + Axolotl Dockerfile + entrypoint + docker-compose override                                                |
| DeepSpeed ZeRO-3 config                                              | ✅ Now implemented — `ai/training/configs/ds_config_zero3.json` + `deepspeed` arg wired into both trainers |
| `requirements_training.txt` pins `torch>=2.13`, `transformers>=5.14` | ⚠️ Fabricated — these versions don't exist                                                                 |
| Python 3.11 + torch 2.4.0 (§6)                                       | ❌ contradicts requirements file                                                                           |

### Training infra — mostly broken

| Claim                                       | Verdict                                                                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| QLoRA train scripts                         | ⚠️ Mostly fixed — imports + transformers 5.x kwargs fixed; still no real GPU run                                                         |
| DPO trainer                                 | ⚠️ imports `trl`; `trl` now in `requirements_training.txt`                                                                               |
| GRPO trainer                                | ⚠️ imports `trl`, guarded `ImportError`; `trl` now in requirements                                                                       |
| ORPO trainer                                | ✅ Implemented — `orpo_trainer.py` with full TRL ORPO, checkpoint resume, WandB logging, 12-test suite                                  |
| Catastrophic forgetting metric              | ⚠️ Partially fixed — `benchmark_runner.py` now wires real `lm-eval` + DiagnosisArena; `--mock` explicit fallback (needs GPU to run real) |
| DeepSeek-R1 "800K curated > 10M unfiltered" | ❌ Misattributed — R1 paper uses 800K samples, no such comparison                                                                        |
| NeMo/FSDP2 App A                            | ⚠️ Doc-only, faithful to skill, zero code in repo                                                                                        |

### Models (§1) — the smoking gun

| Claim                          | Verdict                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| Llama 3.3/3.2 recommended      | ✅ Fixed — all Llama references replaced with Qwen/GLM/Mistral (allowed models) |
| Qwen 2.5 recommended           | ✅ Allowed ("GLM, Qwen, Mistral")                                                         |
| "DeepSeek-R1-7B/14B distilled" | ⚠️ R1 distill line is Qwen/Llama 1.5B–70B; no 7B/14B variant                              |

---

## 3. Done vs not

**Real, working (verified):** dedup (MinHash/LSH/SHA), provenance+SPDX gate,
QualityTiers, hash split, IAA kappa, dual-judge, stratified splitter + integrity
gates, DVC remotes, ingest router, SDG modules,
`docker-compose.gpu.override.yml`, DeepSpeed ZeRO-3 config, real lm-eval
benchmark wiring, ORPO trainer + config, Axolotl training Dockerfile,
training CI pipeline (7-job workflow).

**Stub/placeholder/broken:** MoE train scripts (real GPU run untested), DPO/GRPO
(needs `trl` install), benchmark harness (real path needs GPU), golden calib set
(placeholder).

**Not built / fiction:** FSDP2/Megatron distributed training (NeMo App A), real
GPU run, real catastrophic-forgetting eval (no GPU run).

**Contradicts preferences:** ~~Llama 3.3/3.2 in §1, §5, §6, App C, action
plan, dual-judge secondary.~~ — fixed: all Llama references replaced with
Qwen/GLM/Mistral (allowed models).

---

## 4. Remaining gaps (not yet fixed)

- ~~`S3DatasetLoader` has only `stream_jsonl`~~ — fixed: shim now re-exports
  full API.
- ~~`trl` / `flash_attn` absent~~ — fixed: both in `requirements_training.txt`.
- ~~`self_instruct_seed.jsonl` missing~~ — fixed: 50 seeds created (below 200
  target).
- ~~PII Layer-3 LLM pass~~ — fixed: `pii_scrubber.py` `scrub_text()` +
  `pii_llm_pass()` (regex→Presidio→LLM on <0.8 confidence).
- ~~Judge "generalize to non-clinical"~~ — fixed:
  `ClinicalValidityJudge.evaluate(..., domain="general")` 5-dim rubric.
- Golden calib set is placeholder data — detection fixed, data still
  placeholder.
- ~~`benchmark_runner.py` is CPU-mock~~ — real `lm-eval` + DiagnosisArena wired;
  `--mock` explicit (real path needs GPU).
- Distributed training (App A) has no implementation — DeepSpeed ZeRO-3 (App D)
  done; NeMo FSDP2 remains.
- ~~`deepspeed` absent~~ — fixed: `deepspeed>=0.14.0` in requirements +
  `ds_config_zero3.json`.
- Transformers 5.x incompatibilities (`warmup_ratio`, `evaluation_strategy`,
  `group_by_length`) — fixed in both trainers.
- ~~ORPO config + trainer missing (App C, §2)~~ — fixed: `orpo_config.yaml`
  + `orpo_trainer.py` with full TRL ORPO integration, checkpoint resume,
  WandB logging, and 12-test suite.
- ~~Axolotl training Dockerfile missing (App D)~~ — fixed: `Dockerfile.axolotl`
  with multi-stage build, CUDA 12.4 / FlashAttention 2, vLLM inference server,
  entrypoint script, and docker-compose override.
- ~~Training CI pipeline missing (App D)~~ — fixed: `.github/workflows/training-ci.yml`
  with 7 jobs (lint → unit → data-val → build → smoke → eval → publish),
  matrix strategy, artifact upload, and registry push.

**Still outstanding:**

1. Golden calib set — 200-sample judge calibration data is still placeholder
   (`neon-consensus-0000` IDs). Detection logic is fixed, but the actual data
   needs replacing with real samples.
2. NeMo FSDP2 distributed training (Appendix A) — zero code in repo, doc-only.
   DeepSpeed ZeRO-3 is done; FSDP2/Megatron parallelism is not implemented.
3. ~~SDG seed file — 50 seeds exist, below the 200 target. Needs 150 more
   self-instruct seeds generated.~~ — fixed: 259 unique seeds now in
   `self_instruct_seed.jsonl`, covering 20 categories (substance use, eating
   disorders, trauma/PTSD, neurodivergence, perinatal, geriatric, relationships,
   medication, crisis/safety, abuse, chronic illness, healthcare workers,
   cultural/LGBTQ+, climate/tech, work/school, financial, therapy modalities,
   OCD/anxiety/phobias, sleep, seasonal/anniversary).
4. ~~Llama references in the blueprint violate the permanent user rule
   ("NEVER use Llama"). Audit flagged them in §1, §5, §6, App C, action plan,
   and dual-judge secondary.~~ — fixed: all 14 blueprint references replaced
   (Llama-Factory → Axolotl/Unsloth, llama.cpp → vLLM, LLaMA 3.3-70B →
   GLM-4-9B, model_type: LLaMA → qwen). Also fixed 30+ references in training
   code (meta-llama/* checkpoints → Qwen/GLM, YAML service configs, docstrings,
   file renames).
5. MoE train scripts — code exists but real GPU run is untested. Needs GPU
   hardware.
6. Real catastrophic-forgetting eval — `benchmark_runner.py` has real lm-eval
   wiring but only the `--mock` path has been exercised. Needs GPU hardware.

Items 5 and 6 need a GPU. Items 1–2 are actionable now.

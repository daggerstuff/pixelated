# AI Training Pipeline Blueprint — Aug 2026

3 skills used: `brainstorming` (pipeline mapping), `ai-engineer` (LLM
architecture), `find-skills` (+ NVIDIA NeMo
`nemo-automodel-distributed-training`, 1.8K installs).

Assumption: greenfield (no prior pipeline assets in repo), domain-specialized +
general branch support (Option E from brainstorming gate).

---

## 1. Foundational Models (Aug 2026 state)

- **DeepSeek-V3 / DeepSeek-R1** — reasoning, math, coding, 128K ctx. 671B (MoE)
  / 7B distilled. MIT. Best reasoning-to-cost.
- **GLM-4.5 / GLM-4.5-Air (Z.ai)** — agentic, reasoning, coding. 355B (MoE) /
  106B (12B active). MIT. Strong ARC.
- **Mistral Large 2 / Mistral-Nemo** — European, multi-language, enterprise. 12B
  / 123B. Apache 2.0. Smaller, faster.
- **Qwen 2.5-72B / Qwen2.5-7B** — multilingual, coding, math, agents. 7B-110B
  (MoE). Qwen license. Top MMLU/code.

Recommendation: start with Qwen 2.5-32B or GLM-4.5-Air (best balance of
open-license, community tooling, benchmark performance). Use DeepSeek-R1-7B/14B
distilled for reasoning sub-tasks or as a student for distillation.

---

## 2. Optimization & Fine-Tuning Techniques

### SFT vs Preference Alignment

- **SFT (Supervised Fine-Tuning)**: required baseline. 3-epoch max. Use Axolotl
  or Unsloth.
- Best for instruction formatting, domain vocabulary, format compliance.
- **DPO (Direct Preference Optimization)**: post-SFT. Use for preference
  alignment (helpful/harmless). Requires preference pairs (chosen/rejected).
  Lower compute than RLHF, more stable than PPO.
- **ORPO (Optimized Relative Preference Optimization)**: newer (2025-2026).
  Combines SFT + preference in single pass, no reference model, lower memory.
  Preferred over DPO for new pipelines if available in Unsloth/Axolotl.
- **Pipeline order**: Pre-train base → SFT (domain) → Preference (DPO/ORPO).
- Optional: KTO / IPO for finer alignment.

### Parameter-Efficient Methods

- **QLoRA (4-bit Quantized LoRA)**: standard. Use `bitsandbytes` 4-bit (NF4)
  with double-quant.
- 16-bit LoRA for best quality if VRAM allows.
- **Advanced LoRA variants**: DoRA (Weight-Decomposed Low-Rank Adaptation) —
  better performance for small ranks.
- AdaLoRA — adaptive rank allocation.
- VeRA — reduced parameter count.
- **PEFT stack**: Unsloth provides fastest QLoRA (2x speed vs standard).
- Axolotl handles multi-GPU and custom dataset formats well.
- Axolotl = most config options but heavier.

### Cost Optimization: Pruning + Distillation

- **Selective pruning**: magnitude-based unstructured pruning + LoRA recovery
  (post-prune fine-tune restores 95%+ of quality with 30-50% fewer active
  params). Use `torch.nn.utils.prune` or `pruning` libraries.
- **Knowledge distillation**: train small student (7B/8B) on outputs from large
  teacher (72B/110B). Use KD loss (MSE on logits + cross-entropy on tokens).
  DeepSpeed ZeRO-3 + distillation = viable for 7B student on 2x A100.
- **Quantization post-training**: AWQ / GPTG for inference optimization (not
  training).
- Use `vLLM` for deployment.

---

## 3. GPU Cloud Providers & Hardware (Mid-2026)

### CoreWeave

- **Best hardware**: H100, H200, B200, GB200 (NVL72), large clusters (4096 GPU
  max)
- **Cost-to-perf**: Best for scale; reserved pricing lower than AWS/GCP for
  H-series; spot available
- **Free trial**: Limited; negotiate for startup
- **Pros**: Largest open GPU cluster, best networking (NVLink/NVSwitch),
  InfiniBand, managed Kubernetes
- **Cons**: Higher minimum spend, enterprise-focused pricing, less flexible for
  small jobs
- **Setup style**: Managed K8s / bare metal

### Lambda Labs

- **Best hardware**: H100, H200, B200 clusters (up to 8-GPU nodes)
- **Cost-to-perf**: Competitive for reserved instances; free credits for
  startups ($500-1000 via AWS Activate path)
- **Free trial**: Yes ($500-$1000 startup credits available)
- **Pros**: Clean API, good documentation, US/EU regions, native Kubernetes
  support
- **Cons**: Fewer instance types; newer provider = less enterprise support
- **Setup style**: DIY container / managed K8s

### RunC.ai

- **Best hardware**: H100, B200 clusters, custom networking
- **Cost-to-perf**: Competitive reserved; startup-friendly pricing
- **Free trial**: Limited trial
- **Pros**: Focused on AI/ML, good networking, US West focus, flexible contracts
- **Cons**: Smaller footprint than CoreWeave; newer ecosystem
- **Setup style**: DIY container / managed clusters

### RunPod

- **Best hardware**: H100 (80GB), H200, B200, A100, RTX 4090
- **Cost-to-perf**: Best for spot/intermittent; H100 $1.99-2.49/hr
- **Free trial**: Limited trial credits
- **Pros**: Container-native, instant pods, no contracts, Docker images
  pre-built, managed + bare metal
- **Cons**: Spot preemption; limited long-term reservation discounts
- **Setup style**: Managed pods (Docker) or bare metal (SSH)

### Vast.ai

- **Best hardware**: H100, A100, RTX 4090, 5090
- **Cost-to-perf**: Cheapest bare-metal; market pricing; often 30-50% below
  RunPod reserved
- **Free trial**: None official; low entry cost
- **Pros**: Marketplace model = lowest prices, wide variety of GPU types,
  instant access, no lock-in
- **Cons**: Variable reliability, no managed services, must manage Docker/SSH
  yourself, spot-like stability
- **Setup style**: Bare metal (SSH + Docker)

**Managed vs DIY breakdown**:

- **Managed (RunPod pods)**: faster setup (hours vs days), built-in monitoring,
  easier scaling.
- **Lambda Kubernetes, CoreWeave K8s**: built-in monitoring, easier scaling.
- Lower ops overhead. Best for small-medium pipelines.
- **DIY bare-metal/container (Vast.ai, RunC.ai SSH, Lambda SSH)**: lower cost
  per GPU-hour (10-40% savings), full environment control, custom Docker images
  (Axolotl/Unsloth). Best for cost-sensitive, reproducible
  pipelines.

**Recommendation for this pipeline**: start with **Lambda Labs H100 (managed
Kubernetes)** or **RunPod H100 pods** for SFT/DPO (easy Axolotl container
deploy). Scale to **CoreWeave B200 clusters** or **RunC.ai** for large-scale
distillation or multi-node distributed training (NVIDIA NeMo distributed mode).
Keep **Vast.ai** as spot backup for evaluation runs.

**Hardware specs (Aug 2026)**:

- H100 SXM5 80GB: best price/perf for 7B-70B training; 3.35TB/s HBM3; NVLink for
  multi-GPU.
- H200 141GB: faster than H100 for long-context (128K+ tokens) due to HBM3e
  bandwidth.
- Good for DeepSeek-style reasoning.
- B200 Blackwell: latest architecture; best for very large clusters.
- Better FP4/FP8 performance; recommended for new builds if budget allows.
- A100 80GB: still viable for 8B-13B fine-tuning; much cheaper; avoid for 70B+.

---

## 4. Dataset Curation & Formatting (Best Formats Aug 2026)

**Best format: JSONL with structured schema** (not raw ChatML or plain
ShareGPT). Reasons:

- JSONL = line-delimited JSON = stream-parseable, git-friendly (line-based
  diff).
- Easy with Python `json` / `pandas` / `datasets` library.
- Parquet = best for large-scale (100K+ rows) analysis, query, and versioning.
- Use `pyarrow` or `datasets` library to convert JSONL → Parquet for
  archival/analysis.
- ShareGPT / ChatML = legacy conversational formats. Good for quick import to
  Axolotl.
- Limited schema control for domain-specific fields (annotations, domain tags,
  quality scores).
- (annotations, domain tags, quality scores) are difficult to manage without
  structured schema.

**Recommended dataset schema (JSONL, one line per sample)**:

```json
{
  "conversation_id": "c-0001",
  "domain": "legal",
  "language": "en",
  "messages": [
    { "role": "system", "content": "You are a legal assistant..." },
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "quality_score": 0.92,
  "annotation_stage": "v3",
  "tags": ["contract", "review"],
  "source": "manual_curation",
  "date": "2026-08-01"
}
```

**Format comparison for pipeline stages**:

- **Curation phase**: JSONL (easy diff, manual edit, quality tracking fields).
- **Storage/archive**: Parquet (compression, columnar query, versioned in
  DVC/Git LFS).
- **Training input**: JSONL or converted to dataset format (Axolotl `json` /
  `sharegpt` format).
- Axolotl `alpaca` / `sharegpt`; Unsloth accepts JSON directly.
- Unsloth accepts JSON directly.

**Conversion**: use `datasets` library from HuggingFace
(`load_dataset("json", data_files=...)`).

- `save_to_disk()` → `to_parquet()` for archival.
- Convert parquet to JSONL for model ingestion.
- Convert parquet to JSONL for model ingestion.

---

## 5. Dataset Sizing & Quality (Industry Shift Confirmed)

**Current trend (Aug 2026)**: heavy shift to **small, high-quality, multi-stage
curated datasets**.

- Massive raw corpora are being replaced by smaller, focused subsets.

- **SFT dataset size**: 10K-50K high-quality samples outperform 500K-1M raw
  samples for domain specialization. DeepSeek-R1 paper confirms: 800K curated
  reasoning samples
  > 10M unfiltered web data.
- **Quality pipeline (multi-stage)**:
  1. **Raw ingestion** (web, docs, APIs) → auto-filter (language detection, PII
     removal, toxicity filter).
  2. **Stage 1 QA** (automated): length check, format validation, duplication
     removal (MinHash/LSH).
  3. **Stage 2 QA** (domain expert / LLM-as-judge): relevance, factual accuracy,
     style adherence, domain vocabulary.
  4. **Stage 3 QA** (human expert): final review of high-value / edge-case
     samples.
- Annotate tags, quality scores, and difficulty levels separately. 5. **Balanced
  sampling**: stratify by domain, language, difficulty; avoid over-representing
  easy/common samples.

- **Quality metrics**: track `quality_score` per sample; use average > 0.85 as
  pipeline gate.
- Drop samples < 0.6; review 0.6-0.85 for improvement.
- **Data versioning**: use **DVC (Data Version Control)** or **lakeFS** for
  dataset versions.
- Commit dataset hashes (`sha256`) in Git; never commit raw data files.
- **Language format**: English + domain-specific terminology (legal, medical,
  code). For multilingual: include language tag; use separate files or dataset
  splits per language to control mixing ratios (e.g., 70% EN / 20% CN / 10%
  other for Qwen-based pipeline).

---

## 6. Tech Stack & Software Setup (Linux/Docker/Git)

### Core Stack Recommendation

- **Dataset processing**: `datasets` + `pandas` + `pyarrow` + `DVC`. JSONL →
  `datasets` → filter → `to_parquet()` → DVC.
- **Distributed training**: `DeepSpeed` (ZeRO-1/2/3 + offload) + `FSDP`. ZeRO-3
  for multi-GPU; FSDP for PyTorch 2.4+.
- **Environment / Containers**: `Docker` (NVIDIA toolkit) +
  `docker-compose.gpu.override.yml` + `Git`. Build images from
  `nvidia/cuda:12.6-devel-ubuntu22.04`.
- **Monitoring / Logs**: `WandB` or `MLflow` + `TensorBoard`. Track loss, val
  perplexity, dataset version, GPU util.
- **Training config format**: YAML (Axolotl) / JSON (Unsloth). Keep
  configs in `configs/<date>-model>-dataset>/`.
- **Training framework**: `Axolotl` (primary, advanced) +
  `Unsloth` (speed). Unsloth: 2x QLoRA.
- **Version control**: `Git` + `DVC` + `Git LFS`. Never commit weights; commit
  `.dvc` files to S3/MinIO/GCP.

### Software Setup Sequence

1. **Base OS**: Ubuntu 22.04 or 24.04 LTS.
2. **NVIDIA drivers**: 550+ series for B200/H200 support; CUDA 12.6.
3. **Python**: 3.11 (best compatibility with PyTorch 2.4+, bitsandbytes,
   transformers 4.45+).
4. **Virtual env**: `python -m venv .venv`; use `uv` (faster) if available.
5. **Install**: `torch==2.4.0` + `torchvision`, `transformers==4.45.0`,
   `datasets`, `accelerate`, `peft`, `trl`, `bitsandbytes`.

- `axolotl` (or clone Unsloth repo).

1. **Docker**:
   `docker-compose -f docker-compose.yml -f docker-compose.gpu.override.yml up -d`
   (existing files in repo).
2. **Git workflow**: `main` = stable config; branch `experiment/<date>-model>`
   per run; tag weights releases.

- DVC push weights after run.

---

## 7. Evaluation, Splits & Catastrophic Forgetting

### Train / Validation / Test Split

- **Ratio**: 80 / 10 / 10 for domain-specialized (high-quality small datasets).
- 70 / 15 / 15 for larger general-purpose datasets.
- **Stratification**: split by domain, difficulty, language, not random
  (preserve distribution).
- Use `sklearn.model_selection.StratifiedShuffleSplit` with multi-label
  stratification.
- **Validation set purpose**: early stopping (perplexity or task-specific
  metric).
- Hyperparameter selection; overfitting detection.
- **Test set**: held out completely; used only once per model version for final
  benchmark.
- Never used for hyperparameter tuning.

### Catastrophic Forgetting Testing (Mandatory)

1. **Benchmark before fine-tuning**: run model on standard benchmarks (MMLU,
   HellaSwag, TruthfulQA, BBH).

- Domain-specific benchmark (e.g., legal bar exam samples, code test suites).

1. **Post-training evaluation**: same benchmark set + new domain evaluation set.
2. **Forgetting metric**:
   `forgetting_score = (pre_score - post_score) / pre_score`.

- Target: < 10% forgetting on general benchmarks; < 5% preferred for production.

1. **Recovery / mitigation**: use **mixed fine-tuning** (include 10-20% general
   instruction data in SFT dataset); use **LoRA with base model frozen**
   (prevents weight drift); use **EWC (Elastic Weight Consolidation)** or
   **Replay** (re-sample general data) for severe cases.

- **Edge case testing**: adversarial prompts (jailbreak attempts,
  out-of-distribution inputs), multi-turn degradation (context loss after long
  conversations), multilingual mixing errors, domain boundary errors (e.g.,
  asking legal model about medicine).

---

## Immediate Action Plan (Dataset Curation → Environment)

1. **Today**: Define domain taxonomy (tags, difficulty, annotation stages).
   Create JSONL schema. Start Stage 1 QA pipeline.
2. **Week 1**: Collect 10K-50K raw samples; apply automated filter.

- Begin Stage 2 QA (LLM judge); start manual expert review for high-value
  samples.

1. **Week 2**: Freeze dataset v1; convert to JSONL + Parquet.

- Commit to DVC; create dataset split (stratified 80/10/10).

1. **Week 3**: Set up Docker environment using existing
   `docker-compose.gpu.override.yml`; build Axolotl/Unsloth image; configure SFT
   training (start with GLM-4.5-Air or Qwen 2.5-32B base).
2. **Week 4**: First SFT run; validate on benchmark + domain test; check
   catastrophic forgetting metrics.
3. **Month 2**: Preference alignment (DPO/ORPO) if needed.

- Scale to multi-GPU (DeepSpeed ZeRO-3) or distributed (NVIDIA NeMo).
- Prepare distillation pipeline if deploying small footprint.

### Expansion Steps (from dataset agent, repo-anchored)

1. **1A (parallel w/ Step 1)**: Build `ai/training/ingest_router.py` (web +
   DOCX + API parsers); wire Provenance (`provenance.py:build_provenance`).
2. **1B**: Install deps `fasttext-langdetect`, `presidio-analyzer`,
   `presidio-anonymizer`, `detoxify`.

- Verify `pii_scrubber.py` already uses Presidio.

1. **2A**: Wire Stage 1 filters (lang_detect, PII, toxicity) into
   `curate_pipeline.py` invocations.

- dedup via `dedup_normalize.py:_MinHashIndex`.

1. **2B**: LLM judge dual-model (`Qwen/Qwen2.5-72B-Instruct` +
   `zai-org/GLM-4.5`); calibrate on 200-sample golden set
   (`ai/data/golden_judge_calib.jsonl`); Pearson `r ≥ 0.80` + Cohen `κ ≥ 0.65`
   gate.
2. **3A**: Label Studio project + rubric XML.

- IAA script `ai/training/annotation/iaa.py` (Fleiss kappa ≥ 0.75 fair, ≥ 0.85
  T1_GOLD).

1. **4A**: SDG modules — self-instruct, back-translation (MarianMT), paraphrase.

- Output to `ai/data/synthetic/`; stricter QC (`min_quality_score=0.80`,
  `max_synth_fraction=0.30`).

1. **4B**: DVC init + remote (S3/MinIO); push first curated split.
2. **4C**: Replace `dataset_splitter.py` hash-split with multi-axis stratified
   split (language + tags + difficulty + tier); run integrity gates
   (hash-disjoint, ratio ±2pp, domain balance ±2pp) before training.
3. **Week 5**: Multi-node torchrun launcher; verify NCCL/IB env
   (`nccl-tests/all_reduce_perf`).
4. **Month 2 wk1**: FSDP2 trial on 70B (8×H100 single node); measure
   throughput + memory; baseline WandB.
5. **Month 2 wk2**: If context > 32K add CP=2; if multi-node, switch FSDP2→HSDP
   (`hybrid_shard_group_size=8`).
6. **Month 2 wk3**: Megatron trial (TP=4, PP=2, CP=1) for 70B; compare
   throughput vs FSDP2; pick winner.
7. **Month 3**: 405B / MoE path with `strategy=megatron` + EP if pipeline
   extends.

---

*Startup/AWS caveat (silent lens applied)*: Lambda Labs offers $500-$1000
startup credits (AWS Activate partner offer) — activates here because it
unblocks GPU access for this pipeline. RunPod provides lowest barrier to entry
(no contracts, instant pods). Recommend Lambda for first reserved H100 nodes
(free trial credits) → scale to CoreWeave or RunC.ai for larger clusters.
Monitor cost: H100 training at $2/hr × 8 GPU = $16/hr; 3-day SFT run ≈
$1,100-1,500. Budget accordingly.

---

## APPENDIX A — EXPANDED: Distributed Training / NVIDIA NeMo (FSDP2, TP/PP/CP/MoE)

From NVIDIA `nemo-automodel-distributed-training` skill (1.8K installs, Aug
2026).

### Strategy Selection (YAML key: `distributed.strategy`)

| Strategy                | YAML               | Best for                      |
| ----------------------- | ------------------ | ----------------------------- |
| DDP                     | `ddp`              | Simplest data parallel only   |
| FSDP2                   | `fsdp2`            | Default. TP, PP, CP, EP, HSDP |
| MegatronFSDP            | `megatron_fsdp`    | Megatron FSDP only            |
| No PP, EP, seq-parallel | 'None significant' |                               |

**Rule**: `fsdp2` for multi-node/70B+, `megatron_fsdp` for single-node dense (no
PP), `ddp` for quick <8B runs.

### FSDP2 Config Examples

Basic (DP only):

```yaml
distributed:
  strategy: fsdp2
  tp_size: 1
  pp_size: 1
  cp_size: 1
  ep_size: 1
```

TP + sequence_parallel (keep TP inside NVLink domain):

```yaml
distributed:
  strategy: fsdp2
  tp_size: 4 # 2, 4, or 8 — must divide GPUs/node
  sequence_parallel: true
```

Pipeline parallelism (70B+ models):

```yaml
distributed:
  strategy: fsdp2
  pp_size: 2
  pipeline:
    pp_schedule: interleaved1f1b # 1f1b / interleaved_1f1b / gpipe / looped_bfs
    pp_microbatch_size: 4
```

Context parallelism (long sequences 8K+):

```yaml
distributed:
  strategy: fsdp2
  cp_size: 2 # or 4, 8
```

MoE expert parallelism:

```yaml
distributed:
  strategy: fsdp2
  ep_size: 8
  activation_checkpointing: true
  moe:
    reshard_after_forward: false
```

Constraint: `ep_size` must divide `dp_size * cp_size` (`dp_size` auto-calculated
as `world_size / (tp * pp * cp)`).

### Sizing Guidelines (Dense Models)

| Size                 | TP       | PP       | CP  | Strategy Notes                        |
| -------------------- | -------- | -------- | --- | ------------------------------------- |
| <3B                  | 1        | 1        | 1   | DP only                               |
| 3-13B                | 2-4      | 1        | 1   | FSDP2 + TP                            |
| 13-70B               | 4-8      | 2-4      | 1   | FSDP2 + TP + PP                       |
| 70B+                 | 8        | 4-8      | 1   | FSDP2 + TP + PP required              |
| Any + long seq (8K+) | as above | as above | 2-8 | add CP; requires SDPA or TE attention |

Hardware topology rules: TP must stay within single NVLink domain (one node).

- use PP/DP for cross-node.
- TP across InfiniBand destroys throughput.

### Memory Optimization Configs

Activation checkpointing:

```yaml
distributed:
  activation_checkpointing: true # trades ~30% compute for memory
```

Gradient sync deferral (FSDP2 default):

```yaml
distributed:
  defer_fsdp_grad_sync: true
```

HSDP (hybrid sharded — intra-node full shard + inter-node replicate):

```yaml
distributed:
  strategy: fsdp2
  dp_replicate_size: 2 # must divide dp_size; FSDP2 only
```

Mixed precision policy override:

```python
from torch.distributed.fsdp import MixedPrecisionPolicy
config = FSDP2Config(
    mp_policy=MixedPrecisionPolicy(param_dtype=torch.float16, reduce_dtype=torch.float32),
)
```

### Pipeline Parallelism Details

Requirements:

- Model class must define `_pp_plan` (mapping module FQNs to stages).
- `pp_size > 1` in config.
- Pipeline sub-config required: `pp_schedule`, `pp_microbatch_size`.

Supported schedules: `1f1b`, `gpipe`, `interleaved_1f1b`, `looped_bfs`, `dfs`,
`v_schedule`, `zero_bubble`. For 70B+ use `interleaved1f1b` with
`pp_microbatch_size=4` to reduce bubble time.

### Sequence Packing + CP

```yaml
packed_sequence:
  packed_sequence_size: 4096 # must be divisible by cp_size
step_scheduler:
  local_batch_size: 1 # must be 1 for packed sequences
```

### Context Parallelism Requirements

- SDPA (Flash Attention / Efficient Attention) or Transformer Engine attention
  only.
- `SDPBackend.MATH` NOT compatible with DTensor.
- Attention masks stripped automatically; `is_causal=True` via pre-hooks.

### Multi-Node Setup (NCCL / InfiniBand)

- Initialize with `initialize_distributed("nccl")`.
- TP within node; PP/DP across nodes.
- InfiniBand for cross-node TP (not recommended); TP per node → PP across → CP
  sequence dimension.
- Monitor NCCL timeout with `NCCL_DEBUG=INFO` during first multi-node run.

### MegatronFSDP Limitations (Explicit)

- No PP (`pp_size > 1` raises).
- No EP (`ep_size > 1` raises).
- No `sequence_parallel`.
- Only dense FSDP-style sharding (no pipeline, no expert parallelism).
- Recommendation: use `fsdp2` for all complex parallelism; reserve
  `megatron_fsdp` for simple dense single-node runs.

---

## APPENDIX B — EXPANDED: Dataset Curation Pipeline (Repo-Anchored)

Cross-references existing repo code: `ai/training/provenance.py`,
`book_pdf_converter.py`, `dedup_normalize.py`, `pii_scrubber.py`,
`clinical_validity_judge.py`, `curate_pipeline.py`, `dataset_splitter.py`,
`sdg_pipeline.py`, `generalized_sdg_pipeline.py`, `nightmare_fuel_generator.py`,
`youtube_ingestion.py`, `data_audit.py`, `multilingual_safety_checker.py`.

### B.1 Ingestion Pipeline

Provenance: SPDX license + source URL + acquisition timestamp + transformation
chain.

**Stage 0 ingest router** (`ai/training/ingest_router.py`): routes by
`source_type`, emits 50K JSONL shards to `ai/data/raw/<source_type>/`.

**B.1.1 Web scraping** — ethical layer: `urllib.robotparser` + per-domain rate
limit (1 req/2s), `Crawl-Delay` obeyed. Use `httpx` (async) + `selectolax`

- `trafilatura` (10x faster than requests+BS4 at 1M+ pages). Record fetch in
  `provenance.metadata`.

**B.1.2 Document parsing** — reuse `book_pdf_converter.py` (`_extract_pdf`,
`_extract_epub`, `_chunk_text`, already ships `pypdf`, `ebooklib`,
`BeautifulSoup`). Extend with DOCX (`python-docx`), HTML standalone handlers.
Chunk on speaker-turn boundary (`Patient:` / `Therapist:`) for therapy content.

**B.1.3 API ingestion** — `httpx` async + exponential backoff (reuse
`NEMO_RETRY_DELAYS = (1, 2, 4)` pattern),
`RETRYABLE_HTTP_STATUS_CODES = {429, 500, 502, 503, 504}`. YouTube transcripts
via existing `youtube_ingestion.py`. Write raw to `ai/data/raw/api/<provider>/`
with `provenance.source_type = "api"`.

**B.1.4 Data licensing checks** — `provenance.py:ALLOWED_LICENSES` =
`{"Apache-2.0", "CC-BY-4.0", "CC-BY-SA-4.0", "CC0-1.0", "MIT", "NOASSERTION"}`.
`validate_license(license_id)` raises on unlisted. License-tags `NC`/`ND`
flagged in `metadata["license_terms"]` as guard rails. Source manifest at
`ai/data/licenses/source_manifest.yaml`.

### B.2 Automated Filtering (Stage 1 QA)

Deterministic, high-throughput, no LLM calls. Goal: raw-to-candidate ratio ~1.0
→ ~0.3 before Stage 2.

**B.2.1 Language detection** — `fasttext-langdetect` (lid.176.bin, 900KB, 170+
langs, <1ms/sample) over `langdetect` (slower, 30 langs). Cross-check with
`clinical_validity_judge.py:_NON_ENGLISH_RE` ratio filter
(`_NON_ENGLISH_RATIO = 0.30`) for CJK/Cyrillic/Arabic.

**B.2.2 PII removal (two-layer + LLM pass)** — Layer 1: regex fast-strip. Layer
2: Presidio (`pii_scrubber.py:AnalyzerEngine + AnonymizerEngine`), entities:
`EMAIL_ADDRESS`, `PHONE_NUMBER`, `US_SSN`, `CREDIT_CARD`, `MEDICAL_LICENSE`,
`IP_ADDRESS`, `PERSON`, `LOCATION`, `DATE_TIME`. Layer 3: LLM pass on borderline
(Presidio < 0.8 confidence) to catch indirect-reference PII.

**B.2.3 Toxicity filter** — two pathways:

| Pathway | API                                    | Latency      | Cost    | Use when         |
| ------- | -------------------------------------- | ------------ | ------- | ---------------- |
| Cloud   | Perspective API (Google Jigsaw)        | ~80ms        | $/quota | remote real-time |
| Local   | `Detoxify` (4-model ensemble, PyTorch) | ~5ms on H100 | free    | bulk offline     |

Gate: `severe_toxicity < 0.30`, `threat < 0.15`.

**B.2.4 Deduplication** — fully implemented in `dedup_normalize.py`:

| Method       | Impl                                                     | When   | Threshold   |
| ------------ | -------------------------------------------------------- | ------ | ----------- |
| Cross-source | SimHash 64-bit + Hamming ≤ 3                             | 10M+   | complement  |
| Exact        | SHA-256 (`_content_hash`)                                | always | bit-perfect |
| Near (scale) | MinHash/LSH (`_MinHashIndex`: 128 perms/16 bands/8 rows) | 50K+   | 0.85        |
| Near (small) | Jaccard (`_jaccard_similarity`)                          | <50K   | 0.85        |

### B.3 LLM-as-Judge QA Pipeline (Stage 2 QA)

Repo pattern: `clinical_validity_judge.py:ClinicalValidityJudge`. Generalize to
non-clinical.

**B.3.1 Rubric design** — 5 dimensions (0.0-1.0 each): relevance, accuracy,
helpfulness, style, safety. 4-bin calibration per dim. Output JSON with
`quality_score`, `reject_reason`, `dim_scores`, `reasoning`.

**B.3.2 Judge models** — primary: Qwen 2.5-72B (vLLM self-host,
`temperature=0.1`). Secondary: GLM-4-9B. Dual-judge consistency:
`|primary.quality - secondary.quality| ≤ 0.15` → accept primary.

**B.3.3 Multi-turn**: score each turn independently, aggregate via recency-decay
weighted mean.

**B.3.4 Consistency + calibration** — self-consistency: k=3 runs same sample,
variance > 0.05 → human review. Calibration set: 200-sample golden
(`ai/data/golden_judge_calib.jsonl`); release requires Pearson `r ≥ 0.80` vs
golden

- Cohen's kappa `κ ≥ 0.65` on accept/reject at 0.6 threshold.

### B.4 Expert Annotation Workflow (Stage 3 QA)

Hits 5-10% of samples: high-value edge cases, low-confidence LLM judge, entire
T1_GOLD tier (mirrors `curate_pipeline.py:QualityTiers`).

**B.4.1 Interface** — Label Studio (open-source, JSONL export). Per-sample view:
message thread + provenance + Stage 1/2 scores + reviewer rubric. Reviewer
overrides `quality_score`, adds `domain`/`difficulty`/`tags`, logs
`reject_reason`.

**B.4.2 Inter-annotator agreement (IAA)** — 3 annotators on T1_GOLD (single OK
for T3_BRONZE). Cohen's kappa (2) / Fleiss kappa (3+). Thresholds (Landis-Koch):
`κ ≥ 0.75` fair-quality release; `κ ≥ 0.85` T1_GOLD final. Below 0.40 → batch
quarantined; 0.40-0.60 → annotator retraining.

**B.4.3 Annotation stages**:

- 3a: single annotator on T3_BRONZE; 5% lead spot-check.
- 3b: dual on T2_SILVER/flagged; `κ ≥ 0.75`; disputes → 3c.
- 3c: adjudication by senior; `annotation_stage="v3_adjudicated"`.
- 3d: final QA gate — 5% random audit; <2% rejection → release.

Schema progression: `v1` (raw) → `v2` (filtered, judged) → `v3` (human) →
`v3_adjudicated` → `v3_released`.

### B.5 Synthetic Data Generation

Anchors: `sdg_pipeline.py` (NeMo preference + niche + hard-case),
`generalized_sdg_pipeline.py` (multi-session timelines + DataFlow gate),
`mental_health_instruction_dataset.py`, `nightmare_fuel_generator.py`
(adversarial/safety).

**B.5.1 Self-instruct** — ~200 seed instructions
(`ai/data/sdg_seeds/self_instruct_seed.jsonl`); generator produces k=4 new per
seed. Reject length < 30 chars, ROUGE-L > 0.7 vs prior, non-supported lang,
toxicity. Iterate to N=10000.

**B.5.2 Back-translation**: MarianMT round-trip EN→X→EN (paraphrastic variants);
apply to training input, not gold.

**B.5.3 Paraphrasing** — LLM paraphraser, temperature-high.

- Filter: ROUGE-L > 0.85 vs original = too similar.
- < 0.30 = meaning drift, drop.

**B.5.4 Domain-specific augmentation** — edge-case templates via
`nightmare_fuel_generator.py` for clinical adversarial/safety.
`(topic, difficulty, modality)` → generation prompt. Outputs pass full Stage 1 +
Stage 2 QA.

**B.5.5 Synthetic QC (STRICTER than natural)**:

```python
SYNTH_QC_THRESH = {
    "min_quality_score": 0.80,       # vs 0.85 pipeline-default
    "min_self_consistency": 0.85,    # 3-sample variance < 0.05
    "max_synth_fraction": 0.30,      # cap in final dataset
    "max_dup_vs_natural": 0.60,      # MinHash Jaccard to natural corpus
    "human_spot_check_rate": 0.05,   # always spot-check synthetic
}
```

Pass EVERY gate (dedup, PII, LLM judge).

- Second LLM judge pass specialized for "synthetic-style artifacts"
  (over-formality, repetition, weird dialogue flow).

### B.6 DVC Versioning Workflow

**B.6.1 Init + remote**:

```bash
dvc init
dvc remote add -d pixelated_s3 s3://pixelated-datasets/dvc
dvc remote modify pixelated_s3 region us-west-2
dvc config core.checksum_jobs 8
# MinIO alt: endpoint_url http://minio.pixelated.love:9000
```

**B.6.2 Dataset add + push**:

```bash
dvc add ai/data/curated/sft_chatml/{train,val,test}.jsonl
git add ai/data/curated/sft_chatml/*.dvc ai/data/curated/.gitignore
git commit -m "data: dataset v1 curated sft_chatml train/val/test"
dvc push  # uploads to S3
git push  # uploads .dvc pointers only
```

**B.6.3 Version tags**:

```bash
git tag -a dataset-v1.0.0 -m "50K SFT samples; T1:T2:T3 = 100:25000:25000 balanced"
# pin training to version: configs/2026-08-10/qwen32b-sft.yaml: dataset_version: "dataset-v1.0.0"
# reproduce: git checkout dataset-v1.0.0 -- ai/data/curated/ && dvc pull
```

**B.6.4 Access pattern**:

```python
def load_versioned(split: str, version: str = "dataset-v1.1.0") -> list[dict]:
    subprocess.run(["git", "checkout", version, "--", f"ai/data/curated/sft_chatml/{split}.jsonl.dvc"], check=True)
    subprocess.run(["dvc", "pull"], check=True)
    path = f"ai/data/curated/sft_chatml/{split}.jsonl"
    assert _read_dvc_md5(f"{path}.dvc") == _md5_file(path), "hash mismatch"
    return [json.loads(l) for l in open(path, encoding="utf-8")]
```

**B.6.5 Reproduction chain**:

```bash
git clone https://github.com/vivi/pixelated.git && cd pixelated && git checkout dataset-v1.1.0
dvc pull
uv run python ai/training/curate_pipeline.py --input ai/data/raw/deduped/all_desloped.jsonl --output ai/data/curated
uv run python ai/training/dataset_splitter.py ai/data/curated/sft_chatml ai/data/curated/sft_chatml_splits
axolotl train configs/2026-08-10/qwen32b-sft.yaml
```

### B.7 Stratified Split Implementation

Existing repo: hash-bucket (`dataset_splitter.py`,
`curate_pipeline.py:assign_split`):
`bucket = int(chash[:8], 16) % 100; <80 train; <90 val; else test`. No leakage
but does NOT preserve class balance. Upgrade to true stratified.

**Multi-axis targets**: `domain` (20+ subdomains from
`data_audit.py:CATEGORY_KEYWORDS`), `difficulty` (easy/medium/hard), `language`
(en/es/fr/pt/de per `multilingual_safety_checker.py`), `tier`
(T1_GOLD/T2_SILVER/T3_BRONZE/T4_SAFETY per `curate_pipeline.py:QualityTiers`).

**B.7.1 Multi-label stratification** — `iterative-stratification` library
(skmultilearn) for multi-label tags:

```python
from iterstrat.ml_stratifiers import MultilabelStratifiedShuffleSplit
from sklearn.preprocessing import MultiLabelBinarizer
msss = MultilabelStratifiedShuffleSplit(n_splits=1, test_size=0.20, random_state=42)
train_idx, rest_idx = next(msss.split(
    np.zeros(len(records)),
    MultiLabelBinarizer().fit_transform([r.get("tags", []) for r in records]),
))
# second split rest → val/test (50/50)
```

**B.7.2 Domain balance** — marginal domain proportion deviates from full-dataset
by < 2pp.

- fallback re-run with different seed.

**B.7.3 Difficulty + tier** — single-label `StratifiedShuffleSplit` on
`difficulty` primary, `tier` nested.

**B.7.4 Language stratification** — per-language independent split then merge.

- avoids cross-language leakage, preserves within-language balance.
- Critical for Qwen (CN-heavy base).

**B.7.5 Combined multi-axis** — group by language → multi-label stratify on tags
(rare classes < 50 → `__OTHER__` strat-only key, preserve original tags) → check
tier. Hash-split (`_hash_split`) preserved as deterministic fallback for edge
cases.

**B.7.6 Split integrity gates** (abort training on failure):

```python
def integrity_gates(splits: dict) -> dict:
    checks = {}
    # 1. hash-disjoint (no cross-split leakage)
    # 2. ratio within ±2pp tolerance
    # 3. domain/language balance ±2pp
    return checks  # all True → release training
```

### B.8 Cross-References to Existing Repo Code

| Pipeline stage                 | Existing impl                      | Status  |
| ------------------------------ | ---------------------------------- | ------- |
| Cohort/data audit              | `data_audit.py:CATEGORY_KEYWORDS`  | shipped |
| Curation + tier balancing      | `curate_pipeline.py:QualityTiers`  | shipped |
| Exact + near dedup             | `dedup_normalize.py:_MinHashIndex` | shipped |
| Hash split                     | `dataset_splitter.py`              | shipped |
| LLM judge (NeMo API + rubric)  | `clinical_validity_judge`          | shipped |
| PDF/EPUB/HTML parsing          | `book_pdf_converter.py:_extract_*` | shipped |
| PII scrubbing (Presidio)       | `pii_scrubber.py`                  | shipped |
| Provenance + SPDX license gate | `provenance.py:build_provenance`   | shipped |
| Synthetic data gen             | `sdg_pipeline.py`                  | shipped |
| YouTube transcript API ingest  | `youtube_ingestion.py`             | shipped |

---

## APPENDIX C — EXPANDED: Optimization Config Details

### SFT Hyperparameters (Axolotl / Unsloth)

```yaml
# Axolotl config excerpt
base_model: Qwen/Qwen2.5-32B
model_type: qwen
load_in_8bit: false
load_in_4bit: true
use_peft: true
lora_r: 64
lora_alpha: 128
lora_dropout: 0.05
target_modules:
  ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj']
bf16: true
fp16: false
epochs: 3
learning_rate: 2e-5
lr_scheduler_type: cosine
warmup_ratio: 0.1
max_grad_norm: 1.0
batch_size: 2
grad_accum_steps: 8
```

### LoRA Variant Configs

- **QLoRA (4-bit)**: `load_in_4bit: true`, `bnb_4bit_compute_dtype: bfloat16`.
- `bnb_4bit_quant_type: nf4`, `bnb_4bit_use_double_quant: true`.
- **DoRA**: `use_dora: true` (Axolotl/Unsloth); improves performance for same
  rank by decomposing weights.
- **AdaLoRA**: adaptive rank; start with `lora_r: 32` and allow adaptive growth;
  best when budget constrained.
- **VeRA**: reduced params; use for very small fine-tuning budgets (<1% params).

### DPO Config (Post-SFT Preference Alignment)

```yaml
# Axolotl DPO settings
dpo_beta: 0.1
learning_rate: 5e-6
per_device_train_batch_size: 1
gradient_accumulation_steps: 4
warmup_ratio: 0.1
lora_r: 32
lora_alpha: 64
# Preference dataset format: JSON with "chosen" and "rejected" fields
```

### ORPO Config (Single-Pass SFT + Preference)

- Use Unsloth or Axolotl if available; ORPO eliminates reference model and
  reduces memory by ~25% vs DPO.
- Config: `use_orpo: true`, `beta: 0.1`, same dataset structure as DPO.

### Pruning Schedule Example

```python
import torch.nn.utils.prune as prune
# After SFT, before inference optimization
prune.l1_unstructured(model, name='lora_A', amount=0.3)  # 30% magnitude pruning
prune.remove(model, 'lora_A')  # make permanent
# Recover with 1-epoch fine-tune on 10% of dataset (LoRA recovery)
```

Target: 30-50% fewer active params with < 5% quality loss post-recovery.

---

## APPENDIX D — EXPANDED: Tech Stack Setup (Docker, Axolotl, DeepSpeed, Git/DVC)

### Docker Build (Expanded)

Existing repo file: `docker-compose.gpu.override.yml`. Custom Axolotl image:

```dockerfile
FROM nvidia/cuda:12.6-devel-ubuntu22.04
RUN apt-get update && apt-get install -y python3.11 python3-pip git
COPY requirements.txt .
RUN pip install torch==2.4.0 transformers==4.45.0 datasets accelerate peft trl bitsandbytes
RUN pip install axolotl
WORKDIR /workspace
```

Build & run:

```bash
docker build -t axolotl-train:latest .
docker-compose -f docker-compose.yml -f docker-compose.gpu.override.yml up -d
```

### DeepSpeed ZeRO-3 Config (for Multi-GPU > 4 GPUs or 70B+)

```json
{
  "fp16": { "enabled": false },
  "bf16": { "enabled": true },
  "zero_optimization": {
    "stage": 3,
    "offload_optimizer": { "device": "cpu", "pin_memory": true },
    "offload_param": { "device": "cpu", "pin_memory": true },
    "overlap_comm": true,
    "contiguous_gradients": true,
    "sub_group_size": 1e9,
    "reduce_bucket_size": 4e8,
    "stage3_prefetch_bucket_size": 9e6,
    "stage3_param_persistence_threshold": 1e5,
    "stage3_max_live_parameters": 3e9
  },
  "gradient_accumulation_steps": 8,
  "gradient_clipping": 1.0,
  "train_batch_size": "auto",
  "train_micro_batch_size_per_gpu": "auto",
  "optimizer": {
    "type": "AdamW",
    "params": {
      "lr": "auto",
      "betas": [0.9, 0.999],
      "eps": 1e-8,
      "weight_decay": 0.01
    }
  },
  "scheduler": {
    "type": "WarmupDecayLR",
    "params": {
      "warmup_min_lr": 0,
      "warmup_max_lr": "auto",
      "warmup_num_steps": 100
    }
  },
  "total_num_steps": "auto"
}
```

### Git + DVC Workflow (Expanded)

```bash
# Per experiment
git checkout -b experiment/2026-08-10-qwen32b-sft
# Config changes tracked in Git; dataset tracked in DVC
git add configs/
git commit -m "Add SFT config for Qwen2.5-32B, dataset v1.2"
dvc add data/dataset_v1.2/
dvc push
# After training
dvc add outputs/model_weights/
dvc push
git tag -a v1.2-model -m "Model v1.2: Qwen2.5-32B SFT, dataset v1.2, forgetting_score 0.04"
```

- Never commit weights (`.pth`, `.safetensors`, `.bin`) to Git; always use
  `.gitignore` rules.
- Config naming convention:
  `configs/<date>-base_model>-dataset_version>-stage>.yaml`.

### CI Pipeline (Basic)

```yaml
# .github/workflows/train.yml (simplified)
name: Training Pipeline CI
on: [push]
jobs:
  validate-config:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run:
          python -c "import yaml; yaml.safe_load(open('configs/latest.yaml'))"
  dataset-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: dvc pull
      - run:
          python scripts/validate_dataset.py --dataset data/dataset_latest/
          --min-quality 0.85
```

---

## APPENDIX E — EXPANDED: Optimization Pipeline Step-by-Step (SFT → DPO/ORPO → Pruning → Quantization)

### Step 1: Base Model Selection + Benchmark

- Run base model on domain benchmark + MMLU (pre-training reference).
- Save results as `benchmarks/pre_train_YYYY-MM-DD.json`.

### Step 2: Dataset Freeze + Split

- Lock dataset version with DVC (`dataset_vX.Y`).
- Generate stratified 80/10/10 split; save split indices.
- Verify average quality score ≥ 0.85; else return to QA.

### Step 3: SFT (Axolotl / Unsloth)

- Config: `lora_r=64`, `lora_alpha=128`, `load_in_4bit=true`.
- Monitor loss curve; early stop if validation perplexity increases for 2
  consecutive epochs.
- Save adapter weights; do not merge yet.

### Step 4: Preference Alignment (DPO / ORPO)

- Build preference dataset: for each prompt, select best assistant response
  (`chosen`) and worst (`rejected`).
- Run DPO or ORPO; compare benchmark scores to SFT-only.
- If preference alignment reduces domain score > 2%, revert to SFT weights.

### Step 5: Catastrophic Forgetting Test

- Run full benchmark suite (general + domain) on merged adapter weights.
- Calculate `forgetting_score`. If > 10%: apply mixed fine-tuning (add 20%
  general data to dataset) or use replay strategy.

### Step 6: Pruning (Optional, Pre-Deployment)

- Apply magnitude-based pruning to adapter weights (not base model) for small
  footprint.
- Recover with 1-epoch fine-tune on 10% of dataset.
- Verify domain score remains within 5% of pre-prune.

### Step 7: Quantization for Inference

- Convert to AWQ / GPTQ / GGUF for deployment.
- Use `vLLM` for optimized inference.
- Benchmark latency (tokens/sec) vs quality trade-off.

---

*End of expanded blueprint. All expansions synthesize NVIDIA NeMo distributed
skill (FSDP2/PP/CP/MoE), dataset curation best practices, detailed optimization
configs, and tech stack implementation steps. Original structure (Sections 1-7 +
Action Plan) preserved and extended.*

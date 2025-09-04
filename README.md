# Pixel GPT Remote Fine-Tuning Bundle

## Purpose
This tarball contains all scripts, core datasets, and training pipelines for running remote **gpt-oss** fine-tuning. It is designed for reproducible, multi-phase model training, including enhanced multi-GPU and curriculum pipeline support.

**Highlights:**
- Includes all code/notebooks to launch, monitor, and resume gpt-oss fine-tuning
- Contains all datasets and curriculum configs required for remote or cloud training
- Ready for HuggingFace and WandB integration

---

## Quickstart (Typical Usage)

**Unpack and Enter Directory**
```bash
tar -xzf pixel_gpt.tar.gz
cd pixel_gpt
```

**Run main script (Python):**
```bash
cd ai/research/notebooks
uv python gpt_oss.py  # or enhanced_multi_gpu_training.py
```

**Run shell training launcher:**
```bash
uv bash run_gpt_oss.sh
```

---

## Environment & Credentials Setup

- **HuggingFace token:** Set `HUGGINGFACE_TOKEN` in your environment.
- **Weights & Biases:** Set `WANDB_API_KEY`; ensure `wandb` Python package is installed.
- See scripts for typical env usage.

---

## Files & Assets Included

- `ai/research/notebooks/` (scripts: gpt_oss.py, run_gpt_oss.sh, gpt_oss.ipynb, enhanced_multi_gpu_training.py)
- `ai/datasets/` (all folders and files, including merged_mental_health_dataset.jsonl)
- `ai/pipelines/dual_persona_training/` (curriculum configs and assets)

---

## Launch on Server

1. Copy `pixel_gpt.tar.gz` to your server and unpack.
2. Set up `uv` (https://github.com/exaloop/uv) or use conda/micromamba.
3. Export HuggingFace/WandB credentials.
4. Start training via `uv python gpt_oss.py` or use the provided shell script.

---

**Excludes:** .git/, .DS_Store, previous tarballs.

Consult notebooks/scripts for full argument options and resume/monitoring info.
  
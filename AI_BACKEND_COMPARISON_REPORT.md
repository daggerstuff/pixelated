# AI Backend Comparison Report

## Local (pixelated) vs Backup (Feb 25, 2026)

**Generated**: 2026-03-15  
**Task**: Compare local AI backend with Google Drive backup to identify missing components  
**Backup analyzed**: `drive:backups/pixelated/clutch/2026-02-25-020001/ai/`  
**Local root**: `/home/vivi/pixelated/ai/`  
**Datasets excluded**: Yes (per user request - data/, dataset/, raw_data/, \*.jsonl excluded from comparison)

---

## Executive Summary

- **Recent reorganization detected**: Backup reflects a flattened hierarchy
  where content previously nested under `ai/core/` and `ai/infra/` is now at top-level.
- **Major gaps**: Local is missing 15+ entirely new modules plus significant documentation updates.
- **Recommended action**: Adopt backup's flat structure (Option A) for clean alignment with current development state.
- **Total new infrastructure (excluding datasets)**: ~100-150 MB of code/configs plus docs expansion (+34 MB).

---

## 1. Structure Change: Reorganization

### Local Structure (current)

```text
ai/
├── __pycache__/
├── compiled_dataset/
├── core/              ← Holds most modules (api, cli, pipelines, scripts, tools, etc.)
├── data/
├── docs/              (1.4 MB, 90 files)
├── infra/             ← Holds deployment/infra modules (config, monitoring, docker, helm, safety, etc.)
├── lab/
├── lightning/         (127 MB, 22 files) ← Transferred
├── logs/
├── orchestrator/
├── pixelated_ai.egg-info/
├── src/
├── training/          (76 MB) ← Transferred earlier
└── training_ready/    (12 KB) ← Transferred
```

### Backup Structure (Feb 25, post-reorg)

```text
ai/
├── .github/
├── .ruff_cache/
├── ai/                (empty placeholder)
├── analysis/          (89 KB)
├── annotation/        (176 KB)
├── api/               (1.2 MB, 75 files)
├── archive/           (650 KB)
├── autoscaling/       (32 KB)
├── bin/               (8.7 MB, 234 files) - VMAF models + ffmpeg docs
├── cli/               (265 KB)
├── common/            (8.7 KB)
├── compliance/        (332 KB)
├── config/            (147 KB) ← Moved from infra/config to top-level
├── data/              (847 MB) ← Datasets, excluded
├── database/          (108 KB)
├── dataset_pipeline/  (43 KB)
├── demos/             (74 KB)
├── deployment/        (158 KB)
├── docker/            (7.6 KB)
├── docs/              (36 MB, 143 files) ← Expanded from 1.4 MB!
├── enterprise_config/ (305 B)
├── evals/             (10 KB)
├── examples/          (30 KB)
├── experimental/      (2.3 KB)
├── explainability/    (43 KB)
├── helm/              (8.6 KB)
├── infrastructure/    (3.7 MB, 179 files) ← Additional infra beyond lifted subfolders
├── journal_dataset_research/ (811 B)
├── lightning/         (252 MB) ← Transferred (infrastructure only, no data)
├── memory/            (59 KB)
├── metrics/           (285 B)
├── models/            (3.4 GB) ← Defense mechanism checkpoints (dataset-sized)
├── monitoring/        (21.8 MB, 189 files)
├── multimodal/        (41 KB)
├── nemo/              (53 KB)
├── performance/       (25 KB)
├── pipelines/         (8.9 MB, 707 files)
├── pixelated_ai.egg-info/ (73 KB)
├── platform/          (161 KB)
├──psydefdetect/       (5.7 MB) ← Contains training data (train.json, test.json)
├── safety/            (137 KB)
├── scripts/           (768 KB, 79 files)
├── security/          (1.5 KB)
├── sourcing/          (2.0 MB)
├── tests/             (621 KB, 65 files)
├── tools/             (214 KB, 27 files)
├── training/          (96.9 MB, 660 files) ← Already transferred
├── training_ready/    (2.3 KB) ← Transferred (docs only)
├── triton/            (59 KB)
├── utils/             (43 KB)
└── youtube_transcriptions/ (6.7 MB, 233 files) ← YouTube transcripts
```

---

## 2. Mapping: Local → Backup (Reorganization)

### 2.1 Modules lifted from `core/` to top-level

| Local `core/` subdir | Backup top-level | Notes                                                                               |
| -------------------- | ---------------- | ----------------------------------------------------------------------------------- |
| `core/api/`          | `api/`           | Embedding agent, MCP server, memory services                                        |
| `core/bin/`          | `bin/`           | Model binaries (VMAF) - but bin/ also has additional items                          |
| `core/cli/`          | `cli/`           | Command-line interface commands                                                     |
| `core/detection/`    | ?                | Not explicitly seen in backup top-level (may be under `models/defense_mechanisms/`) |
| `core/memory/`       | `memory/`        | Memory management utilities                                                         |
| `core/multimodal/`   | `multimodal/`    | Multimodal processing                                                               |
| `core/nemo/`         | `nemo/`          | NVIDIA NeMo tools                                                                   |
| `core/pipelines/`    | `pipelines/`     | Expanded from 49 to 707 files (+658 files!)                                         |
| `core/scripts/`      | `scripts/`       | Expanded from local core/scripts                                                    |
| `core/serving/`      | ?                | May be under `platform/` or `deployment/`                                           |
| `core/sourcing/`     | `sourcing/`      | Data sourcing pipeline                                                              |
| `core/tests/`        | `tests/`         | Test suites                                                                         |
| `core/tools/`        | `tools/`         | Utility tools                                                                       |
| `core/utils/`        | `utils/`         | Helper utilities                                                                    |
| `core/validation/`   | ?                | Possibly under `quality` or `infrastructure`                                        |
| `core/annotation/`   | `annotation/`    | Expanded (25 files vs local's annotation/)                                          |

### 2.2 Modules lifted from `infra/` to top-level

| Local `infra/` subdir          | Backup top-level     | Notes                                           |
| ------------------------------ | -------------------- | ----------------------------------------------- |
| `infra/autoscaling/`           | `autoscaling/`       |                                                 |
| `infra/compliance/`            | `compliance/`        |                                                 |
| `infra/config/`                | `config/`            | Now top-level (previously nested)               |
| `infra/deployment/`            | `deployment/`        |                                                 |
| `infra/docker/`                | `docker/`            |                                                 |
| `infra/enterprise/`            | `enterprise_config/` |                                                 |
| `infra/helm/`                  | `helm/`              |                                                 |
| `infra/metrics/`               | `metrics/`           |                                                 |
| `infra/monitoring/`            | `monitoring/`        | Expanded to 189 files, 21.8 MB                  |
| `infra/performance/`           | `performance/`       |                                                 |
| `infra/platform/`              | `platform/`          |                                                 |
| `infra/safety/`                | `safety/`            |                                                 |
| `infra/security/`              | `security/`          |                                                 |
| `infra/cloud/`                 | ?                    | Possibly under `platform/` or `infrastructure/` |
| `infra/grafana_dashboard.yaml` | ?                    | May be under `monitoring/`                      |

**Note**: Some local-only directories (`lab/`, `orchestrator/`, `src/`, `logs/`) have no counterpart in backup—
these may be project-specific or development artifacts that weren't part of the production AI backend.

---

## 3. Genuinely New Content (Not in Local at All)

These backup top-level folders have **no equivalent** in the local `ai/` directory:

| Folder                      | Size   | Files | Description                                                                                           |
| --------------------------- | ------ | ----- | ----------------------------------------------------------------------------------------------------- |
| `analysis/`                 | 89 KB  | 2     | Analysis notebooks/scripts (Jupyter notebooks, data analysis)                                         |
| `archive/`                  | 650 KB | 19    | Archived legacy code/models (maybe Kurtis-E1-MLX-Voice-Agent still in archive/legacy-models/)         |
| `common/`                   | 8.7 KB | 2     | Shared utilities/common code used across modules                                                      |
| `database/`                 | 108 KB | 1     | Database schema, migrations, connection configs                                                       |
| `dataset_pipeline/`         | 43 KB  | 7     | Dataset processing pipeline configuration                                                             |
| `demos/`                    | 74 KB  | 5     | Demo applications showcasing features                                                                 |
| `examples/`                 | 30 KB  | 4     | Example usage code/configs for developers                                                             |
| `experimental/`             | 2.3 KB | 1     | Placeholder for experimental features (maybe empty marker file)                                       |
| `explainability/`           | 43 KB  | 1     | Model interpretability tools                                                                          |
| `evals/`                    | 10 KB  | 4     | Evaluation frameworks/scripts (benchmarking)                                                          |
| `journal_dataset_research/` | 811 B  | 1     | Research notes on dataset construction                                                                |
| `metrics/`                  | 285 B  | 1     | Metrics definitions/logging config                                                                    |
| `triton/`                   | 59 KB  | 11    | NVIDIA Triton Inference Server configs                                                                |
| `infrastructure/`           | 3.7 MB | 179   | Additional infrastructure code beyond lifted subfolders (maybe cloud-specific, integration tests, QA) |
| `config/` (top-level)       | 147 KB | 38    | Config files that were previously under infra/config (now consolidated at top-level)                  |

**Total new infrastructure (excluding heavy assets)**: ~5-6 MB + docs expansion.

---

## 4. Heavy Assets (Dataset-sized, May Want to Skip)

Per your "no datasets" rule, these contain large data files and should likely remain on Google Drive unless needed:

| Folder                    | Reported Size | Contents                                                                                                                   | Transfer?                                                       |
| ------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `models/`                 | 3.4 GB        | Defense mechanism model checkpoints (fold_0, fold_1, ... fold_4 with best_model.pt files 737 MB each)                      | **Large models** - only needed for inference; could be remote   |
| `psydefdetect/`           | 5.7 MB        | Contains `input_data/` with `train.json` (4.3 MB) and `test.json` (1.2 MB) + `solution/model.py`                           | Training data + solution code. Code useful, data may be skipped |
| `youtube_transcriptions/` | 6.7 MB        | 233 transcript files from various YouTube channels (10% Happier, ART, Big Think, etc.)                                     | Raw transcripts (data)                                          |
| `bin/model/`              | ~6 MB         | VMAF video quality assessment models (JSON + .pkl.model files) - these are ML models for video quality, not therapeutic AI | Optional; useful if doing video quality evaluation              |

Note: `training_ready/data/generated/` already skipped; contains generated datasets.

---

## 5. Expanded Content (Folders That Exist Locally but Backup Has More)

These folders exist in both local and backup, but backup has significantly more files or updated structure:

| Folder                                                                                                                                                                                                                                             | Local                                  | Backup                         | Change                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| `docs/`                                                                                                                                                                                                                                            | 1.4 MB (90 files)                      | 36 MB (143 files)              | +34.6 MB! Major documentation update                                                     |
| `monitoring/`                                                                                                                                                                                                                                      | under `infra/monitoring/` (19 subdirs) | standalone, 189 files, 21.8 MB | New aggregated monitoring setup                                                          |
| `pipelines/`                                                                                                                                                                                                                                       | under `core/pipelines/` (49 subdirs)   | standalone, 707 files, 8.9 MB  | +658 files                                                                               |
| `scripts/`                                                                                                                                                                                                                                         | under `core/scripts/`                  | standalone, 79 files, 768 KB   | Expanded                                                                                 |
| `tools/`                                                                                                                                                                                                                                           | under `core/tools/`                    | standalone, 213 KB             |                                                                                          |
| `sourcing/`                                                                                                                                                                                                                                        | under `core/sourcing/`                 | standalone, 2.0 MB             |                                                                                          |
| `compliance/`, `security/`, `safety/`,<br>`performance/`, `platform/`, `deployment/`,<br>`docker/`, `helm/`, `autoscaling/`,<br>`enterprise_config/`, `database/`, `dataset_pipeline/`,<br>`memory/`, `multimodal/`, `nemo/`,<br>`cli/`, `common/` | mostly under `core/` or `infra/`       | now top-level                  | These are the "lifted" modules; backup likely has all local files plus additions/updates |

---

## 6. Already Transferred (Up-to-date)

The following were already transferred from backup earlier or were not missing:

- `lightning/` (252 MB, 23 files) - transferred 2026-03-15 (infrastructure only, dataset files excluded)
- `training/` (96.9 MB, 660 files) - transferred earlier
- `training_ready/` (2.3 KB, 1 file) - transferred (docs only, data excluded)
- `pixelated_ai.egg-info/` - both have

---

## 7. Local-Only (Not in Backup)

These exist locally but are absent from the backup:

- `__pycache__` - Python bytecode cache (build artifact)
- `compiled_dataset/` - local compiled dataset (1 file)
- `lab/` - lab notebooks/experiments (development area)
- `logs/` - application logs (runtime artifacts)
- `orchestrator/` - orchestrator module (maybe moved to `core/` in backup)
- `src/` - perhaps source code entry point (in local, but backup has `core/src/data_pipeline/` and `pixelated_ai.egg-info`)

These may be development-only or have been moved/renamed in the reorg.

---

## 8. Recommendation & Next Steps

### Option A: Adopt backup's flat structure (Recommended)

- This aligns with the team's reorg decision.
- Delete `ai/core/` and `ai/infra/` after verifying any local-only files are backed up.
- Copy all backup top-level folders (except heavy data: `data/`, `models/`, `psydefdetect/input_data/`, `youtube_transcriptions/`).
- This gives you a clean, modern structure that matches current development.

**Pros**: Clean, single source of truth, easier navigation, all modules at top-level.  
**Cons**: Requires adjusting imports if code referenced `core.*` paths (but backup likely already updated imports).

### Option B: Keep local structure, copy only genuinely new folders

- Copy only folders that don't exist locally: `analysis/`, `archive/`, `common/`, `database/`,
  `dataset_pipeline/`, `demos/`, `examples/`, `experimental/`, `explainability/`, `evals/`,
  `journal_dataset_research/`, `metrics/`, `triton/`, plus the expanded `docs/`.
- Skip the "lifted" modules (api, pipelines, scripts, etc.) since they're already in `core/` and `infra/`.
- Consider merging `infra/config/` into local `infra/config/` and updating `config/` at top-level if needed.

**Pros**: Minimal disruption, preserves existing structure.  
**Cons**: You'll have both old nested and new top-level folders coexisting (mixed structure); may cause confusion.

### Option C: Hybrid

Copy new top-level folders but keep `core/` and `infra/` intact. Over time, gradually migrate references.

---

### Suggested Immediate Actions (if choosing Option A)

1. **Backup current local `ai/`** (just in case):

   ```bash
   cp -r /home/vivi/pixelated/ai /home/vivi/pixelated/ai.backup-$(date +%Y%m%d)
   ```

2. **Remove old nested structure** (after verifying):

   ```bash
   rm -rf /home/vivi/pixelated/ai/core
   rm -rf /home/vivi/pixelated/ai/infra
   ```

3. **Copy missing infrastructure from backup** (excluding datasets):

   ```bash
   # Transfer everything except data, models, psydefdetect input_data, youtube data
   rclone copy drive:backups/pixelated/clutch/2026-02-25-020001/ai/ /home/vivi/pixelated/ai/ \
     --exclude "data/**" \
     --exclude "models/**" \
     --exclude "psydefdetect/input_data/**" \
     --exclude "youtube_transcriptions/**" \
     --exclude "*.zip" \
     --progress \
     --transfers=8
   ```

   This will skip the heavy dataset/model files but bring in all code, configs, docs, and new modules.

4. **Verify**:
   - Check that `ai/core/` and `ai/infra/` are gone (if removed).
   - Confirm new folders exist: `api/`, `pipelines/`, `monitoring/`, `config/`, etc.
   - Ensure `docs/` expanded properly.
   - Optionally keep `bin/` (VMAF models) - not therapeutic AI but useful for video quality.

---

### Questions for User

1. Which option do you prefer (A, B, or C)?
2. Should we transfer `bin/` (VMAF models + ffmpeg docs)? They're not therapeutic AI but may be useful.
3. Should we transfer `models/` (3.4 GB defense mechanism checkpoints)? These are large but might be needed for that module.
4. Should we transfer `psydefdetect/solution/model.py` and `psydefdetect/solution/*` but skip the training data?
5. Should we transfer `archive/` (legacy models like Kurtis-E1-MLX-Voice-Agent)? Or leave archived content remote?
6. Should we transfer `infrastructure/` (3.7 MB, 179 files)? This appears to be additional infra code beyond
   the lifted subfolders.

Once you answer, I'll proceed with the sync accordingly.

---

## Appendix: Commands Used for Analysis

```bash
# List backup top-level directories
rclone lsd drive:backups/pixelated/clutch/2026-02-25-020001/ai/

# Get size/count for each folder
rclone size drive:backups/pixelated/clutch/2026-02-25-020001/ai/FOLDER/ --exclude "data/**" --exclude "dataset/**"

# Recursive listings
rclone lsd drive:backups/pixelated/clutch/2026-02-25-020001/ai/FOLDER/ --recursive

# Local analysis
ls -d /home/vivi/pixelated/ai/*/ | xargs -I {} basename {} | sort
du -sh /home/vivi/pixelated/ai/*/
```

---

End of Report

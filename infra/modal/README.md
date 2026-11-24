# Modal Integration

Serverless GPU/CPU compute for bursty jobs that do not belong in the always-on
backend stack (embeddings, batch inference, one-off model runs).

Upstream guide: <https://modal.com/docs/guide>

The integration is **credential-gated**. Nothing in the repo requires a Modal
account: the local CLI reports what is missing instead of failing, and CI
validates offline and only deploys when `MODAL_TOKEN_ID` /
`MODAL_TOKEN_SECRET` are present.

| Property        | Value                                            |
| --------------- | ------------------------------------------------ |
| **SDK**         | `modal` — declared in `pyproject.toml` (`>=1.4.1`); the wrapper runs `>=1.6.4` |
| **Config style**| Python, in-app — Modal has no YAML manifest      |
| **Entry point** | `scripts/devops/modal.sh` (`make modal-*`)       |
| **CI workflow** | `.github/workflows/modal.yml`                    |
| **Default GPU** | `L4` (override with `PIXELATED_MODAL_GPU`)       |

---

## Layout

```
infra/modal/
├── apps/
│   ├── smoke.py        # CPU-only round-trip check
│   ├── batch_embed.py  # GPU text embeddings
│   ├── dataset.py      # dataset creation: normalize, dedupe, split
│   ├── train.py        # LoRA fine-tuning on a GPU
│   └── test_suite.py   # run the offline suite in a clean container
├── shared/
│   ├── gpu.py          # app naming + accelerator selection
│   ├── paths.py        # repo/volume path resolution inside containers
│   ├── rows.py         # canonical JSONL rows (chat + text)
│   └── workloads.py    # the workload registry behind `modal.sh targets`
└── ops/cli.py          # operator CLI behind scripts/devops/modal.sh
```

Apps are addressed as modules (`modal run -m infra.modal.apps.smoke`), not file
paths, so imports resolve identically on the laptop and inside the container.

---

## Setup

### 1. Authenticate

#### Where the token ID and token secret come from

Modal issues one **token pair** per API token: an ID (`ak-...`) and a secret
(`as-...`). Both are required — the ID is the username, the secret is the
password.

* **Dashboard (copy both):** <https://modal.com/settings/tokens> → **New
  token**. The secret is shown **once**, at creation time; copy it immediately.
  Existing tokens list only their ID and creation date, so a lost secret means
  creating a new token.
* **CLI (browser login):** `uv run modal token new` opens the browser and writes
  both values into `~/.modal.toml`; `uv run modal setup` does the same on a fresh
  machine.
* **Inspect what is already configured:** `uv run modal token info` prints the
  token **ID**, workspace and user — never the secret. The secret stays in
  `~/.modal.toml` under `token_secret`.
* **Set a pair without a browser:** `uv run modal token set --token-id ak-...
  --token-secret as-...` writes `~/.modal.toml`.
* **Rotate:** `uv run modal token rotate` creates a new pair and revokes the old
  one.

`MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET` take precedence over `~/.modal.toml`,
which is what CI and headless boxes use:

```bash
export MODAL_TOKEN_ID=ak-...
export MODAL_TOKEN_SECRET=as-...
```

Interactive workstation (opens a browser and writes `~/.modal.toml`):

```bash
uv run modal setup
```

### 2. Confirm the checkout can talk to Modal

```bash
make modal-status      # or ./scripts/devops/modal.sh status
```

Expected when configured:

```
sdk           1.6.4
profile       default
credentials   ~/.modal.toml
namespace     pixelated
gpu           L4
authenticated yes
```

The command exits `1` when unauthenticated, so it is safe to gate scripts on.
It never opens a browser and never modifies anything.

### 3. Prove a real container works

```bash
make modal-check
```

Runs `infra.modal.apps.smoke`: one short CPU container that reports its Python
version, platform, CPU count and whether it can reach the network. Costs
seconds of compute and uses no GPU or secrets.

---

## CI wiring

`.github/workflows/modal.yml` has two jobs:

| Job        | Trigger                                        | What it does                                                  |
| ---------- | ---------------------------------------------- | ------------------------------------------------------------- |
| `validate` | push/PR to `staging` touching `infra/modal/**` | `ruff check` + `ruff format --check` + offline pytest          |
| `deploy`   | `workflow_dispatch` with `deploy: true`        | `modal deploy` for every app, skipped when secrets are absent   |

Add both secrets to the repository (or the `production` environment):

```bash
gh secret set MODAL_TOKEN_ID
gh secret set MODAL_TOKEN_SECRET
```

The deploy job checks for them first and emits a warning instead of failing, so
the workflow stays green on a repo that has not been connected yet.

---

## Workload targets

`./scripts/devops/modal.sh targets` (or `make modal-targets`) lists the
workloads this repo can run. Each one is a `modal run` job, so nothing has to be
deployed first — and every job can also run locally, which is what makes Modal
an *option* target rather than a requirement.

| Target    | GPU    | What it does                                                       |
| --------- | ------ | ------------------------------------------------------------------ |
| `dataset` | CPU    | Normalize, dedupe, filter and split JSONL into `train`/`val`        |
| `train`   | `A100` | LoRA fine-tuning; adapters + `training_summary.json` to a volume    |
| `test`    | CPU    | Run the offline suite in a container with no local checkout or venv |
| `embed`   | `L4`   | Text embeddings for strings or a JSONL corpus                       |
| `smoke`   | CPU    | Container round-trip check                                          |

A typical chain:

```bash
# 1. Dataset creation -> /datasets/out/{train,val}.jsonl + manifest.json
make modal-dataset ARGS='--inputs dataset/final_dataset.jsonl --val-fraction 0.1'

# 2. Training -> /training/runs/<model>/ (adapters + summary)
make modal-train ARGS='--dataset /datasets/out/train.jsonl --epochs 2'

# 3. Testing -> the integration suite in a clean container
make modal-test
```

Every target forwards its extra arguments to the app's local entrypoint, so
`make modal-train ARGS='--help'` shows the app's own flags. Accelerators:
`PIXELATED_MODAL_TRAIN_GPU` and `PIXELATED_MODAL_EMBED_GPU` override a single
target, `PIXELATED_MODAL_GPU` overrides all of them.

### Volumes used by the workloads

| Volume               | Mount     | Written by       | Holds                                       |
| -------------------- | --------- | ---------------- | ------------------------------------------- |
| `pixelated-datasets` | `/datasets` | `dataset`      | `train.jsonl`, `val.jsonl`, `manifest.json` |
| `pixelated-training` | `/training` | `train`        | LoRA adapters, tokenizer, run summary       |
| `pixelated-hf-cache` | `HF_HOME` | `train`, `embed` | Hugging Face weights                        |

A relative `--out` is resolved inside the target's volume, so a flag can never
write to the container's ephemeral filesystem.

---

## Apps

### `smoke`

Round-trip check. No GPU, no model download.

```bash
make modal-check
```

### `batch_embed`

Sentence-transformer embeddings on a GPU. Model weights are cached in the
`pixelated-hf-cache` volume, so only the first run pays for the download.

```bash
# pipe-separated strings
make modal-embed ARGS='--texts "first|second"'

# or a JSONL dataset (`text` or `content` field per row)
./scripts/devops/modal.sh embed --dataset data/snippets.jsonl --out embeddings.jsonl
```

Output is JSONL with `text` and `embedding` keys.

### Adding an app

1. Create `infra/modal/apps/<name>.py` with
   `app = modal.App(app_name("<name>"))`.
2. Reuse `infra/modal/shared/gpu.py` for naming and the accelerator.
3. Register it in `infra/modal/shared/workloads.py` — `deployable=True` if it
   should ship with `deploy`, otherwise it becomes a `modal.sh <name>` target.
4. Import heavy runtime deps inside the container-side function, not at module
   scope (see `batch_embed.Embedder.load`).

---

## Configuration

| Variable                      | Default                                  | Purpose                            |
| ----------------------------- | ---------------------------------------- | ---------------------------------- |
| `MODAL_TOKEN_ID` / `_SECRET`  | —                                        | Headless auth (CI)                 |
| `PIXELATED_MODAL_NAMESPACE`   | `pixelated`                              | Prefix for deployed app names      |
| `PIXELATED_MODAL_GPU`         | `L4`                                     | Accelerator for every GPU workload |
| `PIXELATED_MODAL_EMBED_GPU`   | `L4`                                     | Embedding-only accelerator override |
| `PIXELATED_MODAL_TRAIN_GPU`   | `A100`                                   | Training-only accelerator override |
| `PIXELATED_MODAL_EMBED_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Model the embedding app loads      |
| `PIXELATED_MODAL_TRAIN_MODEL` | `Qwen/Qwen2.5-0.5B-Instruct`             | Base model the training app fine-tunes |

All six are documented (commented) in `.env.example`.

---

## Secrets

Apps that need tokens at run time read a Modal secret named
`pixelated-runtime`. Populate it from already-exported local env vars:

```bash
export HF_TOKEN=hf_...
./scripts/devops/modal.sh secret-sync --keys HF_TOKEN
```

`secret-sync` refuses to run when a selected key is missing locally, and only
logs key names — never values. Values are passed to the Modal CLI as arguments
(the documented `modal secret create NAME KEY=VALUE` form), so run it from a
trusted workstation rather than a shared shell.

Reference the secret from an app with:

```python
secrets = [modal.Secret.from_name("pixelated-runtime")]
```

---

## Cost control

- Every workload declares its own fallback accelerator (`embed` → `L4`,
  `train` → `A100`); `PIXELATED_MODAL_GPU` overrides all of them, and a job
  that needs more must ask for it explicitly.
- Keep `timeout=...` on every function so a hung job cannot burn GPU time
  indefinitely.
- Batch inputs (the embedding app uses `BATCH_SIZE = 64`) instead of one remote
  call per row.
- `modal app list` and the dashboard usage page are the source of truth for
  spend; there is no local ledger.

---

## Break/fix

| Symptom                                         | Cause                               | Fix                                                         |
| ----------------------------------------------- | ----------------------------------- | ----------------------------------------------------------- |
| `status` prints `authenticated no`              | No token in `~/.modal.toml` or env  | `uv run modal setup`, or export the token pair              |
| `deploy` job skipped with a warning             | Secrets not configured              | `gh secret set MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET`       |
| `modal run` sits at "Initializing"              | First-run image build               | Wait; later runs reuse the cached image                     |
| `Volume ... not found`                          | Volume deleted or wrong workspace   | `modal volume create pixelated-hf-cache`                    |
| `Invalid GPU type`                              | Typo in `PIXELATED_MODAL_GPU`       | Use a Modal spec: `L4`, `A10G`, `A100`, `H100`, `H100:2`    |
| Embedding re-downloads the model every run      | Volume not mounted at `HF_HOME`     | Check `volumes={CACHE_DIR: model_cache}` in `batch_embed.py` |
| Offline tests fail with `ModuleNotFoundError`   | `modal` missing from the env        | `uv sync` (the SDK is a declared dependency)                |
| `train` fails with `no usable training rows`    | Corpus has no `messages`/`text` content | Run `make modal-dataset` first, or inspect the JSONL      |
| `dataset`/`train` raises `FileNotFoundError`    | Relative input not baked into the image | Use `dataset/...` or an absolute `/datasets/...` path    |
| `test` cannot import `infra.modal`               | Path outside the baked trees        | Add the directory to `test_suite.image` and rerun           |

---

## Escalation

1. Reproduce with `make modal-status` and `make modal-check`; capture both
   outputs.
2. Check <https://status.modal.com> for platform incidents.
3. Open an issue with the failing command, the app name, and the Modal app ID
   from the dashboard URL (`https://modal.com/apps/...`).

---

## References

- Guide: <https://modal.com/docs/guide>
- Tokens: <https://modal.com/settings/tokens>
- Volumes (model caching): <https://modal.com/docs/guide/volumes>
- Secrets: <https://modal.com/docs/guide/secrets>
- GPU types: <https://modal.com/docs/guide/gpu>
- Deployments: <https://modal.com/docs/guide/managing-deployments>

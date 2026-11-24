"""Modal compute platform integration for Pixelated Empathy.

Layout:

* `apps/` — one module per workload: smoke check, embeddings, dataset creation,
  training and the containerised test suite.
* `shared/` — helpers the apps import at definition time (naming, GPU choice,
  canonical JSONL rows, container paths) plus the workload registry the CLI
  turns into subcommands.
* `ops/` — the operator CLI behind `scripts/devops/modal.sh`.

Modal configuration is code, not YAML: containers, images and GPU types are
declared next to the functions that use them. See `infra/modal/README.md`.
"""

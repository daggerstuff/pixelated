#!/usr/bin/env bash
# Build the minimal nf_code.tar.gz for the Colab Nightmare-Fuel run.
#
# Includes only what scripts/colab_nf_bootstrap.py + the generator need: the
# training package plus scenarios.jsonl, preserving the ai/ root that the
# generator resolves via Path(__file__).resolve().parents[1].
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$REPO_ROOT/nf_code.tar.gz}"

cd "$REPO_ROOT"
tar -czf "$OUT" \
  ai/training/__init__.py \
  ai/training/build_edge_and_nightmare_dataset.py \
  ai/training/generation_backend.py \
  ai/training/cliche_gate.py \
  ai/data/synthetic/assets/empathy_nightmare_fuel/scenarios.jsonl

echo "Built $OUT ($(du -h "$OUT" | cut -f1))"
tar -tzf "$OUT"
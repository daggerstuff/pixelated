#!/usr/bin/env python
"""Dump the pe service's OpenAPI schema to a checked-in JSON file.

Run from apps/web with the same path layout as the test suite:

    cd apps/web
    PYTHONPATH=.:.. uv run python ../../scripts/ci/generate_pe_openapi.py

The output (api-docs/pe-openapi.json) is checked in and refreshed by the
api-docs workflow, which opens a PR when the schema drifts from the
published copy — so the documented API surface cannot silently lag behind
the implementation.
"""

from __future__ import annotations

import json
from pathlib import Path

from src.pe.main import app

REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT = REPO_ROOT / "api-docs" / "pe-openapi.json"


def main() -> int:
    spec = app.openapi()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(spec, indent=2, sort_keys=True) + "\n")

    paths = len(spec.get("paths", {}))
    print(f"Wrote api-docs/pe-openapi.json ({paths} paths, OpenAPI {spec.get('openapi')}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

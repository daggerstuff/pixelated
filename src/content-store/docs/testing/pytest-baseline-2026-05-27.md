# Pytest Baseline - 2026-05-27

## Scope

This summary records the stabilized Python test baseline for `PIX-2278`.

## Verification

Command:

```bash
uv run --extra test pytest -q
```

Result:

```text
440 passed, 6 skipped
```

## Setup Findings

The initial suite did not reach functional failures because collection stopped on missing optional or legacy assets:

- `ai` is a git submodule; without `git submodule update --init ai`, tests importing `ai.*` fail during collection.
- Several parent-repo tests referenced `.agent` scripts that are not shipped in this checkout.
- Several training corpus tests referenced legacy `ai.training_corpus` modules that are not present in the pinned `ai` submodule revision.

The shared collection guard in `tests/_collection_guards.py` now avoids collecting those tests only when the corresponding source assets
are absent. Agent script checks also honor the same root override used by those tests, and training corpus checks are per test file so
partially restored modules are collected as soon as their required surface is present.

## Intentional Skips

The remaining reported skips are environment-gated:

- Bias detection service tests skip when `sqlalchemy` is unavailable.
- Reprioritizer tests skip when `security.api_authentication` is unavailable.
- NVIDIA RAG live tests skip without reachable NVIDIA credentials or `RUN_LIVE_TESTS=true`.

## Residual Risk

The clean baseline validates the currently shipped Python test surface. It does not validate the retired `.agent` scripts or the missing
legacy training corpus modules unless those assets are restored to the checkout.

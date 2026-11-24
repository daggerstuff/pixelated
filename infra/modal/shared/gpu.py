"""App naming and accelerator selection shared by every Modal app.

Both knobs come from the environment so a run can be retargeted without editing
code — the CI deploy job and a developer's shell then agree on what was asked
for:

* `PIXELATED_MODAL_NAMESPACE` — prefixes app names (default `pixelated`), so a
  shared Modal workspace never collides with another project's `smoke` or
  `embed` app.
* `PIXELATED_MODAL_GPU` — accelerator passed to `modal.cls`/`modal.function`
  (default `L4`). Any Modal GPU spec works, including counts such as `H100:2`.

A workload that needs a different card can pass its own env var and fallback
(`gpu_type(env_var="PIXELATED_MODAL_TRAIN_GPU", default="A100")`); the shared
`PIXELATED_MODAL_GPU` still wins over the workload fallback, so one export
retargets every app.
"""

from __future__ import annotations

import os

DEFAULT_NAMESPACE = "pixelated"

DEFAULT_GPU = "L4"


def app_namespace() -> str:
    """Return the namespace that prefixes this repo's deployed app names."""
    namespace = os.environ.get("PIXELATED_MODAL_NAMESPACE", DEFAULT_NAMESPACE)
    return namespace.strip() or DEFAULT_NAMESPACE


def app_name(app: str) -> str:
    """Return the deployed name for one of our apps, e.g. `pixelated-smoke`."""
    return f"{app_namespace()}-{app}"


def gpu_type(
    env_var: str = "PIXELATED_MODAL_GPU",
    default: str = DEFAULT_GPU,
) -> str:
    """Return the accelerator Modal should attach, e.g. `L4` or `H100:2`.

    The workload-specific `env_var` wins, then the shared `PIXELATED_MODAL_GPU`,
    then `default`. Blank values fall through instead of producing an empty
    accelerator string.
    """
    accelerator = os.environ.get(env_var) or os.environ.get("PIXELATED_MODAL_GPU") or default
    return accelerator.strip() or default

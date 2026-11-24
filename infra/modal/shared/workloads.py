"""The named Modal workloads this repo can run.

Training, testing and dataset creation are all "option targets": the same job
can run on a workstation, in the backend stack, or on Modal. This registry is
the Modal side of that choice — it pins the module Modal runs, the accelerator
the app asks for and the timeout that stops a hung job from burning GPU hours.

`infra.modal.ops.cli` turns every entry into a subcommand, and
`scripts/devops/modal.sh` forwards to it, so adding a target means adding the
app module plus one row here.
"""

from __future__ import annotations

from dataclasses import dataclass

from infra.modal.shared.gpu import DEFAULT_GPU, gpu_type


@dataclass(frozen=True)
class Workload:
    """One runnable Modal app plus the knobs the CLI reports."""

    name: str
    module: str
    description: str
    default_gpu: str | None = None
    gpu_env: str | None = None
    timeout: int = 3600
    deployable: bool = False

    @property
    def app(self) -> str:
        """Return the module stem, e.g. `batch_embed` for `...apps.batch_embed`."""
        return self.module.rsplit(".", 1)[-1]

    def gpu(self) -> str | None:
        """Return the accelerator for this workload, or None when it is CPU-only."""
        if self.default_gpu is None:
            return None
        return gpu_type(env_var=self.gpu_env or "PIXELATED_MODAL_GPU", default=self.default_gpu)


WORKLOADS: dict[str, Workload] = {
    "smoke": Workload(
        name="smoke",
        module="infra.modal.apps.smoke",
        description="CPU round-trip check: container boots and reaches the network",
        timeout=300,
        deployable=True,
    ),
    "embed": Workload(
        name="embed",
        module="infra.modal.apps.batch_embed",
        description="GPU text embeddings for strings or a JSONL corpus",
        default_gpu=DEFAULT_GPU,
        gpu_env="PIXELATED_MODAL_EMBED_GPU",
        timeout=900,
        deployable=True,
    ),
    "train": Workload(
        name="train",
        module="infra.modal.apps.train",
        description="LoRA fine-tuning on a JSONL corpus, adapters written to a volume",
        default_gpu="A100",
        gpu_env="PIXELATED_MODAL_TRAIN_GPU",
        timeout=6 * 3600,
    ),
    "test": Workload(
        name="test",
        module="infra.modal.apps.test_suite",
        description="Run the offline test suite in a clean CPU container",
        timeout=1800,
    ),
    "dataset": Workload(
        name="dataset",
        module="infra.modal.apps.dataset",
        description="Normalize, dedupe, filter and split a JSONL corpus",
        timeout=1800,
    ),
}

#: Workloads the CLI exposes as `modal.sh <name> ...` run targets.
RUN_TARGETS = ("embed", "train", "test", "dataset")

#: App module stems accepted by `deploy --app` (stable for existing callers).
APPS = tuple(workload.app for workload in WORKLOADS.values() if workload.deployable)


def resolve(name: str) -> Workload:
    """Return the workload called `name`, raising a helpful KeyError otherwise."""
    workload = WORKLOADS.get(name)
    if workload is None:
        raise KeyError(f"unknown workload {name!r}; choose from {', '.join(WORKLOADS)}")
    return workload

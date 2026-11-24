"""Container-side path conventions shared by the Modal workloads.

A remote job runs with two roots: the repo sources baked into the image and the
volumes mounted for durable data. Inputs are resolved against the repo root
unless they are absolute, outputs against the volume unless they are absolute —
so a relative flag can never quietly write to an ephemeral container path.
"""

from __future__ import annotations

from pathlib import Path

REPO_DIR = "/root/repo"


def resolve_repo_path(source: str | Path, repo_dir: str | Path = REPO_DIR) -> Path:
    """Resolve an input path against the repo root when it is relative."""
    path = Path(source)
    return path if path.is_absolute() else Path(repo_dir) / path


def resolve_volume_path(target: str | Path, volume_dir: str | Path) -> Path:
    """Resolve an output path against a volume mount when it is relative."""
    path = Path(target)
    return path if path.is_absolute() else Path(volume_dir) / path

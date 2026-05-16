"""Compatibility shim for legacy top-level ``utils`` imports."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import json

from ai.core.utils.s3_dataset_loader import (
    S3DatasetLoader as CoreS3DatasetLoader,
    get_s3_dataset_path as _core_get_s3_dataset_path,
)


class S3DatasetLoader(CoreS3DatasetLoader):
    """Backwards-compatible alias that prefers local JSONL loading."""

    def __init__(self, *_, **__):
        super().__init__(*_, **__)

    def load_text(self, path: str) -> str:
        if path.startswith("s3://"):
            _, key = self._split_bucket_key("", path)
            local = self._maybe_local_path("", key)
            if local is not None:
                return local.read_text(encoding="utf-8")
            raise FileNotFoundError(f"S3 loading is not configured for: {path}")
        return Path(path).read_text(encoding="utf-8")

    def stream_jsonl(self, path: str) -> Iterator[dict[str, Any]]:
        bucket = ""
        if path.startswith("s3://"):
            bucket, key = self._split_bucket_key(bucket, path)
            if local := self._maybe_local_path(bucket, key):
                yield from self._iter_json_lines(local)
                return
            raise FileNotFoundError(f"S3 loading is not configured for: {path}")
        local = Path(path)
        if not local.exists():
            raise FileNotFoundError(path)
        yield from self._iter_json_lines(local)


def get_s3_dataset_path(dataset_name: str) -> str:
    return _core_get_s3_dataset_path(dataset_name)


def load_dataset_from_s3(dataset_name: str) -> Any:
    payload = Path(dataset_name)
    if payload.exists():
        raw = payload.read_text(encoding="utf-8")
        if dataset_name.endswith(".jsonl"):
            return [json.loads(line) for line in raw.splitlines() if line.strip()]
        return json.loads(raw)
    loader = S3DatasetLoader()
    return loader.load_json("", dataset_name)


def _iter_json_lines(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                yield {"text": line.rstrip("\n")}


__all__ = ["S3DatasetLoader", "get_s3_dataset_path", "load_dataset_from_s3"]

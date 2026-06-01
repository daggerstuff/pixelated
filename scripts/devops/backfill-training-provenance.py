#!/usr/bin/env python3
"""Backfill provenance onto existing JSONL training records.

The backfill is intentionally conservative:
- records that already have provenance are left unchanged;
- each JSONL file is rewritten atomically only when at least one record changes;
- malformed JSON aborts with a file:line error instead of dropping data.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
AI_ROOT = PROJECT_ROOT / "ai"
for import_path in (PROJECT_ROOT, AI_ROOT):
    if str(import_path) not in sys.path:
        sys.path.insert(0, str(import_path))

try:
    from ai.training.provenance import ProvenanceOptions, attach_provenance, build_provenance
except ModuleNotFoundError:
    from training.provenance import ProvenanceOptions, attach_provenance, build_provenance


@dataclass(frozen=True)
class BackfillStats:
    files_scanned: int = 0
    files_changed: int = 0
    records_scanned: int = 0
    records_changed: int = 0
    records_with_provenance: int = 0

    def add(self, other: BackfillStats) -> BackfillStats:
        return BackfillStats(
            files_scanned=self.files_scanned + other.files_scanned,
            files_changed=self.files_changed + other.files_changed,
            records_scanned=self.records_scanned + other.records_scanned,
            records_changed=self.records_changed + other.records_changed,
            records_with_provenance=self.records_with_provenance + other.records_with_provenance,
        )


def iter_jsonl_paths(root: Path) -> Iterable[Path]:
    """Yield JSONL files from a file or directory path."""

    if root.is_file():
        if root.suffix == ".jsonl":
            yield root
        return
    yield from sorted(root.rglob("*.jsonl"))


def _source_url(path: Path) -> str:
    return path.resolve().as_uri()


def _metadata(record: dict[str, Any], path: Path, line_number: int) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "backfill_file": str(path),
        "backfill_line": line_number,
    }
    if isinstance(record.get("source_channel"), str):
        metadata["channel"] = record["source_channel"]
    if isinstance(record.get("language"), str):
        metadata["language"] = record["language"]
    return metadata


def _backfill_record(
    record: dict[str, Any],
    *,
    path: Path,
    line_number: int,
    source_type: str,
    acquired_at: str | None,
) -> tuple[dict[str, Any], bool]:
    if isinstance(record.get("provenance"), dict):
        return record, False

    provenance = build_provenance(
        _source_url(path),
        source_type,
        acquired_at=acquired_at,
        options=ProvenanceOptions(
            license_id="NOASSERTION",
            transformations=("legacy_jsonl_backfill",),
        ),
        metadata=_metadata(record, path, line_number),
    )
    return attach_provenance(record, provenance), True


def backfill_file(
    path: Path,
    *,
    source_type: str,
    acquired_at: str | None = None,
    dry_run: bool = False,
) -> BackfillStats:
    """Backfill one JSONL file and return stats."""

    records: list[dict[str, Any]] = []
    changed = 0
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON in {path}:{line_number}: {exc}") from exc
            if not isinstance(record, dict):
                raise ValueError(f"Expected JSON object in {path}:{line_number}")
            enriched, was_changed = _backfill_record(
                record,
                path=path,
                line_number=line_number,
                source_type=source_type,
                acquired_at=acquired_at,
            )
            records.append(enriched)
            changed += int(was_changed)

    if changed and not dry_run:
        _write_jsonl_atomic(path, records)

    return BackfillStats(
        files_scanned=1,
        files_changed=int(changed > 0),
        records_scanned=len(records),
        records_changed=changed,
        records_with_provenance=len(records) - changed,
    )


def _write_jsonl_atomic(path: Path, records: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            for record in records:
                handle.write(json.dumps(record, sort_keys=True) + "\n")
        Path(tmp_name).replace(path)
    except Exception:
        Path(tmp_name).unlink(missing_ok=True)
        raise


def backfill_path(
    root: Path,
    *,
    source_type: str,
    acquired_at: str | None = None,
    dry_run: bool = False,
) -> BackfillStats:
    """Backfill all JSONL files below *root*."""

    total = BackfillStats()
    for path in iter_jsonl_paths(root):
        total = total.add(
            backfill_file(path, source_type=source_type, acquired_at=acquired_at, dry_run=dry_run)
        )
    return total


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Backfill provenance onto JSONL training records.")
    parser.add_argument("path", type=Path, help="JSONL file or directory to scan recursively.")
    parser.add_argument("--source-type", default="youtube", help="Value for provenance.source_type.")
    parser.add_argument("--acquired-at", default=None, help="Stable acquired_at timestamp for the backfill.")
    parser.add_argument("--dry-run", action="store_true", help="Report stats without modifying files.")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    try:
        stats = backfill_path(
            args.path,
            source_type=args.source_type,
            acquired_at=args.acquired_at,
            dry_run=args.dry_run,
        )
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    sys.stdout.write(json.dumps(stats.__dict__, sort_keys=True) + "\n")


if __name__ == "__main__":
    main()

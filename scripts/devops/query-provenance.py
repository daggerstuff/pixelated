#!/usr/bin/env python3
"""Query provenance fields from JSONL training records."""

from __future__ import annotations

import argparse
import json
import signal
import sys
from collections.abc import Iterable
from pathlib import Path
from typing import Any

if hasattr(signal, "SIGPIPE"):
    signal.signal(signal.SIGPIPE, signal.SIG_DFL)


def _iter_jsonl_paths(root: Path) -> Iterable[Path]:
    if root.is_file():
        if root.suffix == ".jsonl":
            yield root
        return
    yield from sorted(root.rglob("*.jsonl"))


def _matches(record: dict[str, Any], *, source_type: str | None, license_id: str | None) -> bool:
    provenance = record.get("provenance")
    if not isinstance(provenance, dict):
        return False
    return not (
        (source_type and provenance.get("source_type") != source_type)
        or (license_id and provenance.get("license") != license_id)
    )


def query_records(root: Path, *, source_type: str | None = None, license_id: str | None = None) -> list[dict[str, Any]]:
    """Return JSONL records whose provenance matches the requested filters."""

    matches: list[dict[str, Any]] = []
    for path in _iter_jsonl_paths(root):
        with path.open(encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, start=1):
                if not line.strip():
                    continue
                try:
                    record = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise ValueError(f"Invalid JSON in {path}:{line_number}: {exc}") from exc
                if isinstance(record, dict) and _matches(record, source_type=source_type, license_id=license_id):
                    enriched = dict(record)
                    enriched["_path"] = str(path)
                    enriched["_line"] = line_number
                    matches.append(enriched)
    return matches


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Query training-data provenance JSONL records.")
    parser.add_argument("path", type=Path, help="JSONL file or directory to scan recursively.")
    parser.add_argument("--source-type", default=None, help="Filter by provenance.source_type.")
    parser.add_argument("--license", dest="license_id", default=None, help="Filter by provenance.license.")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    try:
        for record in query_records(args.path, source_type=args.source_type, license_id=args.license_id):
            sys.stdout.write(json.dumps(record, sort_keys=True) + "\n")
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc


if __name__ == "__main__":
    main()

"""Load and resolve source-analysis records while preserving provenance."""

from __future__ import annotations

import re
from collections.abc import Iterable
from pathlib import Path

from scripts.data.designer.schemas import SourceAnalysisRecord
from scripts.data.designer.validators import validate_source_record


def normalize_alias(value: str) -> str:
    """Normalize a source name or alias for deterministic lookup."""

    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def _merge_unique[T](left: Iterable[T], right: Iterable[T]) -> list[T]:
    merged: list[T] = []
    for item in (*left, *right):
        if item not in merged:
            merged.append(item)
    return merged


def collapse_aliases(records: Iterable[SourceAnalysisRecord]) -> list[SourceAnalysisRecord]:
    """Merge repeated records for one source and reject cross-source alias collisions."""

    merged: dict[str, SourceAnalysisRecord] = {}
    for record in records:
        current = merged.get(record.source_id)
        if current is None:
            merged[record.source_id] = record
            continue
        stable_fields = (
            "registry_version",
            "canonical_name",
            "schema_and_modality",
            "content_scope",
            "unit_definition",
            "direct_use_approved",
        )
        for field in stable_fields:
            if getattr(current, field) != getattr(record, field):
                raise ValueError(f"conflicting {field} for {record.source_id}")
        if current.inspection_coverage != record.inspection_coverage:
            raise ValueError(f"conflicting inspection coverage for {record.source_id}")
        merged[record.source_id] = current.model_copy(
            update={
                "aliases": _merge_unique(current.aliases, record.aliases),
                "locations": _merge_unique(current.locations, record.locations),
                "license_and_use_policy": _merge_unique(
                    current.license_and_use_policy, record.license_and_use_policy
                ),
                "selected_information": _merge_unique(current.selected_information, record.selected_information),
                "target_products": _merge_unique(current.target_products, record.target_products),
                "related_tasks": _merge_unique(current.related_tasks, record.related_tasks),
                "related_linear_issues": _merge_unique(
                    current.related_linear_issues, record.related_linear_issues
                ),
            }
        )

    alias_owners: dict[str, str] = {}
    for record in merged.values():
        for alias in (record.source_id, record.canonical_name, *record.aliases):
            key = normalize_alias(alias)
            owner = alias_owners.setdefault(key, record.source_id)
            if owner != record.source_id:
                raise ValueError(f"alias {alias!r} is shared by {owner} and {record.source_id}")
    return sorted(merged.values(), key=lambda record: record.source_id)


class SourceRegistry:
    """Validated source-analysis registry with alias-aware resolution."""

    def __init__(self, records: Iterable[SourceAnalysisRecord]) -> None:
        self.records = collapse_aliases(records)
        self._index: dict[str, SourceAnalysisRecord] = {}
        for record in self.records:
            validate_source_record(record)
            for alias in (record.source_id, record.canonical_name, *record.aliases):
                self._index[normalize_alias(alias)] = record

    def resolve(self, alias: str) -> SourceAnalysisRecord:
        key = normalize_alias(alias)
        try:
            return self._index[key]
        except KeyError as error:
            raise KeyError(f"unknown source alias: {alias}") from error

    @classmethod
    def load_jsonl(cls, path: str | Path) -> SourceRegistry:
        records: list[SourceAnalysisRecord] = []
        with Path(path).open(encoding="utf-8") as source_file:
            for line_number, line in enumerate(source_file, start=1):
                if not line.strip():
                    continue
                try:
                    records.append(SourceAnalysisRecord.model_validate_json(line))
                except ValueError as error:
                    raise ValueError(f"invalid source registry record at line {line_number}: {error}") from error
        return cls(records)

    def write_jsonl(self, path: str | Path) -> None:
        destination = Path(path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("w", encoding="utf-8") as output_file:
            for record in self.records:
                output_file.write(record.model_dump_json() + "\n")

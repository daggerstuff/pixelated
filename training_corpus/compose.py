"""Verify that a target corpus package is the union of two component packages."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class PackageEntrySnapshot:
    root: Path
    manifest: dict[str, Any]
    reproducibility_report: dict[str, Any]
    entries_by_id: dict[str, dict[str, Any]]

    @property
    def name(self) -> str:
        return str(self.manifest.get("name") or self.root.name)

    @property
    def version(self) -> str:
        return str(self.manifest.get("version") or "unknown")


def load_package_entry_snapshot(root: Path) -> PackageEntrySnapshot:
    manifest = _read_json(root / "manifest.json")
    reproducibility_report = _read_json(root / "reproducibility_report.json")
    entries_by_id = {
        entry_id: entry
        for entry in _read_jsonl(root / "corpus.jsonl")
        for entry_id in (str(entry.get("entry_id") or ""),)
        if entry_id
    }
    return PackageEntrySnapshot(
        root=root,
        manifest=manifest,
        reproducibility_report=reproducibility_report,
        entries_by_id=entries_by_id,
    )


def verify_package_composition(
    base: PackageEntrySnapshot,
    overlay: PackageEntrySnapshot,
    target: PackageEntrySnapshot,
) -> dict[str, Any]:
    base_ids = set(base.entries_by_id)
    overlay_ids = set(overlay.entries_by_id)
    target_ids = set(target.entries_by_id)

    overlap_ids = sorted(base_ids & overlay_ids)
    expected_ids = base_ids | overlay_ids
    missing_from_target = sorted(expected_ids - target_ids)
    unexpected_in_target = sorted(target_ids - expected_ids)

    return {
        "base": _package_header(base),
        "overlay": _package_header(overlay),
        "target": _package_header(target),
        "entry_sets": {
            "base": len(base_ids),
            "overlay": len(overlay_ids),
            "base_overlay_overlap": len(overlap_ids),
            "expected_union": len(expected_ids),
            "target": len(target_ids),
            "missing_from_target": len(missing_from_target),
            "unexpected_in_target": len(unexpected_in_target),
        },
        "exact_entry_match": not missing_from_target and not unexpected_in_target,
        "overlap_sources": _counter_for_ids(overlap_ids, base.entries_by_id),
        "missing_from_target": {
            "by_source": _counter_for_ids(missing_from_target, base.entries_by_id, overlay.entries_by_id),
            "by_lane": _counter_for_lane(missing_from_target, base.entries_by_id, overlay.entries_by_id),
            "sample_entry_ids": missing_from_target[:10],
        },
        "unexpected_in_target": {
            "by_source": _counter_for_ids(unexpected_in_target, target.entries_by_id),
            "by_lane": _counter_for_lane(unexpected_in_target, target.entries_by_id),
            "sample_entry_ids": unexpected_in_target[:10],
        },
        "reproducibility": {
            "base_verified": bool(base.reproducibility_report.get("verified")),
            "overlay_verified": bool(overlay.reproducibility_report.get("verified")),
            "target_verified": bool(target.reproducibility_report.get("verified")),
        },
    }


def write_package_composition_report(
    base_root: Path,
    overlay_root: Path,
    target_root: Path,
    output_dir: Path,
) -> dict[str, Any]:
    composition = verify_package_composition(
        load_package_entry_snapshot(base_root),
        load_package_entry_snapshot(overlay_root),
        load_package_entry_snapshot(target_root),
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "package_composition.json").write_text(
        f"{json.dumps(composition, indent=2)}\n",
        encoding="utf-8",
    )
    (output_dir / "package_composition.md").write_text(
        _composition_markdown(composition),
        encoding="utf-8",
    )
    return composition


def _read_json(path: Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError(f"Expected JSON object at {path}")
    return payload


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped:
                continue
            payload = json.loads(stripped)
            if isinstance(payload, dict):
                rows.append(payload)
    return rows


def _package_header(snapshot: PackageEntrySnapshot) -> dict[str, Any]:
    return {
        "name": snapshot.name,
        "version": snapshot.version,
        "root": str(snapshot.root),
    }


def _counter_for_ids(entry_ids: list[str], *maps: dict[str, dict[str, Any]]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for entry_id in entry_ids:
        entry = _lookup_entry(entry_id, maps)
        source_id = str(entry.get("source_id") or "unknown")
        counts[source_id] += 1
    return dict(counts)


def _counter_for_lane(entry_ids: list[str], *maps: dict[str, dict[str, Any]]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for entry_id in entry_ids:
        entry = _lookup_entry(entry_id, maps)
        lane = str(entry.get("lane") or "unknown")
        counts[lane] += 1
    return dict(counts)


def _lookup_entry(entry_id: str, maps: tuple[dict[str, dict[str, Any]], ...]) -> dict[str, Any]:
    for mapping in maps:
        entry = mapping.get(entry_id)
        if entry is not None:
            return entry
    return {}


def _composition_markdown(composition: dict[str, Any]) -> str:
    lines = [
        "# Training Corpus Package Composition",
        "",
        f"- Base: {composition['base']['name']} ({composition['base']['version']})",
        f"- Overlay: {composition['overlay']['name']} ({composition['overlay']['version']})",
        f"- Target: {composition['target']['name']} ({composition['target']['version']})",
        "",
        "## Entry Sets",
        f"- Base: {composition['entry_sets']['base']}",
        f"- Overlay: {composition['entry_sets']['overlay']}",
        f"- Base/Overlay overlap: {composition['entry_sets']['base_overlay_overlap']}",
        f"- Expected union: {composition['entry_sets']['expected_union']}",
        f"- Target: {composition['entry_sets']['target']}",
        f"- Missing from target: {composition['entry_sets']['missing_from_target']}",
        f"- Unexpected in target: {composition['entry_sets']['unexpected_in_target']}",
        f"- Exact entry match: {composition['exact_entry_match']}",
        "",
        "## Reproducibility",
        f"- Base verified: {composition['reproducibility']['base_verified']}",
        f"- Overlay verified: {composition['reproducibility']['overlay_verified']}",
        f"- Target verified: {composition['reproducibility']['target_verified']}",
    ]
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base_root", type=Path)
    parser.add_argument("overlay_root", type=Path)
    parser.add_argument("target_root", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    write_package_composition_report(
        args.base_root,
        args.overlay_root,
        args.target_root,
        args.output_dir,
    )


if __name__ == "__main__":
    main()

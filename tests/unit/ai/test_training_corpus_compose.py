from __future__ import annotations

import json
from pathlib import Path

from ai.training_corpus.compose import (
    load_package_entry_snapshot,
    verify_package_composition,
    write_package_composition_report,
)


def _write_package(
    root: Path,
    *,
    name: str,
    version: str,
    entries: list[dict[str, object]],
    verified: bool = True,
) -> None:
    root.mkdir(parents=True, exist_ok=True)
    by_lane: dict[str, int] = {}
    by_corpus: dict[str, int] = {}
    for entry in entries:
        lane = str(entry["lane"])
        source_id = str(entry["source_id"])
        by_lane[lane] = by_lane.get(lane, 0) + 1
        by_corpus[source_id] = by_corpus.get(source_id, 0) + 1

    (root / "manifest.json").write_text(
        json.dumps(
            {
                "name": name,
                "version": version,
                "total_entries": len(entries),
                "by_lane": by_lane,
                "by_corpus": by_corpus,
            }
        ),
        encoding="utf-8",
    )
    (root / "reproducibility_report.json").write_text(
        json.dumps({"verified": verified}),
        encoding="utf-8",
    )
    (root / "corpus.jsonl").write_text(
        "\n".join(json.dumps(entry) for entry in entries) + "\n",
        encoding="utf-8",
    )


def test_verify_package_composition_reports_exact_match(tmp_path: Path) -> None:
    base_root = tmp_path / "base"
    overlay_root = tmp_path / "overlay"
    target_root = tmp_path / "target"
    base_entries = [
        {"entry_id": "a", "source_id": "base.one", "lane": "simulation"},
        {"entry_id": "b", "source_id": "base.two", "lane": "benchmark"},
    ]
    overlay_entries = [
        {"entry_id": "c", "source_id": "overlay.one", "lane": "evaluator"},
    ]
    target_entries = [*base_entries, *overlay_entries]

    _write_package(base_root, name="base", version="v1", entries=base_entries)
    _write_package(overlay_root, name="overlay", version="v1", entries=overlay_entries)
    _write_package(target_root, name="target", version="v1", entries=target_entries)

    composition = verify_package_composition(
        load_package_entry_snapshot(base_root),
        load_package_entry_snapshot(overlay_root),
        load_package_entry_snapshot(target_root),
    )

    assert composition["exact_entry_match"] is True
    assert composition["entry_sets"]["expected_union"] == 3
    assert composition["entry_sets"]["base_overlay_overlap"] == 0
    assert composition["missing_from_target"]["by_source"] == {}
    assert composition["unexpected_in_target"]["by_source"] == {}


def test_write_package_composition_report_captures_missing_and_unexpected_entries(tmp_path: Path) -> None:
    base_root = tmp_path / "base"
    overlay_root = tmp_path / "overlay"
    target_root = tmp_path / "target"
    output_root = tmp_path / "report"
    _write_package(
        base_root,
        name="base",
        version="v1",
        entries=[{"entry_id": "a", "source_id": "base.one", "lane": "simulation"}],
    )
    _write_package(
        overlay_root,
        name="overlay",
        version="v1",
        entries=[{"entry_id": "b", "source_id": "overlay.one", "lane": "benchmark"}],
    )
    _write_package(
        target_root,
        name="target",
        version="v1",
        entries=[{"entry_id": "c", "source_id": "target.one", "lane": "policy"}],
    )

    composition = write_package_composition_report(base_root, overlay_root, target_root, output_root)

    assert composition["exact_entry_match"] is False
    assert composition["missing_from_target"]["by_source"] == {
        "base.one": 1,
        "overlay.one": 1,
    }
    assert composition["unexpected_in_target"]["by_source"] == {"target.one": 1}
    assert (output_root / "package_composition.json").exists()
    assert (output_root / "package_composition.md").exists()

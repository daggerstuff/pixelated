"""Rubric normalization for evaluator and benchmark corpus lanes."""

from __future__ import annotations

from typing import Any

from .model import CorpusLane


def _metadata(raw: dict[str, Any]) -> dict[str, Any]:
    metadata = raw.get("metadata")
    if not isinstance(metadata, dict):
        return {}
    return metadata


def _nested_rubric_items(container: Any) -> list[Any] | None:
    if not isinstance(container, dict):
        return None
    nested_items = container.get("items")
    return nested_items if isinstance(nested_items, list) else None


def _resolve_rubric_candidates(raw: dict[str, Any], metadata: dict[str, Any]) -> list[Any]:
    direct_candidates = (
        metadata.get("rubric_items"),
        raw.get("rubric_items"),
        metadata.get("criteria"),
        raw.get("criteria"),
        _nested_rubric_items(metadata.get("rubric")),
        _nested_rubric_items(raw.get("rubric")),
    )
    for candidate in direct_candidates:
        if isinstance(candidate, list):
            return candidate

    benchmark_spec = metadata.get("benchmark_spec")
    if not isinstance(benchmark_spec, dict):
        benchmark_spec = raw.get("benchmark_spec")
    if isinstance(benchmark_spec, dict):
        nested_items = benchmark_spec.get("rubric_items")
        if isinstance(nested_items, list):
            return nested_items
    return []


def _normalize_rubric_item(item: Any, lane: CorpusLane, index: int) -> dict[str, Any] | None:
    if isinstance(item, str):
        name = item.strip()
        if not name:
            return None
        return {
            "criterion_id": f"{lane}-{index + 1}",
            "name": name,
            "weight": 1.0,
            "required": True,
            "notes": "",
        }

    if not isinstance(item, dict):
        return None

    name = item.get("name") or item.get("criterion") or item.get("label")
    if not isinstance(name, str) or not name.strip():
        return None
    weight = item.get("weight", 1.0)
    return {
        "criterion_id": str(item.get("criterion_id") or f"{lane}-{index + 1}"),
        "name": name.strip(),
        "weight": weight if isinstance(weight, (int, float)) else 1.0,
        "required": bool(item.get("required", True)),
        "notes": str(item.get("notes") or "").strip(),
    }


def normalize_rubric_items(raw: dict[str, Any], lane: CorpusLane) -> list[dict[str, Any]]:
    metadata = _metadata(raw)

    if lane not in {"evaluator", "benchmark"}:
        return []

    candidates = _resolve_rubric_candidates(raw, metadata)
    normalized: list[dict[str, Any]] = []
    for index, item in enumerate(candidates):
        normalized_item = _normalize_rubric_item(item, lane, index)
        if normalized_item is not None:
            normalized.append(normalized_item)
    return normalized


def normalize_clinician_review(raw: dict[str, Any], lane: CorpusLane) -> dict[str, Any] | None:
    if lane not in {"evaluator", "benchmark"}:
        return None

    metadata = _metadata(raw)
    rubric_items = normalize_rubric_items(raw, lane)
    candidate = metadata.get("clinician_review")

    if isinstance(candidate, dict):
        status = str(candidate.get("status") or metadata.get("clinician_review_status") or "unreviewed")
        reviewer_role = str(candidate.get("reviewer_role") or "clinician")
        reviewer_count = candidate.get("reviewer_count", metadata.get("clinician_reviewer_count", 0))
        calibration_subset = bool(
            candidate.get("calibration_subset", metadata.get("calibration_subset", lane == "benchmark"))
        )
        return {
            "required": bool(candidate.get("required", True)),
            "status": status,
            "reviewer_role": reviewer_role,
            "reviewer_count": reviewer_count if isinstance(reviewer_count, int) else 0,
            "calibration_subset": calibration_subset,
            "notes": str(candidate.get("notes") or metadata.get("clinician_review_notes") or "").strip(),
        }

    if not rubric_items and not bool(metadata.get("clinician_review_required")):
        return None

    return {
        "required": True,
        "status": str(metadata.get("clinician_review_status") or "unreviewed"),
        "reviewer_role": str(metadata.get("clinician_reviewer_role") or "clinician"),
        "reviewer_count": int(metadata.get("clinician_reviewer_count") or 0),
        "calibration_subset": bool(metadata.get("calibration_subset", lane == "benchmark")),
        "notes": str(metadata.get("clinician_review_notes") or "").strip(),
    }

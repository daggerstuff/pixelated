"""Duplicate and leakage controls for the fresh training corpus builder."""

from __future__ import annotations

import hashlib
import re
from collections import Counter, defaultdict

from .model import CorpusEntry

_STAGE_PRIORITY = {
    "stage1_foundation": 1,
    "stage2_specialist": 2,
    "stage2_therapeutic_expertise": 2,
    "stage3_edge_stress_test": 3,
    "stage4_voice": 4,
    "stage4_voice_persona": 4,
}

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def content_hash(prompt: str, response: str) -> str:
    digest = hashlib.sha256()
    digest.update(prompt.encode("utf-8"))
    digest.update(b"\0")
    digest.update(response.encode("utf-8"))
    return digest.hexdigest()


def near_duplicate_hash(prompt: str, response: str) -> str:
    digest = hashlib.sha256()
    digest.update(_canonicalize(prompt).encode("utf-8"))
    digest.update(b"\0")
    digest.update(_canonicalize(response).encode("utf-8"))
    return digest.hexdigest()


def _canonicalize(value: str) -> str:
    return " ".join(_TOKEN_RE.findall(value.lower()))


def stage_priority(stage: str) -> int:
    return _STAGE_PRIORITY.get(stage, 0)


def choose_preferred_entry(current: CorpusEntry, candidate: CorpusEntry) -> CorpusEntry:
    current_priority = stage_priority(current.stage)
    candidate_priority = stage_priority(candidate.stage)
    if candidate_priority > current_priority:
        return candidate
    if candidate_priority < current_priority:
        return current
    if candidate.source_id < current.source_id:
        return candidate
    return current


def deduplicate_near_duplicates(
    entries: tuple[CorpusEntry, ...],
) -> tuple[tuple[CorpusEntry, ...], dict[str, object]]:
    by_near_hash: dict[str, CorpusEntry] = {}
    collision_rows: list[dict[str, object]] = []
    near_duplicate_events = 0
    near_duplicate_replacements = 0

    for entry in entries:
        near_hash = str(entry.attributes.get("near_duplicate_hash") or "")
        if not near_hash:
            by_near_hash[entry.entry_id] = entry
            continue

        existing = by_near_hash.get(near_hash)
        if existing is None:
            by_near_hash[near_hash] = entry
            continue

        near_duplicate_events += 1
        preferred = choose_preferred_entry(existing, entry)
        if preferred is not existing:
            by_near_hash[near_hash] = preferred
            near_duplicate_replacements += 1
        collision_rows.append(
            {
                "near_duplicate_hash": near_hash,
                "source_ids": sorted({existing.source_id, entry.source_id}),
                "entry_ids": sorted({existing.entry_id, entry.entry_id}),
                "stages": sorted({existing.stage, entry.stage}),
            }
        )

    return tuple(sorted(by_near_hash.values(), key=lambda entry: entry.entry_id)), {
        "near_duplicate_events": near_duplicate_events,
        "near_duplicate_replacements": near_duplicate_replacements,
        "near_duplicate_cluster_count": len(collision_rows),
        "near_duplicate_clusters": collision_rows,
    }


def build_continuity_report(entries: tuple[CorpusEntry, ...]) -> dict[str, object]:
    relevant_entries: list[CorpusEntry] = []
    issues: list[dict[str, object]] = []
    by_continuity_id: dict[str, list[CorpusEntry]] = defaultdict(list)

    for entry in entries:
        benchmark_slice = entry.attributes.get("benchmark_slice")
        is_long_running = bool(
            entry.attributes.get("long_running") or benchmark_slice == "benchmark_long_running_continuity"
        )
        if not is_long_running:
            continue

        relevant_entries.append(entry)
        continuity_id = entry.attributes.get("continuity_id")
        persona_anchor = (
            entry.attributes.get("persona_id")
            or entry.attributes.get("persona_archetype")
            or entry.attributes.get("persona_texture")
        )
        turn_count = entry.attributes.get("turn_count")

        entry_issues: list[str] = []
        if not isinstance(continuity_id, str) or not continuity_id.strip():
            entry_issues.append("missing_continuity_id")
        else:
            by_continuity_id[continuity_id].append(entry)
        if not isinstance(persona_anchor, str) or not persona_anchor.strip():
            entry_issues.append("missing_persona_anchor")
        if not isinstance(turn_count, int) or turn_count < 10:
            entry_issues.append("insufficient_turn_count")

        if entry_issues:
            issues.append(
                {
                    "entry_id": entry.entry_id,
                    "source_id": entry.source_id,
                    "issues": entry_issues,
                }
            )

    for continuity_id, grouped_entries in by_continuity_id.items():
        persona_anchors = {
            str(
                entry.attributes.get("persona_id")
                or entry.attributes.get("persona_archetype")
                or entry.attributes.get("persona_texture")
                or ""
            )
            for entry in grouped_entries
        }
        persona_anchors.discard("")
        if len(persona_anchors) > 1:
            issues.append(
                {
                    "continuity_id": continuity_id,
                    "issues": ["inconsistent_persona_anchor"],
                    "source_ids": [entry.source_id for entry in grouped_entries],
                }
            )

    return {
        "long_running_entry_count": len(relevant_entries),
        "continuity_issue_count": len(issues),
        "passed": len(issues) == 0,
        "issues": issues,
    }


def build_leakage_report(
    entries: tuple[CorpusEntry, ...],
    *,
    duplicate_events: int,
    replaced_events: int,
    near_duplicate_report: dict[str, object],
) -> dict[str, object]:
    by_content_hash: dict[str, list[CorpusEntry]] = defaultdict(list)
    for entry in entries:
        content_id = str(entry.attributes.get("content_hash", ""))
        by_content_hash[content_id].append(entry)

    split_collisions: list[dict[str, object]] = []
    for content_id, grouped_entries in by_content_hash.items():
        split_counts = Counter(entry.split for entry in grouped_entries)
        if len(split_counts) > 1:
            split_collisions.append(
                {
                    "content_hash": content_id,
                    "splits": dict(split_counts),
                    "source_ids": [entry.source_id for entry in grouped_entries],
                }
            )

    return {
        "total_entries": len(entries),
        "duplicate_events": duplicate_events,
        "replaced_events": replaced_events,
        "near_duplicate_events": near_duplicate_report["near_duplicate_events"],
        "near_duplicate_replacements": near_duplicate_report["near_duplicate_replacements"],
        "near_duplicate_cluster_count": near_duplicate_report["near_duplicate_cluster_count"],
        "near_duplicate_clusters": near_duplicate_report["near_duplicate_clusters"],
        "distinct_content_hashes": len(by_content_hash),
        "split_collisions": split_collisions,
        "split_collision_count": len(split_collisions),
        "zero_train_eval_leakage": len(split_collisions) == 0,
    }

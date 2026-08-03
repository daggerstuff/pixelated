"""Expansion-queue helpers for source-to-synthesis corpus construction."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from .model import CorpusLane
from .synthesis import build_synthesis_attributes

type ExpansionPriority = Literal["P0", "P1", "P2", "P3"]
type ExpansionStatus = Literal["ready_for_authoring", "deferred", "blocked"]

DEFAULT_WAVE5_EXPANSION_QUEUE_PATH = Path(__file__).resolve().parent / "assets" / "wave5_expansion_queue.json"
DEFAULT_WAVE5_EXPANSION_DRAFT_LEDGER_PATH = (
    Path(__file__).resolve().parent / "assets" / "wave5_expansion_draft_ledger.json"
)
DEFAULT_WAVE5_AUTHORING_PACKETS_PATH = (
    Path(__file__).resolve().parent / "assets" / "wave5_expansion_authoring_packets.jsonl"
)
DEFAULT_WAVE5_AUTHORING_MANIFEST_PATH = (
    Path(__file__).resolve().parent / "assets" / "wave5_expansion_authoring_manifest.json"
)

_PRIORITY_ORDER: dict[ExpansionPriority, int] = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}
_VALID_STATUSES: set[ExpansionStatus] = {"ready_for_authoring", "deferred", "blocked"}
_DEFAULT_BATCH_SIZE = 12


@dataclass(frozen=True)
class ExpansionQueueItem:
    queue_id: str
    source_id: str
    source_class: str
    priority: ExpansionPriority
    status: ExpansionStatus
    target_outputs: dict[str, int]
    recommended_batch_size: int
    extraction_fields: tuple[str, ...] = field(default_factory=tuple)
    authoring_focus: tuple[str, ...] = field(default_factory=tuple)
    discard_rules: tuple[str, ...] = field(default_factory=tuple)
    source_evidence: dict[str, Any] = field(default_factory=dict)
    notes: tuple[str, ...] = field(default_factory=tuple)

    @property
    def total_row_budget(self) -> int:
        return sum(self.target_outputs.values())


@dataclass(frozen=True)
class ExpansionCandidateArtifacts:
    scenario_archetype: dict[str, Any] | None = None
    client_state_profile: dict[str, Any] | None = None
    therapist_moves: tuple[dict[str, Any], ...] = field(default_factory=tuple)
    benchmark_spec: dict[str, Any] | None = None


@dataclass(frozen=True)
class ExpansionCandidateContext:
    prompt: str
    response: str
    source_excerpt: str | None = None
    source_fields_mined: tuple[str, ...] = field(default_factory=tuple)
    synthesis_method: str = "reverse_engineered_from_source"


@dataclass(frozen=True)
class ExpansionDraftContext:
    lane: CorpusLane
    kind: str
    status: str
    source_excerpt: str | None = None
    review_notes: tuple[str, ...] = field(default_factory=tuple)


def _require_non_empty_string(value: Any, *, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Expansion queue field '{field_name}' must be a non-empty string.")
    return value.strip()


def _normalize_string_list(value: Any) -> tuple[str, ...]:
    if not isinstance(value, list):
        return ()
    return tuple(item.strip() for item in value if isinstance(item, str) and item.strip())


def _normalize_target_outputs(value: Any) -> dict[str, int]:
    if not isinstance(value, dict):
        raise ValueError("Expansion queue field 'target_outputs' must be an object.")

    normalized: dict[str, int] = {}
    for key, raw_count in value.items():
        name = _require_non_empty_string(key, field_name="target_outputs key")
        if not isinstance(raw_count, int) or raw_count < 0:
            raise ValueError("Expansion queue target output counts must be non-negative integers.")
        if raw_count > 0:
            normalized[name] = raw_count

    if not normalized:
        raise ValueError("Expansion queue item must declare at least one positive target output.")
    return normalized


def _normalize_batch_size(value: Any) -> int:
    if value is None:
        return _DEFAULT_BATCH_SIZE
    if not isinstance(value, int) or value <= 0:
        raise ValueError("Expansion queue field 'recommended_batch_size' must be a positive integer.")
    return value


def _clone_json(value: Any) -> Any:
    return json.loads(json.dumps(value))


def load_expansion_queue(path: Path) -> tuple[ExpansionQueueItem, ...]:
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)

    if not isinstance(payload, list):
        raise ValueError(f"Expansion queue must be a JSON list: {path}")

    items: list[ExpansionQueueItem] = []
    for raw_item in payload:
        if not isinstance(raw_item, dict):
            raise ValueError(f"Expansion queue entries must be objects: {path}")

        priority = _require_non_empty_string(raw_item.get("priority"), field_name="priority")
        status = _require_non_empty_string(raw_item.get("status"), field_name="status")
        if priority not in _PRIORITY_ORDER:
            raise ValueError(f"Unsupported expansion priority: {priority}")
        if status not in _VALID_STATUSES:
            raise ValueError(f"Unsupported expansion status: {status}")

        items.append(
            ExpansionQueueItem(
                queue_id=_require_non_empty_string(raw_item.get("queue_id"), field_name="queue_id"),
                source_id=_require_non_empty_string(raw_item.get("source_id"), field_name="source_id"),
                source_class=_require_non_empty_string(raw_item.get("source_class"), field_name="source_class"),
                priority=priority,  # type: ignore[arg-type]
                status=status,  # type: ignore[arg-type]
                target_outputs=_normalize_target_outputs(raw_item.get("target_outputs")),
                recommended_batch_size=_normalize_batch_size(raw_item.get("recommended_batch_size")),
                extraction_fields=_normalize_string_list(raw_item.get("extraction_fields")),
                authoring_focus=_normalize_string_list(raw_item.get("authoring_focus")),
                discard_rules=_normalize_string_list(raw_item.get("discard_rules")),
                source_evidence=raw_item.get("source_evidence")
                if isinstance(raw_item.get("source_evidence"), dict)
                else {},
                notes=_normalize_string_list(raw_item.get("notes")),
            )
        )

    return tuple(items)


def build_expansion_authoring_packets(
    queue: Iterable[ExpansionQueueItem],
    *,
    include_statuses: tuple[ExpansionStatus, ...] = ("ready_for_authoring",),
) -> tuple[dict[str, Any], ...]:
    packets: list[dict[str, Any]] = []
    allowed_statuses = set(include_statuses)

    for item in queue:
        if item.status not in allowed_statuses:
            continue

        for output_name, row_budget in sorted(item.target_outputs.items()):
            remaining = row_budget
            batch_count = max(1, (row_budget + item.recommended_batch_size - 1) // item.recommended_batch_size)

            for batch_index in range(1, batch_count + 1):
                requested_rows = min(item.recommended_batch_size, remaining)
                remaining -= requested_rows
                if requested_rows <= 0:
                    continue

                packets.append(
                    {
                        "packet_id": f"{item.queue_id}:{output_name}:{batch_index:03d}",
                        "queue_id": item.queue_id,
                        "source_id": item.source_id,
                        "source_class": item.source_class,
                        "priority": item.priority,
                        "status": item.status,
                        "target_output": output_name,
                        "batch_index": batch_index,
                        "batch_count": batch_count,
                        "requested_rows": requested_rows,
                        "total_output_budget": row_budget,
                        "recommended_batch_size": item.recommended_batch_size,
                        "extraction_fields": list(item.extraction_fields),
                        "authoring_focus": list(item.authoring_focus),
                        "discard_rules": list(item.discard_rules),
                        "source_evidence": item.source_evidence,
                        "notes": list(item.notes),
                    }
                )

    return tuple(packets)


def expansion_queue_ticket_ids(queue: Iterable[ExpansionQueueItem]) -> list[str]:
    return [item.queue_id for item in queue]


def expansion_queue_lane_targets(queue: Iterable[ExpansionQueueItem]) -> dict[str, int]:
    totals: Counter[str] = Counter()
    for item in queue:
        for lane_name, count in item.target_outputs.items():
            if lane_name.endswith("_seed"):
                prefix = lane_name.split("_", 1)[0]
                lane = "benchmark" if prefix == "preference" else prefix
            else:
                lane = lane_name
            totals.update({lane: count})
    return dict(sorted(totals.items()))


def expansion_queue_priority_counts(queue: Iterable[ExpansionQueueItem]) -> dict[str, int]:
    counts: Counter[str] = Counter(item.priority for item in queue)
    return dict(sorted(counts.items(), key=lambda item: _PRIORITY_ORDER[item[0]]))


def build_expansion_candidate_record(
    *,
    queue_item: ExpansionQueueItem,
    lane: CorpusLane,
    dialogue: ExpansionCandidateContext,
    artifacts: ExpansionCandidateArtifacts | None = None,
) -> dict[str, Any]:
    artifacts = artifacts or ExpansionCandidateArtifacts()
    metadata = build_synthesis_attributes(
        scenario_archetype=artifacts.scenario_archetype,
        client_state_profile=artifacts.client_state_profile,
        therapist_moves=list(artifacts.therapist_moves),
        benchmark_spec=artifacts.benchmark_spec,
    )
    metadata["expansion_queue"] = {
        "queue_id": queue_item.queue_id,
        "priority": queue_item.priority,
        "source_id": queue_item.source_id,
        "source_class": queue_item.source_class,
    }
    metadata["synthesis_method"] = dialogue.synthesis_method
    metadata["requires_human_review"] = True
    if isinstance(dialogue.source_excerpt, str) and dialogue.source_excerpt.strip():
        metadata["source_excerpt"] = dialogue.source_excerpt.strip()
    if dialogue.source_fields_mined:
        metadata["source_fields_mined"] = [
            item for item in dialogue.source_fields_mined if isinstance(item, str) and item.strip()
        ]

    record: dict[str, Any] = {
        "lane": lane,
        "input": dialogue.prompt.strip(),
        "output": dialogue.response.strip(),
        "metadata": metadata,
    }
    if artifacts.scenario_archetype:
        record["scenario_archetype"] = _clone_json(artifacts.scenario_archetype)
    return record


def build_expansion_draft_entry(
    *,
    draft_id: str,
    queue_item: ExpansionQueueItem,
    candidate_record: dict[str, Any],
    draft: ExpansionDraftContext,
) -> dict[str, Any]:
    return {
        "draft_id": draft_id,
        "queue_id": queue_item.queue_id,
        "lane": draft.lane,
        "kind": draft.kind,
        "status": draft.status,
        "source_id": queue_item.source_id,
        "candidate_record": _clone_json(candidate_record),
        "source_excerpt": draft.source_excerpt.strip()
        if isinstance(draft.source_excerpt, str) and draft.source_excerpt.strip()
        else None,
        "review_notes": [item for item in draft.review_notes if isinstance(item, str) and item.strip()],
    }


def materialize_expansion_authoring_packets(
    queue: Iterable[ExpansionQueueItem],
    output_path: Path,
    *,
    manifest_path: Path | None = None,
    include_statuses: tuple[ExpansionStatus, ...] = ("ready_for_authoring",),
) -> dict[str, Path]:
    queue_items = tuple(queue)
    packets = build_expansion_authoring_packets(queue_items, include_statuses=include_statuses)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as handle:
        for packet in packets:
            handle.write(json.dumps(packet, ensure_ascii=False) + "\n")

    if manifest_path is not None:
        packet_rows_by_output: Counter[str] = Counter()
        packet_counts_by_output: Counter[str] = Counter()
        packet_counts_by_queue: Counter[str] = Counter()
        for packet in packets:
            packet_rows_by_output.update({packet["target_output"]: packet["requested_rows"]})
            packet_counts_by_output.update({packet["target_output"]: 1})
            packet_counts_by_queue.update({packet["queue_id"]: 1})

        manifest = {
            "queue_size": len(queue_items),
            "packet_count": len(packets),
            "total_requested_rows": sum(packet["requested_rows"] for packet in packets),
            "include_statuses": list(include_statuses),
            "by_target_output": dict(sorted(packet_rows_by_output.items())),
            "packet_count_by_target_output": dict(sorted(packet_counts_by_output.items())),
            "by_queue": {
                item.queue_id: {
                    "source_id": item.source_id,
                    "priority": item.priority,
                    "status": item.status,
                    "total_row_budget": item.total_row_budget,
                    "packet_count": packet_counts_by_queue.get(item.queue_id, 0),
                    "target_outputs": item.target_outputs,
                }
                for item in queue_items
                if item.status in include_statuses
            },
        }
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(f"{json.dumps(manifest, indent=2)}\n", encoding="utf-8")

    written = {"packets": output_path}
    if manifest_path is not None:
        written["manifest"] = manifest_path
    return written


def ensure_wave5_expansion_packets_materialized(
    *,
    queue_path: Path = DEFAULT_WAVE5_EXPANSION_QUEUE_PATH,
    output_path: Path = DEFAULT_WAVE5_AUTHORING_PACKETS_PATH,
    manifest_path: Path | None = DEFAULT_WAVE5_AUTHORING_MANIFEST_PATH,
) -> dict[str, Path]:
    queue = load_expansion_queue(queue_path)
    return materialize_expansion_authoring_packets(
        queue,
        output_path,
        manifest_path=manifest_path,
    )


def load_expansion_draft_ledger(
    path: Path = DEFAULT_WAVE5_EXPANSION_DRAFT_LEDGER_PATH,
) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError(f"Expansion draft ledger must be a JSON object: {path}")
    drafts = payload.get("drafts")
    if not isinstance(drafts, list) or not all(isinstance(item, dict) for item in drafts):
        raise ValueError(f"Expansion draft ledger must contain a drafts list: {path}")
    return payload


def write_expansion_draft_ledger(
    ledger: dict[str, Any],
    path: Path = DEFAULT_WAVE5_EXPANSION_DRAFT_LEDGER_PATH,
) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{json.dumps(ledger, indent=2)}\n", encoding="utf-8")
    return path


def expansion_draft_status_counts(ledger: dict[str, Any]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    drafts = ledger.get("drafts", [])
    if not isinstance(drafts, list):
        return {}
    for draft in drafts:
        if not isinstance(draft, dict):
            continue
        status = draft.get("status")
        if isinstance(status, str) and status.strip():
            counts.update({status.strip(): 1})
    return dict(sorted(counts.items()))


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Materialize expansion authoring packets from a queue.")
    parser.add_argument("output_path", type=Path, help="Destination JSONL path for authoring packets.")
    parser.add_argument(
        "--queue-path",
        type=Path,
        default=DEFAULT_WAVE5_EXPANSION_QUEUE_PATH,
        help="Expansion queue JSON file to load.",
    )
    parser.add_argument(
        "--manifest-path",
        type=Path,
        default=None,
        help="Optional path for the materialized authoring manifest JSON.",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    queue = load_expansion_queue(args.queue_path)
    written = materialize_expansion_authoring_packets(
        queue,
        args.output_path,
        manifest_path=args.manifest_path,
    )
    sys.stdout.write(
        json.dumps(
            {
                "queue_path": str(args.queue_path),
                "output_path": str(written["packets"]),
                "manifest_path": str(written["manifest"]) if "manifest" in written else None,
                "queue_size": len(queue),
                "total_row_budget": sum(
                    item.total_row_budget for item in queue if item.status == "ready_for_authoring"
                ),
            },
            indent=2,
        )
        + "\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

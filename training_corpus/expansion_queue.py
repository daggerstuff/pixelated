"""Draft-ledger and packet-queue helpers for source-mined corpus expansion work."""

from __future__ import annotations

import json
from argparse import ArgumentParser
from collections import Counter
from collections.abc import Iterable, Sequence
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from .model import ExpansionArtifactKind, ExpansionDraftStatus, ExpansionQueueEntry

DEFAULT_EXPANSION_SOURCE_REGISTRY_PATH = (
    Path(__file__).resolve().parent / "assets" / "wave5_expansion_source_registry.json"
)
DEFAULT_EXPANSION_QUEUE_PATH = Path(__file__).resolve().parent / "assets" / "wave5_expansion_packets.json"
DEFAULT_EXPANSION_PACKET_PATH = DEFAULT_EXPANSION_QUEUE_PATH
DEFAULT_EXPANSION_DRAFT_QUEUE_PATH = Path(__file__).resolve().parent / "assets" / "wave5_expansion_ticket_queue.json"

_QUEUE_ALLOWED_STATUSES: tuple[ExpansionDraftStatus, ...] = (
    "queued",
    "drafted",
    "reviewed",
    "promoted",
    "discarded",
)
_QUEUE_ALLOWED_KINDS: tuple[ExpansionArtifactKind, ...] = (
    "scenario",
    "state_profile",
    "therapist_move",
    "benchmark_spec",
    "preference_pair",
)
_SEED_PACK_KIND_KEYS = {
    "scenario": "scenario_archetypes",
    "state_profile": "client_state_profiles",
    "therapist_move": "therapist_move_inventory",
    "benchmark_spec": "benchmark_specs",
    "preference_pair": "preference_pairs",
}
_MODE_LANE_TARGETS = {
    "SYNTHESIS_FEEDSTOCK": ("simulation",),
    "RUBRIC_SOURCE": ("evaluator", "benchmark"),
    "BENCHMARK_SEED": ("benchmark", "evaluator"),
    "PREFERENCE_SOURCE": ("benchmark",),
    "NEGATIVE_CONTROL": ("benchmark",),
}
_MODE_DISCARD_RULES = {
    "SYNTHESIS_FEEDSTOCK": (),
    "RUBRIC_SOURCE": ("do_not_train_directly_from_reference_text",),
    "BENCHMARK_SEED": ("keep_as_holdout_or_design_seed",),
    "PREFERENCE_SOURCE": ("require_explicit_failure_rationale",),
    "NEGATIVE_CONTROL": ("do_not_mix_into_core_training",),
}
_ARTIFACT_KIND_BY_TARGET_TOKEN: tuple[tuple[str, ExpansionArtifactKind], ...] = (
    ("move", "therapist_move"),
    ("intervention", "therapist_move"),
    ("reframing", "therapist_move"),
    ("pacing", "therapist_move"),
    ("benchmark", "benchmark_spec"),
    ("rubric", "benchmark_spec"),
    ("risk", "benchmark_spec"),
    ("judge", "benchmark_spec"),
    ("state", "state_profile"),
    ("language", "state_profile"),
    ("help_seeking", "state_profile"),
    ("emotion", "state_profile"),
    ("prompt", "scenario"),
    ("scenario", "scenario"),
    ("archetype", "scenario"),
    ("session", "scenario"),
)
_PRIORITY_ORDER = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}


@dataclass(frozen=True)
class SeedPackQueueConfig:
    pack_id: str
    version: str
    source_artifacts: tuple[str, ...] = ()
    include_statuses: tuple[ExpansionDraftStatus, ...] = ("reviewed", "promoted")
    status: str = "expansion_queue_materialized"


SeedPackBuildRequest = SeedPackQueueConfig


def _clone_json(value: Any) -> Any:
    return json.loads(json.dumps(value))


def _normalize_optional_string(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _normalize_required_string(value: Any, field_name: str) -> str:
    normalized = _normalize_optional_string(value)
    if normalized is None:
        raise ValueError(f"Expansion queue entries require {field_name}.")
    return normalized


def _normalize_string_list(value: Any) -> tuple[str, ...]:
    if not isinstance(value, Sequence) or isinstance(value, str):
        return ()
    return tuple(item.strip() for item in value if isinstance(item, str) and item.strip())


def _source_constraints(source: dict[str, Any]) -> tuple[str, ...]:
    return _normalize_string_list(source.get("constraints"))


def _slugify_source_id(source_id: str) -> str:
    tail = source_id.rsplit("/", maxsplit=1)[-1]
    return tail.replace("_", "-").replace(":", "-").lower().strip("-")


def _infer_artifact_kind(extraction_target: str, mode: str) -> ExpansionArtifactKind:
    lowered = extraction_target.lower()
    for token, artifact_kind in _ARTIFACT_KIND_BY_TARGET_TOKEN:
        if token in lowered:
            return artifact_kind
    if mode == "RUBRIC_SOURCE":
        return "benchmark_spec"
    return "scenario"


def _preferred_mode(extraction_target: str, salvage_modes: tuple[str, ...]) -> str | None:
    lowered = extraction_target.lower()
    preferred_order: list[tuple[bool, str]] = [
        ("preference" in lowered, "PREFERENCE_SOURCE"),
        (any(token in lowered for token in ("benchmark", "judge", "crisis")), "BENCHMARK_SEED"),
        (any(token in lowered for token in ("rubric", "move", "dimension")), "RUBRIC_SOURCE"),
        (True, "SYNTHESIS_FEEDSTOCK"),
        (True, "RUBRIC_SOURCE"),
        (True, "BENCHMARK_SEED"),
        (True, "PREFERENCE_SOURCE"),
    ]
    for condition, mode in preferred_order:
        if condition and mode in salvage_modes:
            return mode
    return salvage_modes[0] if salvage_modes else None


def _normalize_row_targets(value: Any) -> dict[str, int]:
    if not isinstance(value, dict):
        return {}
    return {
        key: count
        for key, count in value.items()
        if isinstance(key, str) and key.strip() and isinstance(count, int) and count > 0
    }


def build_expansion_queue_entry(payload: dict[str, Any] | None = None, /, **kwargs: Any) -> ExpansionQueueEntry:
    merged = dict(payload or {})
    merged.update(kwargs)

    normalized_id = _normalize_required_string(merged.get("queue_id"), "queue_id")
    normalized_source_ref = _normalize_required_string(merged.get("source_ref"), "source_ref")
    normalized_source_family = _normalize_required_string(merged.get("source_family"), "source_family")
    normalized_target_pack = _normalize_required_string(merged.get("target_pack"), "target_pack")

    artifact_kind = merged.get("artifact_kind") or "scenario"
    if artifact_kind not in _QUEUE_ALLOWED_KINDS:
        raise ValueError(f"Unsupported expansion artifact kind: {artifact_kind}")
    draft_status = merged.get("draft_status") or "queued"
    if draft_status not in _QUEUE_ALLOWED_STATUSES:
        raise ValueError(f"Unsupported expansion draft status: {draft_status}")

    return ExpansionQueueEntry(
        queue_id=normalized_id,
        source_ref=normalized_source_ref,
        source_family=normalized_source_family,
        artifact_kind=artifact_kind,
        draft_status=draft_status,
        target_pack=normalized_target_pack,
        title=_normalize_optional_string(merged.get("title")),
        prompt_excerpt=_normalize_optional_string(merged.get("prompt_excerpt")),
        source_excerpt=_normalize_optional_string(merged.get("source_excerpt")),
        provenance_notes=_normalize_string_list(merged.get("provenance_notes")),
        governance_flags=_normalize_string_list(merged.get("governance_flags")),
        candidate_payload=_clone_json(
            merged.get("candidate_payload") if isinstance(merged.get("candidate_payload"), dict) else {}
        ),
        review_notes=_normalize_string_list(merged.get("review_notes")),
        metadata=_clone_json(merged.get("metadata") if isinstance(merged.get("metadata"), dict) else {}),
    )


def load_expansion_queue(path: Path) -> tuple[ExpansionQueueEntry, ...]:
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)

    if isinstance(payload, list):
        raw_entries = payload
    elif isinstance(payload, dict):
        raw_entries = payload.get("entries")
        if not isinstance(raw_entries, list):
            raise ValueError(f"Expansion queue payload must include an entries list: {path}")
    else:
        raise ValueError(f"Expansion queue payload must be a JSON object or list: {path}")

    entries: list[ExpansionQueueEntry] = []
    for item in raw_entries:
        if isinstance(item, dict):
            entries.append(build_expansion_queue_entry(item))
    return tuple(entries)


def save_expansion_queue(
    path: Path,
    entries: Iterable[ExpansionQueueEntry],
    *,
    pack_id: str | None = None,
    source_artifacts: Sequence[str] | None = None,
    notes: Sequence[str] | None = None,
) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "pack_id": _normalize_optional_string(pack_id),
        "source_artifacts": list(_normalize_string_list(source_artifacts)),
        "notes": list(_normalize_string_list(notes)),
        "entries": [asdict(entry) for entry in entries],
    }
    path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")
    return path


def _coerce_seed_pack_config(
    config: SeedPackQueueConfig | None = None,
    **kwargs: Any,
) -> SeedPackQueueConfig:
    if config is not None:
        if kwargs:
            unexpected_keys = ", ".join(sorted(str(key) for key in kwargs))
            raise TypeError(f"Unexpected seed-pack build arguments: {unexpected_keys}")
        return config

    pack_id = kwargs.pop("pack_id", None)
    version = kwargs.pop("version", None)
    source_artifacts = kwargs.pop("source_artifacts", ())
    include_statuses = kwargs.pop("include_statuses", ("reviewed", "promoted"))
    status = kwargs.pop("status", "expansion_queue_materialized")
    if kwargs:
        unexpected_keys = ", ".join(sorted(str(key) for key in kwargs))
        raise TypeError(f"Unsupported seed-pack build arguments: {unexpected_keys}")

    return SeedPackQueueConfig(
        pack_id=pack_id,
        version=version,
        source_artifacts=_normalize_string_list(source_artifacts),
        include_statuses=tuple(item for item in include_statuses if item in _QUEUE_ALLOWED_STATUSES)
        if isinstance(include_statuses, Sequence) and not isinstance(include_statuses, str)
        else ("reviewed", "promoted"),
        status=status if isinstance(status, str) and status.strip() else "expansion_queue_materialized",
    )


def build_seed_pack_from_queue(
    entries: Iterable[ExpansionQueueEntry],
    config: SeedPackQueueConfig | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    config = _coerce_seed_pack_config(config, **kwargs)
    normalized_pack_id = _normalize_required_string(config.pack_id, "pack_id")
    normalized_version = _normalize_required_string(config.version, "version")

    seed_pack: dict[str, Any] = {
        "pack_id": normalized_pack_id,
        "version": normalized_version,
        "status": config.status,
        "source_artifacts": list(config.source_artifacts),
        "scenario_archetypes": [],
        "client_state_profiles": [],
        "therapist_move_inventory": [],
        "benchmark_specs": [],
    }
    preference_pairs: list[dict[str, Any]] = []

    for entry in entries:
        if entry.draft_status not in config.include_statuses:
            continue
        payload = _clone_json(entry.candidate_payload)
        if not payload:
            continue
        if entry.artifact_kind == "preference_pair":
            preference_pairs.append(payload)
            continue
        key = _SEED_PACK_KIND_KEYS[entry.artifact_kind]
        if isinstance(seed_pack.get(key), list):
            seed_pack[key].append(payload)

    if preference_pairs:
        seed_pack["preference_pairs"] = preference_pairs

    return seed_pack


def build_seed_pack_from_queue_path(
    queue_path: Path,
    config: SeedPackQueueConfig | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    return build_seed_pack_from_queue(load_expansion_queue(queue_path), config, **kwargs)


def write_seed_pack_from_queue(
    queue_path: Path,
    output_path: Path,
    config: SeedPackQueueConfig | None = None,
    **kwargs: Any,
) -> Path:
    seed_pack = build_seed_pack_from_queue_path(queue_path, config, **kwargs)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(f"{json.dumps(seed_pack, indent=2)}\n", encoding="utf-8")
    return output_path


def load_expansion_source_registry(path: Path = DEFAULT_EXPANSION_SOURCE_REGISTRY_PATH) -> list[dict[str, Any]]:
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, list):
        raise ValueError(f"Expansion source registry must be a JSON list: {path}")
    return [item for item in payload if isinstance(item, dict)]


def build_expansion_packet_queue(source_registry: list[dict[str, Any]]) -> dict[str, Any]:
    packets: list[dict[str, Any]] = []
    by_priority: Counter[str] = Counter()
    by_mode: Counter[str] = Counter()
    by_lane_target: Counter[str] = Counter()
    authoring_targets_total: Counter[str] = Counter()

    for source in source_registry:
        if not bool(source.get("expansion_now")):
            continue
        source_id = _normalize_optional_string(source.get("source_id"))
        source_key = _normalize_optional_string(source.get("source_key"))
        if source_id is None or source_key is None:
            continue
        extraction_targets = _normalize_string_list(source.get("extraction_targets"))
        salvage_modes = _normalize_string_list(source.get("salvage_modes"))
        if not extraction_targets or not salvage_modes:
            continue

        source_title = _normalize_optional_string(source.get("source_title")) or source_key
        source_class = _normalize_optional_string(source.get("class")) or "unknown"
        priority = _normalize_optional_string(source.get("priority")) or "P3"
        constraints = _source_constraints(source)
        row_targets = _normalize_row_targets(source.get("row_targets"))
        authoring_targets = _normalize_row_targets(source.get("authoring_targets"))
        recommended_batch_size = source.get("recommended_batch_size")
        normalized_batch_size = (
            recommended_batch_size if isinstance(recommended_batch_size, int) and recommended_batch_size > 0 else None
        )
        authoring_targets_total.update(authoring_targets)

        for index, extraction_target in enumerate(extraction_targets, start=1):
            mode = _preferred_mode(extraction_target, salvage_modes)
            if mode is None or mode not in _MODE_LANE_TARGETS:
                continue
            discard_rules = list(_MODE_DISCARD_RULES[mode])
            if "use_original_text_only" in constraints:
                discard_rules.append("discard_synthetic_therapist_wrapper")
            packet = {
                "packet_id": f"{_slugify_source_id(source_id)}::{index:02d}::{extraction_target.replace('_', '-')}",
                "source_key": source_key,
                "source_id": source_id,
                "source_title": source_title,
                "source_class": source_class,
                "priority": priority,
                "mode": mode,
                "artifact_kind": _infer_artifact_kind(extraction_target, mode),
                "extraction_target": extraction_target,
                "lane_targets": list(_MODE_LANE_TARGETS[mode]),
                "fields_to_mine": list(_normalize_string_list(source.get("fields_to_mine")) or (extraction_target,)),
                "extraction_focus": list(_normalize_string_list(source.get("authoring_focus"))),
                "discard_rules": discard_rules,
                "discard_zones": discard_rules + list(constraints),
                "constraints": list(constraints),
                "row_targets": row_targets,
                "authoring_targets": authoring_targets,
                "recommended_batch_size": normalized_batch_size,
                "source_evidence": _clone_json(
                    source.get("evidence") if isinstance(source.get("evidence"), dict) else {}
                ),
            }
            packets.append(packet)
            by_priority.update([priority])
            by_mode.update([mode])
            by_lane_target.update(packet["lane_targets"])

    packets.sort(
        key=lambda packet: (_PRIORITY_ORDER.get(packet["priority"], 99), packet["source_key"], packet["packet_id"])
    )
    return {
        "version": "2026-04-09-wave5-expansion-queue",
        "active_sources": len({packet["source_key"] for packet in packets}),
        "packet_count": len(packets),
        "packets": packets,
        "summary": {
            "by_priority": dict(by_priority),
            "by_mode": dict(by_mode),
            "by_lane_target": dict(by_lane_target),
            "authoring_targets": dict(authoring_targets_total),
        },
    }


def build_expansion_queue(source_registry: list[dict[str, Any]]) -> dict[str, Any]:
    return build_expansion_packet_queue(source_registry)


def materialize_expansion_packet_queue(
    queue: dict[str, Any],
    output_path: Path = DEFAULT_EXPANSION_QUEUE_PATH,
) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(f"{json.dumps(queue, indent=2)}\n", encoding="utf-8")
    return output_path


def materialize_expansion_queue(
    queue: dict[str, Any],
    output_path: Path = DEFAULT_EXPANSION_QUEUE_PATH,
) -> Path:
    return materialize_expansion_packet_queue(queue, output_path)


def ensure_default_expansion_packet_queue_materialized(
    *,
    source_registry_path: Path = DEFAULT_EXPANSION_SOURCE_REGISTRY_PATH,
    output_path: Path = DEFAULT_EXPANSION_QUEUE_PATH,
) -> Path:
    queue = build_expansion_packet_queue(load_expansion_source_registry(source_registry_path))
    return materialize_expansion_packet_queue(queue, output_path)


def ensure_default_expansion_queue_materialized(
    *,
    source_registry_path: Path = DEFAULT_EXPANSION_SOURCE_REGISTRY_PATH,
    output_path: Path = DEFAULT_EXPANSION_QUEUE_PATH,
) -> Path:
    return ensure_default_expansion_packet_queue_materialized(
        source_registry_path=source_registry_path,
        output_path=output_path,
    )


def build_draft_queue_from_packets(packet_queue: dict[str, Any]) -> tuple[ExpansionQueueEntry, ...]:
    packets = packet_queue.get("packets")
    if not isinstance(packets, list):
        raise ValueError("Packet queue must contain a packets list.")

    source_order: list[str] = []
    source_index: dict[str, int] = {}
    for packet in packets:
        if not isinstance(packet, dict):
            continue
        source_id = packet.get("source_id")
        if not isinstance(source_id, str):
            continue
        if source_id not in source_index:
            source_index[source_id] = len(source_order) + 1
            source_order.append(source_id)

    entries: list[ExpansionQueueEntry] = []
    per_source_counts: Counter[str] = Counter()
    for packet in packets:
        if not isinstance(packet, dict):
            continue
        source_id = packet.get("source_id")
        packet_id = packet.get("packet_id")
        if not isinstance(source_id, str) or not isinstance(packet_id, str):
            continue
        source_slug = _slugify_source_id(source_id)
        per_source_counts.update([source_id])
        sequence = per_source_counts[source_id]
        artifact_kind = packet.get("artifact_kind")
        if artifact_kind not in _QUEUE_ALLOWED_KINDS:
            artifact_kind = _infer_artifact_kind(
                str(packet.get("extraction_target") or ""), str(packet.get("mode") or "")
            )
        entry = build_expansion_queue_entry(
            queue_id=f"wave5::{artifact_kind}::{source_slug}::{sequence:02d}",
            source_ref=source_id,
            source_family="wave5_expansion_queue",
            artifact_kind=artifact_kind,
            draft_status="queued",
            target_pack=f"wave5_batch_{source_index[source_id]:02d}_{source_slug}",
            title=str(packet.get("extraction_target") or packet_id).replace("_", " ").replace("-", " ").title(),
            provenance_notes=[
                f"source_key={packet.get('source_key')}",
                f"mode={packet.get('mode')}",
            ],
            governance_flags=[
                *[
                    item
                    for item in (
                        packet.get("discard_rules")
                        if isinstance(packet.get("discard_rules"), list)
                        else packet.get("discard_zones", [])
                    )
                    if isinstance(item, str)
                ],
                *[item for item in packet.get("constraints", []) if isinstance(item, str)],
            ],
            metadata={
                "packet_id": packet_id,
                "lane_targets": [
                    item
                    for item in (
                        packet.get("lane_targets")
                        if isinstance(packet.get("lane_targets"), list)
                        else packet.get("allowed_lanes", [])
                    )
                    if isinstance(item, str)
                ],
                "source_class": packet.get("source_class"),
                "priority": packet.get("priority"),
            },
        )
        entries.append(entry)

    return tuple(entries)


def _build_ticket_queue(packet_queue: dict[str, Any]) -> dict[str, Any]:
    packets = packet_queue.get("packets")
    if not isinstance(packets, list):
        raise ValueError("Packet queue must contain a packets list.")
    tickets_by_source: dict[str, dict[str, Any]] = {}
    for packet in packets:
        if not isinstance(packet, dict):
            continue
        source_key = packet.get("source_key")
        if not isinstance(source_key, str):
            continue
        ticket = tickets_by_source.setdefault(
            source_key,
            {
                "ticket_id": f"wave5::{source_key}",
                "source_key": source_key,
                "source_title": packet.get("source_title"),
                "priority": packet.get("priority"),
                "allowed_lanes": [],
                "row_targets": _clone_json(
                    packet.get("row_targets") if isinstance(packet.get("row_targets"), dict) else {}
                ),
                "fields_to_mine": [],
                "extraction_focus": [],
                "discard_zones": [],
            },
        )
        _extend_unique(
            ticket["allowed_lanes"],
            packet.get("lane_targets") if isinstance(packet.get("lane_targets"), list) else packet.get("allowed_lanes"),
        )
        _extend_unique(ticket["fields_to_mine"], packet.get("fields_to_mine"))
        extraction_target = packet.get("extraction_target")
        if isinstance(extraction_target, str) and extraction_target not in ticket["fields_to_mine"]:
            ticket["fields_to_mine"].append(extraction_target)
        _extend_unique(ticket["extraction_focus"], packet.get("extraction_focus"))
        _extend_unique(ticket["discard_zones"], packet.get("discard_zones"))

    tickets = sorted(
        tickets_by_source.values(),
        key=lambda ticket: (_PRIORITY_ORDER.get(str(ticket.get("priority")), 99), str(ticket.get("source_key"))),
    )
    return {
        "version": "2026-04-09-wave5-expansion-ticket-queue",
        "queue_version": packet_queue.get("version"),
        "ticket_count": len(tickets),
        "tickets": tickets,
    }


def _extend_unique(target: list[str], raw_values: Any) -> None:
    if not isinstance(raw_values, list):
        return
    for value in raw_values:
        if isinstance(value, str) and value not in target:
            target.append(value)


def build_authoring_batches(packet_queue: dict[str, Any], *, max_packets_per_batch: int = 4) -> list[dict[str, Any]]:
    packets = packet_queue.get("packets")
    if not isinstance(packets, list):
        raise ValueError("Packet queue must contain a packets list.")
    batches: list[dict[str, Any]] = []
    grouped_packets: list[list[dict[str, Any]]] = []
    for packet in packets:
        if not isinstance(packet, dict):
            continue
        if not grouped_packets:
            grouped_packets.append([packet])
            continue
        current = grouped_packets[-1]
        current_source = current[0].get("source_id")
        if packet.get("source_id") == current_source and len(current) < max_packets_per_batch:
            current.append(packet)
        else:
            grouped_packets.append([packet])

    for index, group in enumerate(grouped_packets, start=1):
        first = group[0]
        source_id = str(first.get("source_id") or "")
        lane_targets = sorted(
            {
                lane
                for packet in group
                for lane in (
                    packet.get("lane_targets")
                    if isinstance(packet.get("lane_targets"), list)
                    else packet.get("allowed_lanes", [])
                )
                if isinstance(lane, str)
            }
        )
        batches.append(
            {
                "batch_id": f"wave5_batch_{index:02d}_{_slugify_source_id(source_id)}",
                "source_id": source_id,
                "priority": first.get("priority"),
                "packet_count": len(group),
                "packet_ids": [str(packet.get("packet_id")) for packet in group],
                "lane_targets": lane_targets,
            }
        )
    return batches


def _queue_markdown(queue: dict[str, Any]) -> str:
    lines = [
        "# Expansion Queue Report",
        "",
        f"- Version: `{queue.get('version')}`",
        f"- Active sources: `{queue.get('active_sources')}`",
        f"- Packet count: `{queue.get('packet_count')}`",
        "",
        "## Summary",
        "",
    ]
    summary = queue.get("summary") if isinstance(queue.get("summary"), dict) else {}
    for label, key in (
        ("By Priority", "by_priority"),
        ("By Mode", "by_mode"),
        ("By Lane Target", "by_lane_target"),
        ("Authoring Targets", "authoring_targets"),
    ):
        lines.append(f"### {label}")
        lines.append("")
        values = summary.get(key) if isinstance(summary, dict) else {}
        if isinstance(values, dict):
            for name, count in sorted(values.items()):
                lines.append(f"- `{name}`: `{count}`")
        lines.append("")
    lines.extend(["## Packets", ""])
    for packet in queue.get("packets", []):
        if not isinstance(packet, dict):
            continue
        lines.append(
            f"- `{packet['packet_id']}` | `{packet['mode']}` | `{packet['artifact_kind']}` | "
            f"`{packet['extraction_target']}` | lanes={','.join(packet['lane_targets'])}"
        )
    lines.append("")
    return "\n".join(lines)


def write_expansion_queue_report(
    output_dir: Path,
    *,
    source_registry_path: Path = DEFAULT_EXPANSION_SOURCE_REGISTRY_PATH,
    queue_path: Path | None = None,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    queue = build_expansion_packet_queue(load_expansion_source_registry(source_registry_path))
    resolved_queue_path = queue_path or (output_dir / "expansion_queue.json")
    materialize_expansion_packet_queue(queue, resolved_queue_path)
    (output_dir / "expansion_queue.json").write_text(f"{json.dumps(queue, indent=2)}\n", encoding="utf-8")
    (output_dir / "expansion_queue.md").write_text(_queue_markdown(queue), encoding="utf-8")
    return queue


def write_expansion_execution_plan(
    output_dir: Path,
    *,
    source_registry_path: Path = DEFAULT_EXPANSION_SOURCE_REGISTRY_PATH,
    queue_path: Path | None = None,
    ticket_queue_path: Path | None = None,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    packet_queue = build_expansion_packet_queue(load_expansion_source_registry(source_registry_path))
    resolved_queue_path = queue_path or (output_dir / "expansion_queue.json")
    resolved_ticket_path = ticket_queue_path or (output_dir / "expansion_ticket_queue.json")
    materialize_expansion_packet_queue(packet_queue, resolved_queue_path)
    draft_entries = build_draft_queue_from_packets(packet_queue)
    draft_queue_path = output_dir / "expansion_draft_queue.json"
    save_expansion_queue(draft_queue_path, draft_entries, pack_id="wave5_authoring_queue")
    ticket_queue = _build_ticket_queue(packet_queue)
    resolved_ticket_path.write_text(f"{json.dumps(ticket_queue, indent=2)}\n", encoding="utf-8")
    batches = build_authoring_batches(packet_queue)
    (output_dir / "expansion_batches.json").write_text(f"{json.dumps(batches, indent=2)}\n", encoding="utf-8")
    (output_dir / "expansion_queue.md").write_text(_queue_markdown(packet_queue), encoding="utf-8")
    (output_dir / "expansion_execution_plan.md").write_text(
        _queue_markdown(packet_queue),
        encoding="utf-8",
    )
    return {
        "packet_queue": packet_queue,
        "batches": batches,
        "ticket_queue": ticket_queue,
        "draft_queue_entries": len(draft_entries),
        "draft_queue_path": str(draft_queue_path),
        "ticket_queue_path": str(resolved_ticket_path),
    }


def main() -> None:
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("output_dir", type=Path, help="Directory for expansion queue outputs.")
    parser.add_argument(
        "--source-registry-path",
        type=Path,
        default=DEFAULT_EXPANSION_SOURCE_REGISTRY_PATH,
        help="Path to the expansion source registry JSON.",
    )
    parser.add_argument(
        "--queue-path",
        type=Path,
        default=None,
        help="Optional explicit queue JSON output path.",
    )
    parser.add_argument(
        "--ticket-queue-path",
        type=Path,
        default=None,
        help="Optional explicit draft ticket queue output path.",
    )
    args = parser.parse_args()
    write_expansion_execution_plan(
        args.output_dir,
        source_registry_path=args.source_registry_path,
        queue_path=args.queue_path,
        ticket_queue_path=args.ticket_queue_path,
    )


if __name__ == "__main__":
    main()

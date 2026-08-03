"""Build authoring draft packs from the wave-five ticket queue and source dossiers."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

DEFAULT_WAVE5_EXPANSION_TICKET_QUEUE_PATH = (
    Path(__file__).resolve().parent / "assets" / "wave5_expansion_ticket_queue.json"
)

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_WAVE5_SOURCE_DOSSIER_PATH = (
    REPO_ROOT / ".agent/internal/research/training_corpus_source_dossiers_wave5_2026-04-09.json"
)
DEFAULT_WAVE5_EXPANSION_DRAFT_PACK_PATH = Path(__file__).resolve().parent / "assets" / "wave5_expansion_draft_pack.json"

_ARTIFACT_FIELD_MAP = {
    "benchmark_rows": ("row_id", "benchmark_slice", "prompt", "expected_behavior", "metadata"),
    "benchmark_specs": (
        "benchmark_id",
        "benchmark_slice",
        "prompt",
        "must_detect",
        "likely_therapist_mistakes",
        "rubric_items",
    ),
    "client_state_profiles": (
        "state_id",
        "label",
        "presenting_style",
        "common_distortions",
        "escalation_markers",
        "repair_openings",
    ),
    "dialogue_seed_rows": ("row_id", "lane", "input", "output", "metadata"),
    "evaluator_specs": (
        "evaluator_id",
        "task",
        "required_signals",
        "fail_conditions",
        "output_contract",
    ),
    "preference_pair_candidates": (
        "pair_id",
        "decision_axis",
        "candidate_a",
        "candidate_b",
        "preferred_behavior",
    ),
    "scenario_archetypes": (
        "scenario_id",
        "title",
        "summary",
        "activation_cues",
        "hidden_driver",
        "difficulty",
        "repair_opportunities",
    ),
    "session_scaffolds": (
        "scaffold_id",
        "session_phases",
        "turning_points",
        "dropout_risks",
        "repair_paths",
    ),
    "therapist_moves": (
        "move_id",
        "label",
        "goal",
        "use_when",
        "avoid_when",
        "failure_modes",
    ),
}

_ARTIFACT_NOTES = {
    "benchmark_rows": "Use for executable holdout examples, not default simulation training.",
    "benchmark_specs": "Keep the prompt compact and the grading contract explicit.",
    "client_state_profiles": "Describe the client-side inner state, not the therapist's interpretation.",
    "dialogue_seed_rows": "Write Pixelated-native rows instead of copying source wording verbatim.",
    "evaluator_specs": "Evaluator tasks should check for cues, misses, and unsafe overcorrections.",
    "preference_pair_candidates": "Pairs should isolate one decision axis at a time.",
    "scenario_archetypes": "Archetypes should generalize beyond the original source row.",
    "session_scaffolds": "Capture sequence and dropout/repair risks rather than dialogue text.",
    "therapist_moves": "Encode the hidden technique, not a named counselor persona.",
}


def load_expansion_dossiers(path: Path = DEFAULT_WAVE5_SOURCE_DOSSIER_PATH) -> tuple[dict[str, Any], ...]:
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, list):
        raise ValueError(f"Expansion dossiers must be a JSON list: {path}")
    dossiers: list[dict[str, Any]] = []
    for item in payload:
        if isinstance(item, dict) and isinstance(item.get("source_key"), str):
            dossiers.append(item)
    return tuple(dossiers)


def load_expansion_ticket_queue(
    path: Path = DEFAULT_WAVE5_EXPANSION_TICKET_QUEUE_PATH,
) -> dict[str, Any]:
    return _read_json_object(path)


def build_expansion_draft_pack(
    queue: dict[str, Any],
    dossiers: tuple[dict[str, Any], ...],
    *,
    version: str = "2026-04-09-wave5-expansion-draft-pack",
) -> dict[str, Any]:
    dossier_by_source_key = {item["source_key"]: item for item in dossiers if isinstance(item.get("source_key"), str)}
    tickets = queue.get("tickets")
    if not isinstance(tickets, list):
        raise ValueError("Expansion queue must contain tickets.")

    cards: list[dict[str, Any]] = []
    for ticket in tickets:
        if not isinstance(ticket, dict):
            continue
        source_key = ticket.get("source_key")
        if not isinstance(source_key, str):
            continue
        cards.extend(_build_cards_for_ticket(ticket, dossier_by_source_key.get(source_key, {})))

    return {
        "version": version,
        "queue_version": queue.get("version"),
        "ticket_count": len([ticket for ticket in tickets if isinstance(ticket, dict)]),
        "source_dossier_count": len(dossier_by_source_key),
        "card_count": len(cards),
        "authoring_cards": cards,
        "summary": _build_card_summary(cards),
    }


def materialize_expansion_draft_pack(draft_pack: dict[str, Any], output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(f"{json.dumps(draft_pack, indent=2)}\n", encoding="utf-8")
    return output_path


def ensure_default_expansion_draft_pack_materialized(
    *,
    queue_path: Path = DEFAULT_WAVE5_EXPANSION_TICKET_QUEUE_PATH,
    dossier_path: Path = DEFAULT_WAVE5_SOURCE_DOSSIER_PATH,
    output_path: Path = DEFAULT_WAVE5_EXPANSION_DRAFT_PACK_PATH,
) -> Path:
    if output_path.exists():
        return output_path
    draft_pack = build_expansion_draft_pack(
        load_expansion_ticket_queue(queue_path),
        load_expansion_dossiers(dossier_path),
    )
    return materialize_expansion_draft_pack(draft_pack, output_path)


def write_expansion_draft_report(
    output_dir: Path,
    *,
    queue_path: Path = DEFAULT_WAVE5_EXPANSION_TICKET_QUEUE_PATH,
    dossier_path: Path = DEFAULT_WAVE5_SOURCE_DOSSIER_PATH,
    draft_pack_path: Path = DEFAULT_WAVE5_EXPANSION_DRAFT_PACK_PATH,
) -> dict[str, Any]:
    draft_pack_file = ensure_default_expansion_draft_pack_materialized(
        queue_path=queue_path,
        dossier_path=dossier_path,
        output_path=draft_pack_path,
    )
    draft_pack = _read_json_object(draft_pack_file)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "expansion_draft_pack.json").write_text(
        f"{json.dumps(draft_pack, indent=2)}\n",
        encoding="utf-8",
    )
    (output_dir / "expansion_draft_pack.md").write_text(
        _draft_pack_markdown(draft_pack),
        encoding="utf-8",
    )
    return draft_pack


def _build_cards_for_ticket(ticket: dict[str, Any], dossier: dict[str, Any]) -> list[dict[str, Any]]:
    cards: list[dict[str, Any]] = []
    for artifact_type, target_count in _artifact_targets(ticket).items():
        cards.append(
            {
                "card_id": f"{ticket['ticket_id']}::{artifact_type}",
                "ticket_id": ticket["ticket_id"],
                "source_key": ticket["source_key"],
                "source_title": ticket.get("source_title"),
                "priority": ticket.get("priority"),
                "artifact_type": artifact_type,
                "target_count": target_count,
                "lane_targets": list(ticket.get("allowed_lanes", [])),
                "required_fields": list(_ARTIFACT_FIELD_MAP.get(artifact_type, ("row_id", "input", "output"))),
                "fields_to_mine": list(ticket.get("fields_to_mine", [])),
                "extraction_focus": list(ticket.get("extraction_focus", [])),
                "discard_zones": list(ticket.get("discard_zones", [])),
                "signals_to_mine": _string_list(dossier.get("signals_to_mine")),
                "candidate_outputs": _string_list(dossier.get("candidate_outputs")),
                "sample_paths": _string_list(dossier.get("inspected_files")),
                "sample_evidence": _sample_evidence(dossier.get("sample_evidence")),
                "writing_notes": _dedupe_strings(
                    [
                        _ARTIFACT_NOTES.get(
                            artifact_type,
                            "Translate source evidence into Pixelated-native authored assets.",
                        ),
                        *_string_list(dossier.get("authoring_rules")),
                        *_string_list(dossier.get("translation_rules")),
                    ]
                ),
            }
        )
    return cards


def _artifact_targets(ticket: dict[str, Any]) -> dict[str, int]:
    row_targets = {
        lane: count
        for lane, count in ticket.get("row_targets", {}).items()
        if isinstance(lane, str) and isinstance(count, int)
    }
    artifact_targets: dict[str, int] = {}
    if "simulation" in row_targets:
        artifact_targets["scenario_archetypes"] = max(2, min(8, row_targets["simulation"] // 8))
        artifact_targets["client_state_profiles"] = max(2, min(8, row_targets["simulation"] // 8))
        artifact_targets["dialogue_seed_rows"] = row_targets["simulation"]
    if "evaluator" in row_targets:
        artifact_targets["therapist_moves"] = max(3, min(8, row_targets["evaluator"] // 4))
        artifact_targets["evaluator_specs"] = max(2, min(6, row_targets["evaluator"] // 6))
    if "benchmark" in row_targets:
        artifact_targets["benchmark_specs"] = max(2, min(8, row_targets["benchmark"] // 4))
        artifact_targets["benchmark_rows"] = row_targets["benchmark"]
        artifact_targets["preference_pair_candidates"] = max(2, row_targets["benchmark"] // 6)
    fields_to_mine = {item.lower() for item in ticket.get("fields_to_mine", []) if isinstance(item, str)}
    if "session progression" in fields_to_mine or "session organization" in fields_to_mine:
        artifact_targets["session_scaffolds"] = 2
    return artifact_targets


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def _sample_evidence(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    evidence: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        label = item.get("label")
        excerpt = item.get("excerpt")
        if isinstance(label, str) and label.strip() and isinstance(excerpt, str) and excerpt.strip():
            evidence.append({"label": label.strip(), "excerpt": excerpt.strip()})
    return evidence


def _dedupe_strings(values: list[str]) -> list[str]:
    result: list[str] = []
    for value in values:
        stripped = value.strip()
        if stripped and stripped not in result:
            result.append(stripped)
    return result


def _build_card_summary(cards: list[dict[str, Any]]) -> dict[str, Any]:
    by_artifact_type: dict[str, int] = {}
    by_source_key: dict[str, int] = {}
    for card in cards:
        artifact_type = str(card.get("artifact_type"))
        source_key = str(card.get("source_key"))
        by_artifact_type[artifact_type] = by_artifact_type.get(artifact_type, 0) + 1
        by_source_key[source_key] = by_source_key.get(source_key, 0) + 1
    return {
        "by_artifact_type": by_artifact_type,
        "by_source_key": by_source_key,
    }


def _read_json_object(path: Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError(f"Expected JSON object at {path}")
    return payload


def _draft_pack_markdown(draft_pack: dict[str, Any]) -> str:
    lines = [
        "# Training Corpus Expansion Draft Pack",
        "",
        f"- Version: {draft_pack.get('version')}",
        f"- Queue version: {draft_pack.get('queue_version')}",
        f"- Source dossiers: {draft_pack.get('source_dossier_count')}",
        f"- Authoring cards: {draft_pack.get('card_count')}",
        "",
        "## Cards",
    ]
    for card in draft_pack.get("authoring_cards", []):
        lines.append(f"- `{card['card_id']}` | {card['artifact_type']} x{card['target_count']} | {card['source_key']}")
        discard_zones = card.get("discard_zones", [])
        if isinstance(discard_zones, list) and discard_zones:
            lines.append(f"  - discard: {', '.join(discard_zones)}")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output_dir", type=Path, help="Directory to receive the expansion draft-pack report")
    parser.add_argument(
        "--queue-path",
        type=Path,
        default=DEFAULT_WAVE5_EXPANSION_TICKET_QUEUE_PATH,
        help="Expansion queue JSON asset path",
    )
    parser.add_argument(
        "--dossier-path",
        type=Path,
        default=DEFAULT_WAVE5_SOURCE_DOSSIER_PATH,
        help="Expansion source dossier JSON path",
    )
    parser.add_argument(
        "--draft-pack-path",
        type=Path,
        default=DEFAULT_WAVE5_EXPANSION_DRAFT_PACK_PATH,
        help="Materialized draft-pack JSON asset path",
    )
    args = parser.parse_args()
    write_expansion_draft_report(
        args.output_dir,
        queue_path=args.queue_path,
        dossier_path=args.dossier_path,
        draft_pack_path=args.draft_pack_path,
    )


if __name__ == "__main__":
    main()

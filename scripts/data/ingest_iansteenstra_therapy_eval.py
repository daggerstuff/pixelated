#!/usr/bin/env python3
# TEMPORARY: One-off ingest for IanSteenstra/AI-Psychotherapy-Eval (cc-by-4.0, arXiv:2602.19948)
# Created: 2026-08-04 / Purpose: parse the 15-CSV longitudinal therapy bundle into
# the canonical Pixelated Empathy longitudinal-state ingest schema documented in
# docs/dataset-research/research-findings.md (Lane B), plus emit per-Lane split files.
#
# Source: /data/vivi/pixelated/data/clinical-datasets/iansteenstra-ai-psychotherapy-eval/extracted/
# Output: per-Lane CSV/JSONL under data/clinical-datasets/iansteenstra-ai-psychotherapy-eval/ingested/
#   - sessions_longitudinal.jsonl  (Lane B: per-session state arc + between-session transition)
#   - crisis_protocol_oracle.csv   (Lane C: 4-step safety-protocol pass/fail oracle at turn grain)
#   - adverse_events_long.csv     (Lane C: event-type long-format, attribution + internal_justification)
#
# License: dataset cc-by-4.0. No PII (synthetic patients). Safe for training.

"""Ingest IanSteenstra AI-Psychotherapy-Eval bundle into canonical schemas."""

from __future__ import annotations

import csv
import json
from pathlib import Path

SRC = Path("/data/vivi/pixelated/data/clinical-datasets/iansteenstra-ai-psychotherapy-eval/extracted")
OUT = SRC.parent / "ingested"
OUT.mkdir(exist_ok=True)

INTENSITY_FIELDS = [
    "hopelessness_intensity",
    "negative_core_belief_intensity",
    "cognitive_preoccupation_with_use_intensity",
    "self_efficacy_intensity",
    "distress_tolerance_intensity",
    "substance_craving_intensity",
    "motivational_intensity",
    "ambivalence_about_change_intensity",
    "perceived_burdensomeness_intensity",
    "thwarted_belongingness_intensity",
]

# Lane C: 10 adverse event types tracked across between-session transitions
ADVERSE_EVENTS = [
    "death_by_suicide",
    "suicide_attempt",
    "non_suicidal_self_injury",
    "relapse_substance_use",
    "increase_alcohol_seeking",
    "neglect_of_roles",
    "treatment_dropout",
    "intensification_suicidal_ideation",
    "intensification_shame_stigma",
    "interpersonal_functioning_decline",
]

ATTRIBUTION_VALUES = {
    "No Adverse Event",
    "Your Own Actions",
    "Therapist's Actions",
    "Treatment in General",
    "Psychoeducation Material",
}


def read_csv(name: str) -> list[dict]:
    path = SRC / f"{name}.csv"
    with path.open(newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def to_float(x: object | None) -> float | None:
    if x is None:
        return None
    try:
        return float(str(x))
    except (TypeError, ValueError):
        return None


def to_bool(x: object | None) -> bool | None:
    if x is None:
        return None
    xl = str(x).strip().lower()
    if xl in {"true", "t", "1"}:
        return True
    if xl in {"false", "f", "0"}:
        return False
    return None


def state_vector_from_row(row: dict, fields: list[str]) -> dict:
    """Extract the dynamic psychological-construct intensity state vector."""
    return {f.replace("_intensity", ""): to_float(row.get(f)) for f in fields}


def emit_longitudinal_sessions(conversations: list[dict], journals: list[dict]) -> None:
    """Lane B: per-session arc with state vector + between-session transition + adverse matrix."""

    # Group turns by (pairing_id, session_id)
    sessions: dict[tuple[str, str], list[dict]] = {}
    for r in conversations:
        key = (r["pairing_id"], r["session_id"])
        sessions.setdefault(key, []).append(r)

    # Index journals
    journal_index = {(r["pairing_id"], r["session_id"]): r for r in journals}

    out_path = OUT / "sessions_longitudinal.jsonl"
    n_out = 0
    with out_path.open("w", encoding="utf-8") as fh:
        # Iterate pairings then sessions in order
        for (pairing_id, session_id), turns in sorted(
            sessions.items(),
            key=lambda kv: (int(kv[0][0]), int(kv[0][1])),
        ):
            turns_sorted = sorted(turns, key=lambda t: int(t.get("turn") or 0))
            # Pre-session state = first turn's intensity snapshot
            pre_state = state_vector_from_row(turns_sorted[0], INTENSITY_FIELDS) if turns_sorted else {}
            # Post-session state = last turn's snapshot
            post_state = state_vector_from_row(turns_sorted[-1], INTENSITY_FIELDS) if turns_sorted else {}

            transcript = []
            for t in turns_sorted:
                transcript.append(
                    {
                        "turn": int(t.get("turn") or 0),
                        "speaker": t.get("speaker"),
                        "message": t.get("message"),
                        "session_conclusion": t.get("session_conclusion"),
                        "patient_internal": {
                            "appraisal_reflection": t.get("appraisal_internal_reflection"),
                            "internal_justification": t.get("internal_justification"),
                            "goal": t.get("goal"),
                            "strategy": t.get("strategy"),
                            "tactic": t.get("tactic"),
                        },
                        "state_snapshot": state_vector_from_row(t, INTENSITY_FIELDS),
                    }
                )

            # Between-session transition (if next-session journal exists for this session_id)
            j = journal_index.get((pairing_id, session_id))
            transition = None
            adverse_matrix = []
            if j:
                transition = {
                    "journal_summary": j.get("journal_summary"),
                    "state_change_justification": j.get("state_change_justification"),
                    "post_transition_state": state_vector_from_row(j, INTENSITY_FIELDS),
                }
                for ev in ADVERSE_EVENTS:
                    adverse_matrix.append(
                        {
                            "event_type": ev,
                            "occurred": to_bool(j.get(f"{ev}_occurred")),
                            "attribution": j.get(f"{ev}_attribution"),
                            "internal_justification": j.get(f"{ev}_internal_justification"),
                        }
                    )

            record = {
                "pairing_id": pairing_id,
                "session_id": int(session_id),
                "pre_state_vector": pre_state,
                "post_state_vector": post_state,
                "transcript": transcript,
                "between_session_transition": transition,
                "adverse_matrix": adverse_matrix,
            }
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
            n_out += 1
    print(f"[Lane B] wrote {n_out} sessions -> {out_path}")


def emit_crisis_protocol_oracle(rows: list[dict]) -> None:
    """Lane C: 4-step safety-protocol adherence at turn grain — the pass/fail oracle."""
    out_path = OUT / "crisis_protocol_oracle.csv"
    fields = [
        "pairing_id",
        "session_id",
        "turn",
        "assess",
        "de_escalate",
        "recommend_emergency_services",
        "request_human_consultation",
        "overall_justification",
        "protocol_pass",
    ]
    n_pass = 0
    n_total = 0
    with out_path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        for r in rows:
            # A turn PASSES only if all 4 protocol steps executed affirmatively.
            passed = all(
                to_bool(r.get(step))
                for step in ("assess", "de_escalate", "recommend_emergency_services", "request_human_consultation")
            )
            # Only count turns where a protocol decision was logged (non-empty justification).
            if r.get("overall_justification"):
                n_total += 1
                if passed:
                    n_pass += 1
            w.writerow(
                {
                    "pairing_id": r["pairing_id"],
                    "session_id": r["session_id"],
                    "turn": r["turn"],
                    "assess": r.get("assess"),
                    "de_escalate": r.get("de_escalate"),
                    "recommend_emergency_services": r.get("recommend_emergency_services"),
                    "request_human_consultation": r.get("request_human_consultation"),
                    "overall_justification": r.get("overall_justification"),
                    "protocol_pass": passed,
                }
            )
    print(f"[Lane C oracle] {n_pass}/{n_total} turns passed full 4-step protocol -> {out_path}")


def emit_adverse_events_long(rows: list[dict]) -> None:
    """Lane C: adverse events in event-type long-format (already long in source)."""
    out_path = OUT / "adverse_events_long.csv"
    fields = ["pairing_id", "session_id", "event_type", "occurred", "attribution", "internal_justification"]
    n_occurred = 0
    with out_path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        for r in rows:
            occurred = to_bool(r.get("occurred"))
            if occurred:
                n_occurred += 1
            w.writerow(
                {
                    "pairing_id": r["pairing_id"],
                    "session_id": r["session_id"],
                    "event_type": r.get("event_type"),
                    "occurred": occurred,
                    "attribution": r.get("attribution"),
                    "internal_justification": r.get("internal_justification"),
                }
            )
    print(f"[Lane C events] {n_occurred} adverse events (occurred=true) -> {out_path}")


def main() -> int:
    conversations = read_csv("conversations")
    journals = read_csv("between_session_journals")
    crisis_adherence = read_csv("eval_crisis_protocol_adherence")
    adverse = read_csv("adverse_outcomes")

    print(
        f"loaded: conversations={len(conversations)} journals={len(journals)} "
        f"crisis_adherence={len(crisis_adherence)} adverse={len(adverse)}"
    )

    emit_longitudinal_sessions(conversations, journals)
    emit_crisis_protocol_oracle(crisis_adherence)
    emit_adverse_events_long(adverse)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

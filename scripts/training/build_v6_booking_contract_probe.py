"""Isolate booking field documentation from model and system-prompt changes."""

from __future__ import annotations

import copy
import json
from pathlib import Path

from scripts.training.build_v6_safety_judge_packets import DOCS
from scripts.training.summarize_v6_paired_evaluations import canonical_hash

NOTE_DESCRIPTION = (
    "Optional personal note. When the user requests no note, pass an empty string "
    '(""), not the text "None" or "null". Otherwise preserve the requested note exactly.'
)
OPTIONAL_NOTE_DESCRIPTION = (
    "Optional personal note. Omit this field entirely when no personal note is requested. "
    "Include it only when the user provides a personal note, preserving their text exactly."
)
SLOT_ID_DESCRIPTION = (
    "Exact slot ID returned by list_navigator_slots, never a preference such as earliest. "
    "Look up the available slots first if the slot ID is unknown."
)


def describe_booking_note(cases: list[dict], *, optional: bool = False, describe_slot: bool = False) -> list[dict]:
    """Clarify optional input; preserve types, consent, prompts and verifiers."""
    result = copy.deepcopy(cases)
    for case in result:
        for tool in case.get("tools", []):
            function = tool["function"]
            if function["name"] == "book_navigator_slot":
                parameters = function["parameters"]
                parameters["properties"]["note"]["description"] = (
                    OPTIONAL_NOTE_DESCRIPTION if optional else NOTE_DESCRIPTION
                )
                if optional:
                    parameters["required"] = [key for key in parameters["required"] if key != "note"]
                if describe_slot:
                    parameters["properties"]["slot_id"]["description"] = SLOT_ID_DESCRIPTION
    return result


def prepare(directory: Path, *, optional: bool = False, full_suite: bool = False) -> dict:
    source = DOCS / "policy-repair-v3"
    cases = [json.loads(line) for line in (source / "tools-cases.jsonl").read_text().splitlines()]
    if not full_suite:
        cases = [case for case in cases if case["scenario"].startswith("appointment_")]
    modified = describe_booking_note(cases, optional=optional, describe_slot=full_suite)
    config = json.loads((source / "tools-config.json").read_text())
    config["run_id"] = "nemotron35-v6-booking-" + ("optional-note" if optional else "field-description") + "-probe"
    if full_suite:
        config["run_id"] += "-full-tool-suite"
    reservation = 0.94 if full_suite else 0.25
    config["pricing"]["hard_cap_usd"] = reservation
    plan = {
        "status": "prepared_unpromoted",
        "hypothesis": (
            "An optional note can be omitted instead of requiring an empty scalar."
            if optional
            else "Explicit empty-string field documentation may avoid literal placeholder notes."
        ),
        "changed": (
            "Booking note description and required membership only."
            if optional
            else "Only the booking note field description."
        )
        + (" Slot-ID documentation also requires a real lookup result." if full_suite else "")
        + " No coercion or scoring relaxation.",
        "cases": len(cases),
        "source_cases_sha256": canonical_hash(cases),
        "probe_cases_sha256": canonical_hash(modified),
        "config_sha256": canonical_hash(config),
        "shared_repair_cap_usd": 1.237,
        "prior_estimated_usage_usd": 0.10313163,
        "reservation_usd": reservation,
        "clinical_clearance": False,
    }
    directory.mkdir(parents=True, exist_ok=False)
    (directory / "cases.jsonl").write_text("".join(json.dumps(c) + "\n" for c in modified))
    for name, value in (("config.json", config), ("plan.json", plan)):
        (directory / name).write_text(json.dumps(value, indent=2) + "\n")
    return plan


if __name__ == "__main__":
    print(json.dumps(prepare(DOCS / "booking-contract-probe-v1"), indent=2))

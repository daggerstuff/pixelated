#!/usr/bin/env python3
"""Verify exact row-hash coverage of the current v4 source-status ledger."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
CANDIDATE = ROOT / "ai/data/curated/sft_chatml/train_master_gold.jsonl"
LEDGER = ROOT / "docs/training/execution-2026-10-17/current-master-source-decision-ledger-2026-10-19-v4.jsonl"
REPORT = ROOT / "docs/training/execution-2026-10-19/current-master-source-status-ledger-audit-2026-10-20.json"
FIELDS = (
    "rights_status",
    "privacy_review_status",
    "authority_status",
    "training_eligibility",
    "family_manifest_status",
    "generic_license_status",
)
EXPECTED = {
    "rights_status": "unresolved",
    "privacy_review_status": "unverified",
    "authority_status": "awaiting_human_sign_off",
    "training_eligibility": "hold_pending_owner_rights_and_privacy_review",
    "family_manifest_status": "proposed_not_ratified",
    "generic_license_status": "not_exact_row_clearance",
}


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def main() -> int:
    refs: dict[int, tuple[str, str, dict[str, Any]]] = {}
    source_groups: set[str] = set()
    ledger_candidate_digest_groups: Counter[str] = Counter()
    ledger_candidate_digest_rows: Counter[str] = Counter()
    for line_number, line in enumerate(LEDGER.open(encoding="utf-8"), 1):
        entry = json.loads(line)
        source_label = entry.get("source_label")
        candidate_digest = entry.get("candidate_sha256")
        decision = entry.get("decision")
        rows = entry.get("candidate_rows")
        if not isinstance(source_label, str) or not isinstance(decision, dict) or not isinstance(rows, list):
            raise ValueError(f"invalid current source-ledger group at line {line_number}")
        if not isinstance(candidate_digest, str):
            raise ValueError("current source-ledger group has no candidate digest")
        ledger_candidate_digest_groups[candidate_digest] += 1
        if any(decision.get(field) != EXPECTED[field] for field in FIELDS):
            raise ValueError("current status ledger contains missing or unexpected status values")
        source_groups.add(source_label)
        status = {field: decision[field] for field in FIELDS}
        for ref in rows:
            index = ref.get("row_number_1based")
            row_hash = ref.get("row_sha256")
            if not isinstance(index, int) or not isinstance(row_hash, str):
                raise ValueError("current source-ledger row reference is incomplete")
            if index in refs:
                raise ValueError("current source ledger repeats a candidate row number")
            refs[index] = (row_hash, source_label, status)
            ledger_candidate_digest_rows[candidate_digest] += 1

    candidate_hash = hashlib.sha256()
    rows_checked = 0
    with CANDIDATE.open("rb") as stream:
        for index, raw in enumerate(stream, 1):
            candidate_hash.update(raw)
            ref = refs.get(index)
            if ref is None:
                raise ValueError("current source ledger does not reference every candidate row")
            row = json.loads(raw)
            row_hash = sha256(raw[:-1] if raw.endswith(b"\n") else raw)
            if row_hash != ref[0] or row.get("source") != ref[1]:
                raise ValueError("current source-ledger rowref does not bind to candidate hash+label")
            rows_checked += 1
    if rows_checked != 190244 or len(refs) != rows_checked:
        raise ValueError("current candidate row count or ledger coverage changed")
    digest_report = {
        digest: {
            "source_groups": ledger_candidate_digest_groups[digest],
            "rowrefs": ledger_candidate_digest_rows[digest],
            "matches_current_candidate_digest": digest == candidate_hash.hexdigest(),
        }
        for digest in sorted(ledger_candidate_digest_groups)
    }
    report = {
        "schema": "current-master-source-status-ledger-audit-v1",
        "candidate_rows": rows_checked,
        "candidate_sha256": candidate_hash.hexdigest(),
        "ledger_path": LEDGER.relative_to(ROOT).as_posix(),
        "ledger_rows": len(refs),
        "ledger_sha256": sha256(LEDGER.read_bytes()),
        "source_label_groups": len(source_groups),
        "exact_row_hash_and_label_matches": rows_checked,
        "ledger_group_candidate_digest_metadata": digest_report,
        "all_rows_have_unresolved_hold_values": True,
        "status_value_counts": dict.fromkeys(FIELDS, rows_checked),
        "limitations": [
            "All row dispositions remain unresolved/hold and do not grant any clearance.",
            "Older group-level candidate digests preserve the predecessor-candidate decision lineage; current rowrefs are independently checked against the current candidate.",
            "This audit does not bind source-specific lane-2 human decisions or establish source rights, privacy, clinical suitability, or provider-transfer permission.",
        ],
    }
    REPORT.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

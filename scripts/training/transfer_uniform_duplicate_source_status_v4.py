#!/usr/bin/env python3
"""Transfer uniform unresolved/hold dispositions across duplicate source groups.

This supplements the exact-unique v4 status transfer only where every possible
old source-ledger row for an exact candidate-hash/source-label group has the
same six disposition fields. It does not assert a unique historical row match
or grant rights, privacy, clinical, or provider-transfer clearance.
"""

from __future__ import annotations

import hashlib
import json
import os
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
OLD_CANDIDATE = ROOT / "ai/data/curated/recovery/gold-20261017/train_master_gold.recovered_candidate.jsonl"
OLD_LEDGER = ROOT / "docs/training/execution-2026-10-17/source-decision-ledger.jsonl"
CURRENT_CANDIDATE = ROOT / "ai/data/curated/sft_chatml/train_master_gold.jsonl"
GAP_ROWS = (
    ROOT
    / "ai/data/curated/recovery/gold-20261017/private-source-origin-binding-20261019/bindings/v4-untransferred-source-binding-gap-20261020.jsonl"
)
PRIVATE = ROOT / "ai/data/curated/recovery/gold-20261017/private-source-origin-binding-20261019/bindings"
OUTPUT = PRIVATE / "v4-untransferred-uniform-status-transfer-20261020.jsonl"
REPORT = PRIVATE / "v4-untransferred-uniform-status-transfer-20261020-report.json"
FIELDS = (
    "rights_status",
    "privacy_review_status",
    "authority_status",
    "training_eligibility",
    "family_manifest_status",
    "generic_license_status",
)
EXPECTED_HOLD = (
    "unresolved",
    "unverified",
    "awaiting_human_sign_off",
    "hold_pending_owner_rights_and_privacy_review",
    "proposed_not_ratified",
    "not_exact_row_clearance",
)


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_old_source_groups() -> tuple[dict[tuple[str, str], list[dict[str, Any]]], str, int]:
    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    candidate_digest = hashlib.sha256()
    ledger_refs: dict[int, tuple[str, str, dict[str, Any]]] = {}
    with OLD_LEDGER.open(encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, 1):
            entry = json.loads(line)
            source_label = entry.get("source_label")
            decision = entry.get("decision")
            rows = entry.get("candidate_rows")
            if not isinstance(source_label, str) or not isinstance(decision, dict) or not isinstance(rows, list):
                raise ValueError(f"invalid grouped ledger entry at line {line_number}")
            disposition = {field: decision.get(field) for field in FIELDS}
            for ref in rows:
                index = ref.get("row_number_1based")
                row_hash = ref.get("row_sha256")
                if not isinstance(index, int) or not isinstance(row_hash, str):
                    raise ValueError("ledger row reference lacks row number or hash")
                if index in ledger_refs:
                    raise ValueError("old source ledger repeats a candidate row number")
                ledger_refs[index] = (row_hash, source_label, disposition)

    candidate_count = 0
    with OLD_CANDIDATE.open("rb") as stream:
        for index, raw in enumerate(stream, 1):
            candidate_digest.update(raw)
            row = json.loads(raw)
            row_hash = sha256(raw[:-1] if raw.endswith(b"\n") else raw)
            ref = ledger_refs.get(index)
            if ref is None or ref[0] != row_hash or ref[1] != row.get("source"):
                raise ValueError("old candidate row and source-ledger reference disagree")
            groups[(row_hash, ref[1])].append({"row_number_1based": index, **ref[2]})
            candidate_count += 1
    if candidate_count != len(ledger_refs):
        raise ValueError("source ledger row references do not cover the old candidate")
    return groups, candidate_digest.hexdigest(), candidate_count


def load_current_gap() -> tuple[dict[int, dict[str, Any]], str]:
    rows: dict[int, dict[str, Any]] = {}
    digest = hashlib.sha256()
    with GAP_ROWS.open("rb") as stream:
        for raw in stream:
            digest.update(raw)
            row = json.loads(raw)
            index = row.get("candidate_row_1based")
            if not isinstance(index, int) or index in rows:
                raise ValueError("current gap sidecar has missing or duplicate row indices")
            rows[index] = row
    if len(rows) != 18:
        raise ValueError("expected exactly 18 unresolved book-row gaps")
    return rows, digest.hexdigest()


def build_transfer_rows(
    gap_rows: dict[int, dict[str, Any]],
    old_groups: dict[tuple[str, str], list[dict[str, Any]]],
) -> tuple[list[dict[str, Any]], dict[str, int], str]:
    wanted = set(gap_rows)
    digest = hashlib.sha256()
    output_rows = []
    candidate_count = 0
    with CURRENT_CANDIDATE.open("rb") as stream:
        for index, raw in enumerate(stream, 1):
            digest.update(raw)
            if index not in wanted:
                continue
            row = json.loads(raw)
            row_hash = sha256(raw[:-1] if raw.endswith(b"\n") else raw)
            gap = gap_rows[index]
            if row_hash != gap.get("candidate_record_sha256"):
                raise ValueError("current row hash disagrees with the private gap sidecar")
            label = row.get("source")
            if not isinstance(label, str) or hashlib.sha256(label.encode()).hexdigest() != gap.get(
                "source_label_sha256"
            ):
                raise ValueError("current source label disagrees with the private gap sidecar")
            old_matches = old_groups.get((row_hash, label), [])
            if len(old_matches) < 2:
                raise ValueError("untransferred row does not map to a duplicated old content+label group")
            dispositions = {tuple(match[field] for field in FIELDS) for match in old_matches}
            if len(dispositions) != 1:
                raise ValueError("duplicate old rows have conflicting source dispositions")
            disposition = dict(zip(FIELDS, next(iter(dispositions)), strict=True))
            if tuple(disposition[field] for field in FIELDS) != EXPECTED_HOLD:
                raise ValueError("source group does not carry the expected unresolved/hold disposition")
            output_rows.append(
                {
                    "current_candidate_row_1based": index,
                    "current_candidate_row_sha256": row_hash,
                    "source_label_sha256": gap["source_label_sha256"],
                    "source_decision_group_sha256": hashlib.sha256((row_hash + "\0" + label).encode()).hexdigest(),
                    "old_matching_candidate_rows": [m["row_number_1based"] for m in old_matches],
                    "old_matching_candidate_row_count": len(old_matches),
                    "old_disposition_variants": 1,
                    "transfer_basis": "all exact content+source-label matches share one identical disposition tuple; historical row identity remains ambiguous",
                    **disposition,
                }
            )
            candidate_count += 1
    if candidate_count != len(wanted):
        raise ValueError("current candidate is missing one or more gap rows")
    counts = dict(sorted(Counter(row["old_matching_candidate_row_count"] for row in output_rows).items()))
    if counts != {2: 10, 4: 8}:
        raise ValueError(f"old duplicate-group multiplicities changed: {counts}")
    return output_rows, counts, digest.hexdigest()


def main() -> int:
    old_groups, old_candidate_digest, old_count = load_old_source_groups()
    gaps, gap_digest = load_current_gap()
    output_rows, multiplicities, current_candidate_digest = build_transfer_rows(gaps, old_groups)
    payload = "".join(json.dumps(row, sort_keys=True) + "\n" for row in output_rows).encode()
    PRIVATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(PRIVATE, 0o700)
    OUTPUT.write_bytes(payload)
    os.chmod(OUTPUT, 0o600)
    report = {
        "schema": "v4-untransferred-uniform-source-status-transfer-v1",
        "created_at_utc": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "old_candidate_sha256": old_candidate_digest,
        "old_candidate_rows": old_count,
        "current_candidate_sha256": current_candidate_digest,
        "current_candidate_rows": 190244,
        "gap_sidecar_sha256": gap_digest,
        "transferred_rows": len(output_rows),
        "old_duplicate_group_multiplicities": multiplicities,
        "uniform_disposition_groups": len(output_rows),
        "all_transferred_dispositions": dict(zip(FIELDS, EXPECTED_HOLD, strict=True)),
        "sidecar_path": OUTPUT.relative_to(ROOT).as_posix(),
        "sidecar_sha256": sha256(payload),
        "sidecar_mode": "0600",
        "limitations": [
            "This assigns only the identical unresolved/hold source decision shared by every duplicate hash+label match.",
            "It does not resolve historical source-row identity or local book-file ambiguity.",
            "It does not grant rights, privacy, consent, clinical, training, or provider-transfer clearance.",
            "No current candidate, release, training payload, or provider job was modified.",
        ],
    }
    encoded_report = (json.dumps(report, indent=2, sort_keys=True) + "\n").encode()
    REPORT.write_bytes(encoded_report)
    os.chmod(REPORT, 0o600)
    print(
        json.dumps(
            {
                k: report[k]
                for k in ("transferred_rows", "old_duplicate_group_multiplicities", "sidecar_sha256", "sidecar_path")
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

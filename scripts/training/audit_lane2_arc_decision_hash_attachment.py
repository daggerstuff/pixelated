#!/usr/bin/env python3
"""Attach ARC-ID-keyed lane-2 decisions to current v4 content hashes.

This is a post-hoc technical join only. The review files do not pin the ARC
revision they assessed, so this script must not be used to claim the human
decision was made on the current payload or to alter release eligibility.
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from training.consolidate_arc_corpus import _session_messages

ROOT = Path(__file__).resolve().parents[2]
ARC_DIR = ROOT / "ai/training/output/arc_corpus"
RECOVERY = ROOT / "ai/data/curated/recovery/gold-20261017"
LINEAGE_DIR = RECOVERY / "private-v4-arc-lineage-20261019"
ROWREFS = LINEAGE_DIR / "v4-arc-rowrefs.jsonl"
OUTPUT_DIR = RECOVERY / "private-lane2-current-content-attachment-20261020"
SIDECAR = OUTPUT_DIR / "lane2-current-content-attachment.jsonl"
REPORT = OUTPUT_DIR / "report.json"
PUBLIC_REPORT = ROOT / "docs/training/execution-2026-10-19/lane2-current-content-hash-attachment-2026-10-20.md"
REVIEW_REFERENCE_SNAPSHOTS = {
    "lane2_manual_review_20260919.json": (
        ARC_DIR / ".pre_reaudit37_20260920/arc_records.jsonl",
        "nearest preserved later snapshot; not a review-time pin",
    ),
    "lane2_manual_review_20260927.json": (
        ARC_DIR / ".pre_lane2apply_20260928/arc_records.jsonl",
        "pre-apply snapshot; review-time pin still absent",
    ),
    "lane2_manual_review_20261004.json": (
        ARC_DIR / "backups/audit_prep_20261016/arc_records.jsonl",
        "later audit-preparation snapshot; no contemporaneous snapshot located",
    ),
    "lane2_manual_review_20261005.json": (
        ARC_DIR / "backups/audit_prep_20261016/arc_records.jsonl",
        "later audit-preparation snapshot; no contemporaneous snapshot located",
    ),
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def archive_message_hashes(path: Path, selected_arc_ids: set[str]) -> tuple[dict[str, dict[str, str]], set[str]]:
    result: dict[str, dict[str, str]] = {}
    unrenderable: set[str] = set()
    for arc in jsonl(path):
        arc_id = str(arc.get("arc_id", ""))
        if not arc_id or arc_id not in selected_arc_ids:
            continue
        hashes: dict[str, str] = {}
        for session in arc.get("sessions") or []:
            try:
                messages = _session_messages(session)
            except KeyError, TypeError, ValueError:
                unrenderable.add(arc_id)
                break
            canonical = json.dumps(messages, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
            hashes[str(session.get("n", ""))] = sha256_bytes(canonical.encode("utf-8"))
        if arc_id not in unrenderable:
            result[arc_id] = hashes
    return result, unrenderable


def write_private_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as stream:
        for row in rows:
            stream.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    path.chmod(0o600)


def load_review_decisions() -> tuple[dict[str, dict[str, Any]], list[dict[str, str]]]:
    review_files = sorted(ARC_DIR.glob("lane2_manual_review_*.json"))
    if len(review_files) != len(REVIEW_REFERENCE_SNAPSHOTS):
        raise RuntimeError(f"unexpected lane-2 review file count: {len(review_files)}")
    latest: dict[str, dict[str, Any]] = {}
    inputs = []
    for path in review_files:
        review = json.loads(path.read_text(encoding="utf-8"))
        digest = sha256_file(path)
        relative = str(path.relative_to(ROOT))
        inputs.append({"path": relative, "sha256": digest})
        for arc_id, verdict in review.get("verdicts", {}).items():
            latest[str(arc_id)] = {
                "review_date": str(review.get("date", "")),
                "review_file": relative,
                "review_file_sha256": digest,
                "verdict": str(verdict.get("verdict", "")),
            }
    return latest, inputs


def audit_version_drift(
    latest: dict[str, dict[str, Any]], per_arc: dict[str, list[dict[str, Any]]]
) -> dict[str, dict[str, Any]]:
    current_hashes = {
        arc_id: {str(row["session_n"]): str(row["messages_sha256"]) for row in rows} for arc_id, rows in per_arc.items()
    }
    results = {}
    for review_file, (snapshot_path, relation) in REVIEW_REFERENCE_SNAPSHOTS.items():
        if not snapshot_path.is_file():
            raise RuntimeError(f"missing review reference snapshot: {snapshot_path}")
        review = json.loads((ARC_DIR / review_file).read_text(encoding="utf-8"))
        decisions = {
            str(arc_id): {"verdict": str(verdict.get("verdict", ""))}
            for arc_id, verdict in review.get("verdicts", {}).items()
        }
        historic, unrenderable = archive_message_hashes(snapshot_path, set(decisions))
        stable: Counter[str] = Counter()
        drifted: Counter[str] = Counter()
        unrenderable_decisions: Counter[str] = Counter()
        stable_rows = drifted_rows = 0
        for arc_id, decision in decisions.items():
            if arc_id not in per_arc:
                raise RuntimeError(f"review ARC ID missing from current-v4 lineage: {arc_id}")
            if arc_id in unrenderable:
                unrenderable_decisions[decision["verdict"]] += 1
                continue
            if arc_id not in historic:
                raise RuntimeError(f"review ARC ID missing from comparison snapshot: {arc_id}")
            same = all(
                historic[arc_id].get(session_n) == messages_hash
                for session_n, messages_hash in current_hashes[arc_id].items()
            )
            (stable if same else drifted)[decision["verdict"]] += 1
            if same:
                stable_rows += len(per_arc[arc_id])
            else:
                drifted_rows += len(per_arc[arc_id])
        results[review_file] = {
            "snapshot_path": str(snapshot_path.relative_to(ROOT)),
            "snapshot_sha256": sha256_file(snapshot_path),
            "snapshot_mtime_utc": datetime.fromtimestamp(snapshot_path.stat().st_mtime, timezone.utc).isoformat(),
            "relation": relation,
            "arc_counts_same_as_current_candidate": dict(stable),
            "arc_counts_different_from_current_candidate": dict(drifted),
            "arc_counts_unrenderable_in_snapshot": dict(unrenderable_decisions),
            "candidate_rows_same_as_snapshot": stable_rows,
            "candidate_rows_different_from_snapshot": drifted_rows,
        }
        latest_decisions = {
            arc_id: decision for arc_id, decision in latest.items() if decision["review_file"].endswith(review_file)
        }
        latest_stable: Counter[str] = Counter()
        latest_drifted: Counter[str] = Counter()
        latest_stable_rows = latest_drifted_rows = 0
        for arc_id, decision in latest_decisions.items():
            same = (
                arc_id not in unrenderable
                and arc_id in historic
                and all(
                    historic[arc_id].get(session_n) == messages_hash
                    for session_n, messages_hash in current_hashes[arc_id].items()
                )
            )
            (latest_stable if same else latest_drifted)[decision["verdict"]] += 1
            if same:
                latest_stable_rows += len(per_arc[arc_id])
            else:
                latest_drifted_rows += len(per_arc[arc_id])
        results[review_file]["latest_decisions"] = {
            "arc_counts_same_as_reference_snapshot": dict(latest_stable),
            "arc_counts_different_or_unrenderable": dict(latest_drifted),
            "candidate_rows_same_as_reference_snapshot": latest_stable_rows,
            "candidate_rows_different_or_unrenderable": latest_drifted_rows,
        }
    return results


def attach_rows(
    latest: dict[str, dict[str, Any]], per_arc: dict[str, list[dict[str, Any]]]
) -> tuple[list[dict[str, Any]], Counter[tuple[str, bool]], Counter[tuple[str, bool]], Counter[str]]:
    attached = []
    arc_counts: Counter[tuple[str, bool]] = Counter()
    row_counts: Counter[tuple[str, bool]] = Counter()
    conflict_splits: Counter[str] = Counter()
    for arc_id, decision in sorted(latest.items()):
        rows = per_arc[arc_id]
        machine_verdicts = {str(row["archive_audit_verdict"]) for row in rows}
        if len(machine_verdicts) != 1:
            raise RuntimeError(f"inconsistent machine verdicts for ARC ID {arc_id}")
        conflict = decision["verdict"] == "reject" and machine_verdicts == {"accept"}
        arc_counts[(decision["verdict"], conflict)] += 1
        row_counts[(decision["verdict"], conflict)] += len(rows)
        if conflict:
            conflict_splits.update(str(row["provisional_split"]) for row in rows)
        for row in rows:
            attached.append(
                {
                    "review_date": decision["review_date"],
                    "review_file": decision["review_file"],
                    "review_file_sha256": decision["review_file_sha256"],
                    "review_verdict": decision["verdict"],
                    "arc_id": arc_id,
                    "candidate_row_number_1based": row["candidate_row_number_1based"],
                    "candidate_row_sha256": row["candidate_row_sha256"],
                    "messages_sha256": row["messages_sha256"],
                    "split": row["provisional_split"],
                    "archive_sha256": row["archive_sha256"],
                    "binding_status": "post_hoc_arc_id_join_reviewed_revision_unpinned",
                }
            )
    return attached, arc_counts, row_counts, conflict_splits


def main() -> None:
    candidate_report = json.loads((LINEAGE_DIR / "report.json").read_text(encoding="utf-8"))
    archive_path = LINEAGE_DIR / "arc_records.snapshot.jsonl"
    if sha256_file(archive_path) != candidate_report["private_archive_snapshot_sha256"]:
        raise RuntimeError("ARC archive snapshot hash differs from its lineage report")
    if sha256_file(ROWREFS) != candidate_report["private_rowref_sidecar_sha256"]:
        raise RuntimeError("ARC rowref sidecar hash differs from its lineage report")

    latest, review_inputs = load_review_decisions()
    rowrefs = jsonl(ROWREFS)
    per_arc: dict[str, list[dict[str, Any]]] = {}
    for row in rowrefs:
        per_arc.setdefault(str(row["arc_id"]), []).append(row)
    missing = sorted(set(latest) - set(per_arc))
    if missing:
        raise RuntimeError(f"reviewed ARC IDs missing from current-v4 lineage: {len(missing)}")
    version_drift = audit_version_drift(latest, per_arc)
    attached, arc_counts, row_counts, conflict_split_rows = attach_rows(latest, per_arc)

    if OUTPUT_DIR.exists() and (OUTPUT_DIR.stat().st_mode & 0o777) != 0o700:
        raise RuntimeError("private output directory permissions changed")
    OUTPUT_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    write_private_jsonl(SIDECAR, attached)

    report = {
        "schema_version": 1,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "scope": "Hash-only post-hoc attachment of ARC-ID-keyed lane-2 decisions to current v4 rowrefs; not proof of reviewed revision.",
        "review_inputs": review_inputs,
        "current_archive_snapshot_sha256": candidate_report["private_archive_snapshot_sha256"],
        "current_arc_lineage_rowref_sha256": candidate_report["private_rowref_sidecar_sha256"],
        "unique_reviewed_arc_ids": len(latest),
        "current_candidate_rows_attached": len(attached),
        "verdict_arc_counts": dict(Counter(item["verdict"] for item in latest.values())),
        "verdict_candidate_row_counts": dict(Counter(row["review_verdict"] for row in attached)),
        "rejected_arc_ids_with_machine_accept": arc_counts[("reject", True)],
        "rejected_candidate_rows_with_machine_accept": row_counts[("reject", True)],
        "rejected_candidate_rows_by_split": dict(conflict_split_rows),
        "version_drift_comparisons": version_drift,
        "sidecar": {
            "path": str(SIDECAR.relative_to(ROOT)),
            "rows": len(attached),
            "sha256": sha256_file(SIDECAR),
        },
        "limitations": [
            "Review records contain ARC IDs and verdicts but no reviewed content digest or immutable ARC revision identifier.",
            "The ARC ID join is therefore post hoc and does not establish that the reviewer saw the currently frozen messages.",
            "Reject verdicts paired with machine-accept candidate rows are surfaced as conflicts and are not silently applied.",
            "No dialogue, reviewer rationale, PHI, candidate payload, or provider state is written or changed.",
        ],
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    REPORT.chmod(0o600)
    OUTPUT_DIR.chmod(0o700)
    accepted_arcs = arc_counts[("accept", False)] + arc_counts[("accept", True)]
    rejected_arcs = arc_counts[("reject", False)] + arc_counts[("reject", True)]
    rejected_conflicts = arc_counts[("reject", True)]
    rejected_conflict_rows = row_counts[("reject", True)]
    PUBLIC_REPORT.write_text(
        "# Lane-2 review to current ARC content hash attachment — 2026-10-20\n\n"
        f"The four lane-2 review artifacts contain {len(latest)} unique ARC IDs. Their decisions can be joined to "
        f"{len(attached)} current-v4 ARC candidate rows, each with exact candidate-row and canonical-message hashes, "
        f"through the existing archive lineage. This is a hash-only post-hoc attachment, not proof that the reviewer "
        "saw the current frozen revision: the original review records contain no content digest or immutable revision key.\n\n"
        f"The latest recorded decisions are {accepted_arcs} accepts "
        f"and {rejected_arcs} rejects. "
        f"{rejected_conflicts} rejected ARC IDs ({rejected_conflict_rows} candidate rows; "
        f"split counts: {dict(conflict_split_rows)}) "
        "currently have machine-accept archive status. This is a concrete unresolved conflict; no reject was silently "
        "transferred and the candidate/provider job were left unchanged. The ARC rowref sidecar already proves each "
        "current candidate row exactly reproduces its canonical archive session, so the row hashes are suitable for "
        "a targeted reviewer-version reconciliation or explicit disposition.\n\n"
        f"Available-snapshot version checks found: Sept. 19 decisions, "
        f"{sum(version_drift['lane2_manual_review_20260919.json']['arc_counts_same_as_current_candidate'].values())}/10 ARC payloads match the nearest preserved later snapshot; "
        f"Sept. 27, {sum(version_drift['lane2_manual_review_20260927.json']['arc_counts_same_as_current_candidate'].values())}/12 match the pre-apply snapshot; "
        f"Oct. 4, {sum(version_drift['lane2_manual_review_20261004.json']['arc_counts_same_as_current_candidate'].values())}/1 match the later Oct. 16 snapshot; "
        f"Oct. 5, {sum(version_drift['lane2_manual_review_20261005.json']['arc_counts_same_as_current_candidate'].values())}/60 match that same later snapshot. "
        "These comparisons measure version drift against surviving files only; none pins the original review request. "
        f"Among latest decisions, all {version_drift['lane2_manual_review_20260919.json']['latest_decisions']['arc_counts_same_as_reference_snapshot'].get('reject', 0)} Sept. 19 rejects match their nearest later snapshot, and all {version_drift['lane2_manual_review_20261005.json']['latest_decisions']['arc_counts_same_as_reference_snapshot'].get('reject', 0)} Oct. 5 rejects match the later Oct. 16 snapshot. The latter accounts for 25 of the 27 current reject ARC IDs; the two Sept. 19 rejects account for the rest. This supports a separate sensitivity comparison, while original review-time hashes remain unpinned.\n\n"
        "The private hash-only row map and full aggregate report are stored under "
        "`ai/data/curated/recovery/gold-20261017/private-lane2-current-content-attachment-20261020/` "
        "with restrictive permissions. No dialogue or reviewer rationale is included.\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "unique_reviewed_arc_ids": len(latest),
                "candidate_rows_attached": len(attached),
                "reject_machine_accept_arc_ids": arc_counts[("reject", True)],
                "reject_machine_accept_candidate_rows": row_counts[("reject", True)],
                "sidecar_sha256": report["sidecar"]["sha256"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

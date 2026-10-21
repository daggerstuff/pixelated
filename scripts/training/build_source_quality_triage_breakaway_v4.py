#!/usr/bin/env python3
"""Build a local transformed release applying the 50 dialogue repairs.

The full v4 release remains the authorized baseline. This view only separates
the mechanically identified source-quality triage examples from its mixed
research corpus; it does not grant rights, clinical, or transfer clearance.
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
RECOVERY = ROOT / "ai/data/curated/recovery/gold-20261017"
SOURCE = RECOVERY / "wandb-full-corpus-current-master-20261019-v4"
SOURCE_MANIFEST_PATH = ROOT / "docs/training/execution-2026-10-19/wandb-full-corpus-current-master-20261019-v4.json"
SOURCE_STATUS_LEDGER = (
    ROOT / "docs/training/execution-2026-10-17/current-master-source-decision-ledger-2026-10-19-v4.jsonl"
)
SOURCE_STATUS_AUDIT = (
    ROOT / "docs/training/execution-2026-10-19/current-master-source-status-ledger-audit-2026-10-20.json"
)
REPAIR_PATH = RECOVERY / "wandb-full-corpus-repairs-20261019-v3/row_repairs.jsonl"
GENERATED_LINEAGE_REPORT = (
    RECOVERY
    / "private-source-adapter-enrichment-20261019/psy-insight-exact-binding-20261019/generated-continuation-lineage-report.json"
)
GENERATED_LINEAGE_SIDECAR = (
    RECOVERY
    / "private-source-adapter-enrichment-20261019/psy-insight-exact-binding-20261019/generated-continuation-source-rowrefs.jsonl"
)
OUTPUT = RECOVERY / "wandb-full-corpus-repaired-dialogue-breakaway-20261020-v2"
SPLITS = ("train", "validation", "test")
STATUS_FIELDS = (
    "rights_status",
    "privacy_review_status",
    "authority_status",
    "training_eligibility",
    "family_manifest_status",
    "generic_license_status",
)
EXPECTED_STATUS = {
    "rights_status": "unresolved",
    "privacy_review_status": "unverified",
    "authority_status": "awaiting_human_sign_off",
    "training_eligibility": "hold_pending_owner_rights_and_privacy_review",
    "family_manifest_status": "proposed_not_ratified",
    "generic_license_status": "not_exact_row_clearance",
}


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_messages_hash(messages: list[dict[str, Any]]) -> str:
    payload = json.dumps(messages, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return sha256_bytes(payload.encode("utf-8"))


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def verify_status_ledger(candidate_path: Path, candidate_digest: str, candidate_rows: int) -> dict[str, Any]:
    audit = json.loads(SOURCE_STATUS_AUDIT.read_text(encoding="utf-8"))
    if audit["candidate_sha256"] != candidate_digest or audit["candidate_rows"] != candidate_rows:
        raise RuntimeError("source-status audit does not name the current candidate")
    if sha256_file(SOURCE_STATUS_LEDGER) != audit["ledger_sha256"]:
        raise RuntimeError("source-status ledger digest differs from its audit")

    refs: dict[int, tuple[str, str]] = {}
    for line_number, entry in enumerate(read_jsonl(SOURCE_STATUS_LEDGER), start=1):
        decision = entry.get("decision")
        rows = entry.get("candidate_rows")
        if not isinstance(decision, dict) or any(decision.get(key) != EXPECTED_STATUS[key] for key in STATUS_FIELDS):
            raise RuntimeError(f"unexpected source decision at ledger group {line_number}")
        for row_ref in rows or []:
            index = row_ref["row_number_1based"]
            if index in refs:
                raise RuntimeError("source-status ledger contains duplicate candidate row references")
            refs[index] = (row_ref["row_sha256"], entry["source_label"])
    if len(refs) != candidate_rows:
        raise RuntimeError("source-status ledger does not cover every current candidate row")

    checked = 0
    with candidate_path.open("rb") as stream:
        for index, raw in enumerate(stream, start=1):
            row = json.loads(raw)
            expected = refs.get(index)
            digest = sha256_bytes(raw[:-1] if raw.endswith(b"\n") else raw)
            if expected != (digest, row.get("source")):
                raise RuntimeError(f"source-status row binding mismatch at candidate row {index}")
            checked += 1
    if checked != candidate_rows:
        raise RuntimeError("candidate count changed during source-status verification")
    return {"ledger_sha256": audit["ledger_sha256"], "rows_exactly_bound": checked, "dispositions": EXPECTED_STATUS}


def validate_inputs() -> tuple[
    dict[str, Any], list[dict[str, Any]], set[int], dict[int, dict[str, Any]], dict[str, Any]
]:
    manifest = json.loads(SOURCE_MANIFEST_PATH.read_text(encoding="utf-8"))
    if manifest["release_id"] != "wandb-full-corpus-current-master-20261019-v4":
        raise RuntimeError("unexpected full-corpus source release")
    candidate = ROOT / manifest["source_candidate"]["path"]
    candidate_digest = sha256_file(candidate)
    candidate_rows = sum(1 for _ in candidate.open("rb"))
    if (
        candidate_digest != manifest["source_candidate_sha256"]
        or candidate_rows != manifest["source_candidate"]["row_count"]
    ):
        raise RuntimeError("current candidate differs from the frozen v4 manifest")

    for split in SPLITS:
        details = manifest["partitions"][split]
        payload = ROOT / details["path"]
        if sha256_file(payload) != details["sha256"] or sum(1 for _ in payload.open("rb")) != details["row_count"]:
            raise RuntimeError(f"frozen v4 {split} payload differs from its manifest")

    repair_digest = sha256_file(REPAIR_PATH)
    if repair_digest != manifest["repairs"]["sha256"]:
        raise RuntimeError("repair overlay differs from the frozen v4 manifest")
    repairs = read_jsonl(REPAIR_PATH)
    if len(repairs) != 52 or len(repairs) != manifest["repairs"]["row_count"]:
        raise RuntimeError("repair overlay count differs from the frozen v4 manifest")
    repairs_by_row = {int(row["candidate_row_number_1based"]): row for row in repairs}
    if len(repairs_by_row) != len(repairs):
        raise RuntimeError("repair overlay repeats a candidate row number")
    repair_kinds = Counter(row["repair_kind"] for row in repairs)
    if repair_kinds != Counter(
        {"source_dialogue_recovery_with_generated_continuation": 50, "source_quality_triage_reconstruction": 2}
    ):
        raise RuntimeError(f"unexpected repair kinds: {dict(repair_kinds)}")

    status = verify_status_ledger(candidate, candidate_digest, candidate_rows)
    source_internal = read_jsonl(SOURCE / "manifest_internal.jsonl")
    source_rowrefs = read_jsonl(SOURCE / "rowrefs.jsonl")
    if len(source_internal) != candidate_rows or len(source_rowrefs) != candidate_rows:
        raise RuntimeError("v4 internal manifest/rowrefs do not cover the candidate")

    exclude = {
        number for number, row in repairs_by_row.items() if row["repair_kind"] == "source_quality_triage_reconstruction"
    }
    if len(exclude) != 2:
        raise RuntimeError("expected exactly two source-quality triage rows")

    generated_report = json.loads(GENERATED_LINEAGE_REPORT.read_text(encoding="utf-8"))
    generated_rows = read_jsonl(GENERATED_LINEAGE_SIDECAR)
    generated_digest = sha256_file(GENERATED_LINEAGE_SIDECAR)
    if (
        generated_digest != generated_report["sidecar_sha256"]
        or generated_report["candidate_sha256"] != candidate_digest
    ):
        raise RuntimeError("generated-continuation lineage sidecar does not match its v4 report")
    if len(generated_rows) != 50 or generated_report["generated_continuation_rows_bound_by_unique_case_id"] != 50:
        raise RuntimeError("generated-continuation lineage does not cover all 50 continuation repairs")
    if generated_report["exact_case_id_multiplicity"] != {"unique": 50, "unresolved": 0}:
        raise RuntimeError("generated-continuation source case IDs are not all unique")
    generated_by_row = {int(row["candidate_row_number_1based"]): row for row in generated_rows}
    generated_locators = {
        (row["source_file_sha256"], int(row["upstream_line_number_1based"])) for row in generated_rows
    }
    if len(generated_by_row) != 50 or len(generated_locators) != 50:
        raise RuntimeError("generated-continuation source excerpt locators are not unique")
    expected_upstream_revision = "dd6f2e582377ddb71e976ec8f45ad48b5c5fc57a"
    if any(row["upstream_revision"] != expected_upstream_revision for row in generated_rows):
        raise RuntimeError("generated-continuation source revision differs from the pinned report")

    actual_candidate_digest = hashlib.sha256()
    repair_bindings = 0
    with candidate.open("rb") as stream:
        for index, raw in enumerate(stream, start=1):
            actual_candidate_digest.update(raw)
            row = json.loads(raw)
            raw_hash = sha256_bytes(raw[:-1] if raw.endswith(b"\n") else raw)
            meta = source_internal[index - 1]
            ref = source_rowrefs[index - 1]
            if meta["candidate_row_number_1based"] != index or ref["candidate_row_number_1based"] != index:
                raise RuntimeError(f"v4 row ordering differs at row {index}")
            if meta["candidate_row_sha256"] != raw_hash or ref["candidate_row_sha256"] != raw_hash:
                raise RuntimeError(f"v4 release row hash mismatch at row {index}")
            if meta["source_label"] != row.get("source"):
                raise RuntimeError(f"v4 release source label mismatch at row {index}")
            if ref["content_group_sha256"] != meta["content_group_sha256"] or ref["provisional_split"] != meta["split"]:
                raise RuntimeError(f"v4 rowref metadata mismatch at row {index}")
            repair = repairs_by_row.get(index)
            if repair is not None:
                if repair["candidate_row_sha256"] != raw_hash:
                    raise RuntimeError(f"repair overlay hash mismatch at row {index}")
                repair_bindings += 1
            generated = generated_by_row.get(index)
            if generated is not None and generated["candidate_row_sha256"] != raw_hash:
                raise RuntimeError(f"generated-continuation lineage hash mismatch at row {index}")
    if actual_candidate_digest.hexdigest() != candidate_digest or repair_bindings != 52:
        raise RuntimeError("candidate or repair-row verification did not complete")

    if set(generated_by_row) != {
        number
        for number, row in repairs_by_row.items()
        if row["repair_kind"] == "source_dialogue_recovery_with_generated_continuation"
    }:
        raise RuntimeError("generated-continuation lineage does not align to the 50 repair-overlay rows")
    for split in SPLITS:
        split_metas = [row for row in source_internal if row["split"] == split]
        payload = ROOT / manifest["partitions"][split]["path"]
        with payload.open("rb") as stream:
            for index, (raw, meta) in enumerate(zip(stream, split_metas, strict=True), start=1):
                item = json.loads(raw)
                if canonical_messages_hash(item["messages"]) != meta["content_group_sha256"]:
                    raise RuntimeError(f"frozen {split} payload differs from its internal manifest at row {index}")

    for number, lineage in generated_by_row.items():
        repair = repairs_by_row[number]
        source_id_hash = sha256_bytes(str(repair["source_dialogue_id"]).encode("utf-8"))
        meta = source_internal[number - 1]
        if lineage["source_dialogue_id_sha256"] != source_id_hash or lineage["v4_split"] != meta["split"]:
            raise RuntimeError(f"generated-continuation source locator does not bind to repair row {number}")
        if lineage["candidate_row_sha256"] != repair["candidate_row_sha256"]:
            raise RuntimeError(f"generated-continuation candidate hash differs at row {number}")

    return (
        manifest,
        source_internal,
        exclude,
        repairs_by_row,
        {
            "candidate_sha256": candidate_digest,
            "candidate_rows": candidate_rows,
            "repair_sha256": repair_digest,
            "repair_rows": len(repairs),
            "repair_kinds": dict(repair_kinds),
            "repair_rows_bound": repair_bindings,
            "generated_continuation_rows_bound": len(generated_by_row),
            "generated_continuation_lineage_sha256": generated_digest,
            "generated_upstream_revision": expected_upstream_revision,
            "source_excerpt_locators_unique": len(generated_locators),
            "source_status": status,
        },
    )


def build(
    manifest: dict[str, Any],
    internal: list[dict[str, Any]],
    exclude: set[int],
    repairs_by_row: dict[int, dict[str, Any]],
    checks: dict[str, Any],
) -> dict[str, Any]:
    if OUTPUT.exists():
        raise RuntimeError(f"refusing to overwrite existing breakaway output: {OUTPUT}")
    OUTPUT.mkdir(mode=0o700, parents=True)
    split_counts: Counter[str] = Counter()
    excluded_by_split: Counter[str] = Counter()
    split_groups: dict[str, set[str]] = {split: set() for split in SPLITS}
    split_outputs: dict[str, Any] = {}

    repair_rows = {number: row for number, row in repairs_by_row.items() if number not in exclude}
    for split in SPLITS:
        metas = [row for row in internal if row["split"] == split]
        payload_path = ROOT / manifest["partitions"][split]["path"]
        output_payload = OUTPUT / f"{split}.jsonl"
        output_internal = OUTPUT / f"{split}-manifest_internal.jsonl"
        output_refs = OUTPUT / f"{split}-rowrefs.jsonl"
        payload_hash = hashlib.sha256()
        internal_hash = hashlib.sha256()
        refs_hash = hashlib.sha256()
        with payload_path.open("rb") as source_stream, output_payload.open("wb") as payload_out:
            with output_internal.open("wb") as internal_out, output_refs.open("wb") as refs_out:
                for raw, meta in zip(source_stream, metas, strict=True):
                    row_number = int(meta["candidate_row_number_1based"])
                    payload_row = json.loads(raw)
                    if canonical_messages_hash(payload_row["messages"]) != meta["content_group_sha256"]:
                        raise RuntimeError(f"source payload and internal manifest differ at candidate row {row_number}")
                    ref = {
                        "candidate_row_number_1based": row_number,
                        "candidate_row_sha256": meta["candidate_row_sha256"],
                        "content_group_sha256": meta["content_group_sha256"],
                        "source_label": meta["source_label"],
                        "split": split,
                    }
                    if row_number in exclude:
                        excluded_by_split[split] += 1
                        continue
                    transformed = dict(payload_row)
                    repair = repair_rows.get(row_number)
                    if repair is not None:
                        transformed["messages"] = repair["messages"]
                    transformed_raw = (
                        json.dumps(transformed, ensure_ascii=False, separators=(",", ":")) + "\n"
                    ).encode("utf-8")
                    transformed_digest = sha256_bytes(transformed_raw[:-1])
                    ref["transformed_payload_sha256"] = transformed_digest
                    payload_out.write(transformed_raw)
                    payload_hash.update(transformed_raw)
                    output_meta = dict(meta)
                    output_meta["content_group_sha256"] = canonical_messages_hash(transformed["messages"])
                    output_meta["transformed_payload_sha256"] = transformed_digest
                    output_meta["transformation"] = (
                        "repair_overlay_messages" if repair is not None else "unchanged_v4_payload"
                    )
                    internal_line = (json.dumps(output_meta, ensure_ascii=False, separators=(",", ":")) + "\n").encode(
                        "utf-8"
                    )
                    refs_line = (json.dumps(ref, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
                    internal_out.write(internal_line)
                    refs_out.write(refs_line)
                    internal_hash.update(internal_line)
                    refs_hash.update(refs_line)
                    split_groups[split].add(str(meta["content_group_sha256"]))
                    split_counts[split] += 1
        for path in (output_payload, output_internal, output_refs):
            path.chmod(0o600)
        split_outputs[split] = {
            "payload": {
                "path": output_payload.name,
                "rows": split_counts[split],
                "bytes": output_payload.stat().st_size,
                "sha256": payload_hash.hexdigest(),
            },
            "internal_manifest": {
                "path": output_internal.name,
                "rows": split_counts[split],
                "sha256": internal_hash.hexdigest(),
            },
            "rowrefs": {"path": output_refs.name, "rows": split_counts[split], "sha256": refs_hash.hexdigest()},
        }

    intersections = {
        f"{left}:{right}": len(split_groups[left] & split_groups[right])
        for i, left in enumerate(SPLITS)
        for right in SPLITS[i + 1 :]
    }
    if any(intersections.values()):
        raise RuntimeError(f"breakaway release has split content-group intersections: {intersections}")

    heldout = OUTPUT / "heldout.jsonl"
    heldout.write_bytes(b"")
    heldout.chmod(0o600)
    included_repairs = Counter(row["repair_kind"] for number, row in repairs_by_row.items() if number not in exclude)
    release = {
        "schema_version": 1,
        "release_id": "wandb-full-corpus-repaired-dialogue-breakaway-20261020-v2",
        "status": "local_research_sensitivity_only",
        "upload_gate": False,
        "source_release_id": manifest["release_id"],
        "source_release_manifest_sha256": sha256_file(SOURCE_MANIFEST_PATH),
        "source_candidate_sha256": checks["candidate_sha256"],
        "source_candidate_rows": checks["candidate_rows"],
        "source_status": checks["source_status"],
        "repair_overlay_sha256": checks["repair_sha256"],
        "repair_overlay_rows": checks["repair_rows"],
        "repair_rows_bound_to_current_candidate": checks["repair_rows_bound"],
        "generated_continuation_rows_bound_to_source_excerpts": checks["generated_continuation_rows_bound"],
        "generated_continuation_lineage_sha256": checks["generated_continuation_lineage_sha256"],
        "generated_continuation_upstream_revision": checks["generated_upstream_revision"],
        "generated_continuation_source_excerpt_locators_unique": checks["source_excerpt_locators_unique"],
        "included_repair_rows_by_kind": dict(included_repairs),
        "replacement_rule": "For the 50 source_dialogue_recovery_with_generated_continuation rows, replace messages with the pinned repair-overlay messages while retaining their frozen v4 split and all other payload fields; exclude only the two source_quality_triage_reconstruction rows.",
        "excluded_rows": sum(excluded_by_split.values()),
        "excluded_rows_by_split": dict(excluded_by_split),
        "retained_rows": sum(split_counts.values()),
        "split_counts": dict(split_counts),
        "split_payloads": split_outputs,
        "cross_split_content_group_intersections": intersections,
        "limitations": [
            "This sensitivity view does not replace or reduce the user-directed full-corpus v4 baseline.",
            "All retained candidate rows remain covered only by the unresolved/hold source-status dispositions in the linked ledger.",
            "The 50 generated continuations have source-excerpt lineage but are not upstream response targets and have not received human clinical review.",
            "The two excluded rows are synthetic source-quality triage examples and do not establish clinical-response task fit.",
            "No rights, privacy, consent, clinical-suitability, or provider-transfer clearance is inferred; no provider upload or job is authorized by this local variant.",
        ],
    }
    manifest_path = OUTPUT / "release-manifest.json"
    manifest_path.write_text(json.dumps(release, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    manifest_path.chmod(0o600)
    release_hash = sha256_file(manifest_path)
    summary = {
        "release_manifest_sha256": release_hash,
        "candidate_sha256": checks["candidate_sha256"],
        "candidate_rows": checks["candidate_rows"],
        "repair_sha256": checks["repair_sha256"],
        "repair_rows": checks["repair_rows"],
        "repair_rows_bound": checks["repair_rows_bound"],
        "excluded_rows": sum(excluded_by_split.values()),
        "excluded_rows_by_split": dict(excluded_by_split),
        "retained_rows": sum(split_counts.values()),
        "split_counts": dict(split_counts),
        "cross_split_content_group_intersections": intersections,
        "upload_gate": False,
    }
    summary_path = OUTPUT / "build-summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    summary_path.chmod(0o600)
    OUTPUT.chmod(0o700)
    print(json.dumps(summary, indent=2, sort_keys=True))
    return summary


def main() -> None:
    manifest, internal, exclude, repairs_by_row, checks = validate_inputs()
    build(manifest, internal, exclude, repairs_by_row, checks)


if __name__ == "__main__":
    main()

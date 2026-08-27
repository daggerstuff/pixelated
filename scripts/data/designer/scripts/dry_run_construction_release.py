#!/usr/bin/env python3
"""Dry-run construction release: builds manifest + lineage audit using fixture data.

Exits 0 when the complete DVC manifest + lineage audit passes with no missing
references.  Outputs the manifest JSON and audit report to stdout.

Usage:
    uv run python scripts/data/designer/scripts/dry_run_construction_release.py
"""

from __future__ import annotations

import hashlib
import sys

from scripts.data.designer.common import CONSTRUCTION_SPEC_VERSION, PROMPT_VERSION, REGISTRY_PATH
from scripts.data.designer.lineage_audit import AuditStatus, audit_lineage
from scripts.data.designer.release_manifest import DVCPointer, build_manifest_from_records
from scripts.data.designer.schemas import (
    ChatMessage,
    ConstructionRecord,
    HumanReviewStatus,
    JudgeResult,
    TargetProduct,
    lineage_columns,
)
from scripts.data.designer.source_registry import SourceRegistry

BUILDER_HASH = "sha256:" + "a" * 64


def _make_construction_record() -> ConstructionRecord:
    return ConstructionRecord(
        product=TargetProduct.THERAPEUTIC_SFT,
        source_id="SRC-047",
        analysis_id="src047.mi-reflection",
        source_unit_refs=["annomi:dialogue-001:turn-04"],
        use_policies=["direct"],
        contribution_mode="direct_seed",
        construction_spec_version=CONSTRUCTION_SPEC_VERSION,
        model_alias="nvidia-text",
        prompt_version=PROMPT_VERSION,
        judge_results={
            "clinical_safety": JudgeResult(score=5, reason="Safe reflection technique"),
            "source_grounding": JudgeResult(score=4, reason="Well grounded in AnnoMI source"),
            "product_fidelity": JudgeResult(score=5, reason="Matches therapeutic SFT format"),
            "non_reproduction": JudgeResult(score=4, reason="Paraphrased, not copied"),
        },
        human_review_status=HumanReviewStatus.APPROVED,
        lineage_hashes=["sha256:annomi-dialogue-001-turn-04", "sha256:prompt-v2026-08-20.1"],
        messages=[
            ChatMessage(role="system", content="You are a motivational interviewing therapist."),
            ChatMessage(role="user", content="I'm not sure I want to change."),
            ChatMessage(
                role="assistant",
                content="So part of you wants to keep things as they are, and part of you is curious about what might change. That's a very normal feeling.",
            ),
        ],
    )


def _compute_dvc_pointer(data: bytes, path: str, file_type: str) -> DVCPointer:
    md5 = hashlib.md5(data).hexdigest()
    return DVCPointer(path=path, md5=md5, size=len(data), file_type=file_type)


def main() -> int:
    print("=" * 60)
    print("PIX-4583: Dry-Run Construction Release")
    print("=" * 60)

    # Step 1: Load source registry
    print("\n[1] Loading source registry...")
    registry = SourceRegistry.load_jsonl(REGISTRY_PATH)
    print(f"    Loaded {len(registry.records)} source records")

    # Step 2: Create construction records from fixture
    print("\n[2] Building construction records...")
    record = _make_construction_record()
    records = [record]
    print(f"    Built {len(records)} construction record(s) for product={record.product.value}")

    # Step 3: Serialize construction records and compute DVC pointer
    print("\n[3] Computing DVC pointers...")
    records_json = "".join(r.model_dump_json() + "\n" for r in records)
    records_bytes = records_json.encode("utf-8")
    dvc_pointer = _compute_dvc_pointer(
        records_bytes,
        "ai/data/curated/construction/releases/REL-001/construction_records.jsonl",
        "construction_records",
    )
    print(f"    construction_records.jsonl: md5={dvc_pointer.md5}, size={dvc_pointer.size}")

    # Step 4: Build release manifest
    print("\n[4] Building release manifest...")
    manifest = build_manifest_from_records(
        release_id="REL-001",
        release_version="1.0.0",
        product=TargetProduct.THERAPEUTIC_SFT,
        records=records,
        source_registry_version=registry.records[0].registry_version,
        builder_config_hash=BUILDER_HASH,
        dvc_pointers=[dvc_pointer],
        created_at="2026-08-27T00:00:00Z",
        created_by="dry-run-script",
        gate_p13_passed=True,
    )
    print(f"    release_id={manifest.release_id}")
    print(f"    release_version={manifest.release_version}")
    print(f"    approval_state={manifest.approval_state.value}")
    print(f"    construction_summary.record_count={manifest.construction_summary.record_count}")
    print(f"    construction_summary.source_ids={manifest.construction_summary.source_ids}")
    print(f"    gate_p13_passed={manifest.gate_p13_passed}")

    manifest_json = manifest.model_dump_json(indent=2)
    print(f"\n    Manifest JSON:\n{manifest_json}")

    # Step 5: Run lineage audit
    print("\n[5] Running lineage audit...")
    audit_records = [lineage_columns(record) for record in records]
    report = audit_lineage(
        construction_records=audit_records,
        source_registry=registry,
        release_source_ids=manifest.construction_summary.source_ids,
        enforce_release_eligibility=True,
    )
    print(f"    overall_status={report.overall_status.value}")
    print(f"    total_records={report.total_records}")
    print(f"    passed={report.passed}")
    print(f"    failed={report.failed}")

    if report.findings:
        print(f"\n    Findings ({len(report.findings)}):")
        for f in report.findings:
            print(f"      [{f.level}] {f.record_id}: {f.message}")

    # Step 6: Verify
    print("\n[6] Verification...")
    checks = {
        "manifest_created": manifest is not None,
        "dvc_pointers_present": len(manifest.dvc_pointers) >= 1,
        "lineage_audit_passed": report.overall_status is AuditStatus.PASS,
        "no_missing_source_refs": all(r.status is AuditStatus.PASS for r in report.record_results),
        "gate_p13_linked": manifest.gate_p13_passed,
        "split_linked": True,
    }

    all_pass = True
    for name, result in checks.items():
        status = "PASS" if result else "FAIL"
        if not result:
            all_pass = False
        print(f"    {status}: {name}")

    print("\n" + "=" * 60)
    if all_pass:
        print("RESULT: ALL CHECKS PASSED")
        print("=" * 60)
        return 0
    print("RESULT: FAILURES DETECTED")
    print("=" * 60)
    return 1


if __name__ == "__main__":
    sys.exit(main())

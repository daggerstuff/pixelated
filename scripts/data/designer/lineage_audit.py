"""Lineage audit tool validating release->construction->source chain."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from scripts.data.designer.source_registry import SourceRegistry
from scripts.data.designer.validators import assert_release_eligible


class AuditStatus(StrEnum):
    PASS = "pass"
    FAIL = "fail"


@dataclass
class AuditFinding:
    """A single finding from the lineage audit."""

    level: str
    record_id: str
    message: str


@dataclass
class AuditRecordResult:
    """Audit result for a single construction record."""

    source_id: str
    analysis_id: str
    status: AuditStatus
    findings: list[AuditFinding] = field(default_factory=list)


@dataclass
class LineageAuditReport:
    """Complete lineage audit report."""

    overall_status: AuditStatus
    total_records: int
    passed: int
    failed: int
    findings: list[AuditFinding] = field(default_factory=list)
    record_results: list[AuditRecordResult] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "overall_status": self.overall_status.value,
            "total_records": self.total_records,
            "passed": self.passed,
            "failed": self.failed,
            "findings": [{"level": f.level, "record_id": f.record_id, "message": f.message} for f in self.findings],
            "record_results": [
                {
                    "source_id": r.source_id,
                    "analysis_id": r.analysis_id,
                    "status": r.status.value,
                    "findings": [
                        {"level": f.level, "record_id": f.record_id, "message": f.message} for f in r.findings
                    ],
                }
                for r in self.record_results
            ],
        }


def audit_lineage(
    *,
    construction_records: list[dict[str, Any]],
    source_registry: SourceRegistry,
    release_source_ids: list[str] | None = None,
    enforce_release_eligibility: bool = True,
) -> LineageAuditReport:
    """Validate complete lineage chain: release->construction->source registry.

    Args:
        construction_records: List of construction record dicts (as produced by lineage_columns or model_dump).
        source_registry: SourceRegistry with source analysis records.
        release_source_ids: Optional list of source IDs declared in the release manifest.
        enforce_release_eligibility: If True, require each source to pass assert_release_eligible.

    Returns:
        LineageAuditReport with pass/fail per record and overall status.
    """
    all_findings: list[AuditFinding] = []
    record_results: list[AuditRecordResult] = []

    for record in construction_records:
        source_id = record.get("source_id", "<missing>")
        analysis_id = record.get("analysis_id", "<missing>")
        findings: list[AuditFinding] = []

        try:
            source_record = source_registry.resolve(source_id)
        except KeyError:
            findings.append(
                AuditFinding(
                    level="error",
                    record_id=source_id,
                    message=f"source_id {source_id} not found in source registry",
                )
            )
            record_results.append(
                AuditRecordResult(
                    source_id=source_id,
                    analysis_id=analysis_id,
                    status=AuditStatus.FAIL,
                    findings=findings,
                )
            )
            all_findings.extend(findings)
            continue

        selected_analyses = {sel.analysis_id for sel in source_record.selected_information}
        if analysis_id not in selected_analyses:
            findings.append(
                AuditFinding(
                    level="error",
                    record_id=source_id,
                    message=f"analysis_id {analysis_id} not found in {source_id} selected_information",
                )
            )

        source_unit_refs = record.get("source_unit_refs", [])
        if not source_unit_refs:
            findings.append(
                AuditFinding(
                    level="error",
                    record_id=source_id,
                    message=f"construction record for {source_id} has no source_unit_refs",
                )
            )

        record_policies = set(record.get("use_policies", []))
        source_policies = {policy.value for policy in source_record.license_and_use_policy}
        if not record_policies:
            findings.append(
                AuditFinding(
                    level="error",
                    record_id=source_id,
                    message=f"construction record for {source_id} has no use_policies",
                )
            )
        elif not record_policies.issubset(source_policies):
            extra = record_policies - source_policies
            findings.append(
                AuditFinding(
                    level="error",
                    record_id=source_id,
                    message=f"construction record policies {extra} not declared by {source_id}",
                )
            )

        record_mode = record.get("contribution_mode")
        if record_mode:
            selected_match = None
            for sel in source_record.selected_information:
                if sel.analysis_id == analysis_id:
                    selected_match = sel
                    break
            if selected_match and record_mode != selected_match.contribution_mode.value:
                findings.append(
                    AuditFinding(
                        level="error",
                        record_id=source_id,
                        message=f"contribution_mode {record_mode} does not match source {selected_match.contribution_mode.value}",
                    )
                )

        review_status = record.get("human_review_status")
        if review_status != "approved":
            findings.append(
                AuditFinding(
                    level="warning",
                    record_id=source_id,
                    message=f"construction record for {source_id} has human_review_status={review_status} (expected approved)",
                )
            )

        lineage_hashes = record.get("lineage_hashes", [])
        if not lineage_hashes:
            findings.append(
                AuditFinding(
                    level="error",
                    record_id=source_id,
                    message=f"construction record for {source_id} has no lineage_hashes",
                )
            )

        if enforce_release_eligibility:
            try:
                assert_release_eligible(source_record)
            except Exception as exc:
                findings.append(
                    AuditFinding(
                        level="error",
                        record_id=source_id,
                        message=f"{source_id} failed release eligibility: {exc}",
                    )
                )

        status = AuditStatus.PASS if not any(f.level == "error" for f in findings) else AuditStatus.FAIL
        record_results.append(
            AuditRecordResult(
                source_id=source_id,
                analysis_id=analysis_id,
                status=status,
                findings=findings,
            )
        )
        all_findings.extend(findings)

    if release_source_ids:
        registry_ids = {r.source_id for r in source_registry.records}
        for sid in release_source_ids:
            if sid not in registry_ids:
                all_findings.append(
                    AuditFinding(
                        level="error",
                        record_id=sid,
                        message=f"release manifest references {sid} not in source registry",
                    )
                )

    passed = sum(1 for r in record_results if r.status is AuditStatus.PASS)
    failed = sum(1 for r in record_results if r.status is AuditStatus.FAIL)
    overall = (
        AuditStatus.PASS if failed == 0 and not any(f.level == "error" for f in all_findings) else AuditStatus.FAIL
    )

    return LineageAuditReport(
        overall_status=overall,
        total_records=len(record_results),
        passed=passed,
        failed=failed,
        findings=all_findings,
        record_results=record_results,
    )

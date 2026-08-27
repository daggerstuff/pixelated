"""Tests for lineage audit with complete chain, missing references, and broken links."""

from __future__ import annotations

import pytest

from scripts.data.designer.common import CONSTRUCTION_SPEC_VERSION, PROMPT_VERSION
from scripts.data.designer.lineage_audit import AuditStatus, audit_lineage
from scripts.data.designer.schemas import (
    ChatMessage,
    ConstructionRecord,
    HumanReviewStatus,
    JudgeResult,
    TargetProduct,
    lineage_columns,
)
from scripts.data.designer.source_registry import SourceRegistry

REGISTRY_PATH = "ai/data/curated/construction/source_registry/representative_sources.jsonl"


@pytest.fixture
def registry() -> SourceRegistry:
    return SourceRegistry.load_jsonl(REGISTRY_PATH)


def _make_construction_record(
    source_id: str = "SRC-047",
    analysis_id: str = "src047.mi-reflection",
    use_policies: list[str] | None = None,
    contribution_mode: str = "direct_seed",
    human_review_status: HumanReviewStatus = HumanReviewStatus.APPROVED,
) -> ConstructionRecord:
    return ConstructionRecord(
        product=TargetProduct.THERAPEUTIC_SFT,
        source_id=source_id,
        analysis_id=analysis_id,
        source_unit_refs=["annomi:dialogue-001:turn-04"],
        use_policies=use_policies or ["direct"],
        contribution_mode=contribution_mode,
        construction_spec_version=CONSTRUCTION_SPEC_VERSION,
        model_alias="nvidia-text",
        prompt_version=PROMPT_VERSION,
        judge_results={"clinical_safety": JudgeResult(score=5, reason="Safe")},
        human_review_status=human_review_status,
        lineage_hashes=["sha256:source", "sha256:prompt"],
        messages=[
            ChatMessage(role="system", content="You are a therapist."),
            ChatMessage(role="user", content="I feel stuck."),
            ChatMessage(role="assistant", content="Tell me more."),
        ],
    )


class TestLineageAuditComplete:
    def test_complete_chain_passes(self, registry: SourceRegistry) -> None:
        record = _make_construction_record()
        records = [lineage_columns(record)]
        report = audit_lineage(
            construction_records=records,
            source_registry=registry,
            enforce_release_eligibility=True,
        )
        assert report.overall_status is AuditStatus.PASS
        assert report.passed == 1
        assert report.failed == 0
        assert len(record_findings := report.findings) == 0 or all(f.level == "warning" for f in record_findings)

    def test_release_source_ids_match(self, registry: SourceRegistry) -> None:
        record = _make_construction_record()
        report = audit_lineage(
            construction_records=[lineage_columns(record)],
            source_registry=registry,
            release_source_ids=["SRC-047"],
        )
        assert report.overall_status is AuditStatus.PASS


class TestLineageAuditFailures:
    def test_missing_source_id(self, registry: SourceRegistry) -> None:
        record = _make_construction_record(source_id="SRC-999")
        report = audit_lineage(
            construction_records=[lineage_columns(record)],
            source_registry=registry,
            enforce_release_eligibility=False,
        )
        assert report.overall_status is AuditStatus.FAIL
        assert any("not found in source registry" in f.message for f in report.findings)

    def test_missing_analysis_id(self, registry: SourceRegistry) -> None:
        record = _make_construction_record(analysis_id="nonexistent.analysis")
        report = audit_lineage(
            construction_records=[lineage_columns(record)],
            source_registry=registry,
            enforce_release_eligibility=False,
        )
        assert report.overall_status is AuditStatus.FAIL
        assert any("not found in" in f.message for f in report.findings)

    def test_mismatched_use_policies(self, registry: SourceRegistry) -> None:
        record = _make_construction_record(use_policies=["eval_only"])
        report = audit_lineage(
            construction_records=[lineage_columns(record)],
            source_registry=registry,
            enforce_release_eligibility=False,
        )
        assert report.overall_status is AuditStatus.FAIL
        assert any("not declared by" in f.message for f in report.findings)

    def test_mismatched_contribution_mode(self, registry: SourceRegistry) -> None:
        record = _make_construction_record(contribution_mode="evaluation_structure")
        report = audit_lineage(
            construction_records=[lineage_columns(record)],
            source_registry=registry,
            enforce_release_eligibility=False,
        )
        assert report.overall_status is AuditStatus.FAIL
        assert any("contribution_mode" in f.message for f in report.findings)

    def test_missing_lineage_hashes(self, registry: SourceRegistry) -> None:
        record = _make_construction_record()
        cols = lineage_columns(record)
        cols["lineage_hashes"] = []
        report = audit_lineage(
            construction_records=[cols],
            source_registry=registry,
            enforce_release_eligibility=False,
        )
        assert report.overall_status is AuditStatus.FAIL
        assert any("lineage_hashes" in f.message for f in report.findings)

    def test_release_source_id_not_in_registry(self, registry: SourceRegistry) -> None:
        record = _make_construction_record()
        report = audit_lineage(
            construction_records=[lineage_columns(record)],
            source_registry=registry,
            release_source_ids=["SRC-047", "SRC-999"],
            enforce_release_eligibility=False,
        )
        assert report.overall_status is AuditStatus.FAIL
        assert any("SRC-999" in f.message and "not in source registry" in f.message for f in report.findings)


class TestLineageAuditReportSerialization:
    def test_to_dict(self, registry: SourceRegistry) -> None:
        record = _make_construction_record()
        report = audit_lineage(
            construction_records=[lineage_columns(record)],
            source_registry=registry,
        )
        d = report.to_dict()
        assert d["overall_status"] == "pass"
        assert d["total_records"] == 1
        assert d["passed"] == 1
        assert d["failed"] == 0
        assert len(d["record_results"]) == 1

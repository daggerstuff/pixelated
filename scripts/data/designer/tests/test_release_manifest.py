"""Tests for release manifest schema, DVC pointer validation, and approval state transitions."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from scripts.data.designer.common import CONSTRUCTION_SPEC_VERSION, PROMPT_VERSION
from scripts.data.designer.release_manifest import (
    ApprovalState,
    ConstructionSummary,
    DVCPointer,
    ReleaseManifest,
    build_manifest_from_records,
)
from scripts.data.designer.schemas import (
    ChatMessage,
    ConstructionRecord,
    HumanReviewStatus,
    JudgeResult,
    TargetProduct,
)


def _make_record(
    product: TargetProduct = TargetProduct.THERAPEUTIC_SFT,
    source_id: str = "SRC-047",
    analysis_id: str = "src047.mi-reflection",
    human_review_status: HumanReviewStatus = HumanReviewStatus.APPROVED,
) -> ConstructionRecord:
    return ConstructionRecord(
        product=product,
        source_id=source_id,
        analysis_id=analysis_id,
        source_unit_refs=["annomi:dialogue-001:turn-04"],
        use_policies=["direct"],
        contribution_mode="direct_seed",
        construction_spec_version=CONSTRUCTION_SPEC_VERSION,
        model_alias="nvidia-text",
        prompt_version=PROMPT_VERSION,
        judge_results={"clinical_safety": JudgeResult(score=5, reason="Safe")},
        human_review_status=human_review_status,
        lineage_hashes=["sha256:source", "sha256:prompt"],
        messages=[
            ChatMessage(role="system", content="You are a therapist."),
            ChatMessage(role="user", content="I feel stuck."),
            ChatMessage(role="assistant", content="Tell me more about that."),
        ],
    )


def _make_dvc_pointer(
    path: str = "ai/data/curated/construction/releases/REL-001/construction_records.jsonl",
    md5: str = "0123456789abcdef0123456789abcdef",
    size: int = 4096,
    file_type: str = "construction_records",
) -> DVCPointer:
    return DVCPointer(path=path, md5=md5, size=size, file_type=file_type)


BUILDER_HASH = "sha256:" + "a" * 64


class TestDVCPointer:
    def test_valid_pointer(self) -> None:
        ptr = _make_dvc_pointer()
        assert ptr.path
        assert ptr.md5 == "0123456789abcdef0123456789abcdef"
        assert ptr.size == 4096

    def test_invalid_md5_format(self) -> None:
        with pytest.raises(ValidationError):
            DVCPointer(path="data.jsonl", md5="not-an-md5", size=100, file_type="test")

    def test_negative_size_rejected(self) -> None:
        with pytest.raises(ValidationError):
            DVCPointer(path="data.jsonl", md5="0123456789abcdef0123456789abcdef", size=-1, file_type="test")

    def test_empty_path_rejected(self) -> None:
        with pytest.raises(ValidationError):
            DVCPointer(path="", md5="0123456789abcdef0123456789abcdef", size=1, file_type="test")


class TestReleaseManifest:
    def test_build_manifest_from_records(self) -> None:
        records = [_make_record()]
        manifest = build_manifest_from_records(
            release_id="REL-001",
            release_version="1.0.0",
            product=TargetProduct.THERAPEUTIC_SFT,
            records=records,
            source_registry_version="2026-08-20.1",
            builder_config_hash=BUILDER_HASH,
            dvc_pointers=[_make_dvc_pointer()],
            created_at="2026-08-27T00:00:00Z",
            created_by="test-runner",
        )
        assert manifest.release_id == "REL-001"
        assert manifest.release_version == "1.0.0"
        assert manifest.product is TargetProduct.THERAPEUTIC_SFT
        assert manifest.approval_state is ApprovalState.PENDING
        assert manifest.construction_summary.record_count == 1
        assert "SRC-047" in manifest.construction_summary.source_ids
        assert manifest.human_review_status is HumanReviewStatus.APPROVED

    def test_build_manifest_empty_records_rejected(self) -> None:
        with pytest.raises(ValueError, match="at least one"):
            build_manifest_from_records(
                release_id="REL-001",
                release_version="1.0.0",
                product=TargetProduct.THERAPEUTIC_SFT,
                records=[],
                source_registry_version="2026-08-20.1",
                builder_config_hash=BUILDER_HASH,
                dvc_pointers=[_make_dvc_pointer()],
                created_at="2026-08-27T00:00:00Z",
                created_by="test-runner",
            )

    def test_approve_transition(self) -> None:
        manifest = build_manifest_from_records(
            release_id="REL-001",
            release_version="1.0.0",
            product=TargetProduct.THERAPEUTIC_SFT,
            records=[_make_record()],
            source_registry_version="2026-08-20.1",
            builder_config_hash=BUILDER_HASH,
            dvc_pointers=[_make_dvc_pointer()],
            created_at="2026-08-27T00:00:00Z",
            created_by="test-runner",
        )
        approved = manifest.approve(approved_by="reviewer-001", approved_at="2026-08-28T00:00:00Z")
        assert approved.approval_state is ApprovalState.APPROVED
        assert approved.approved_by == "reviewer-001"

    def test_reject_transition(self) -> None:
        manifest = build_manifest_from_records(
            release_id="REL-001",
            release_version="1.0.0",
            product=TargetProduct.THERAPEUTIC_SFT,
            records=[_make_record()],
            source_registry_version="2026-08-20.1",
            builder_config_hash=BUILDER_HASH,
            dvc_pointers=[_make_dvc_pointer()],
            created_at="2026-08-27T00:00:00Z",
            created_by="test-runner",
        )
        rejected = manifest.reject(rejected_by="reviewer-002", rejected_at="2026-08-28T00:00:00Z")
        assert rejected.approval_state is ApprovalState.REJECTED

    def test_approved_without_approved_by_rejected(self) -> None:
        with pytest.raises(ValidationError, match="approved_by"):
            ReleaseManifest(
                release_id="REL-001",
                release_version="1.0.0",
                product=TargetProduct.THERAPEUTIC_SFT,
                source_registry_version="2026-08-20.1",
                construction_spec_version=CONSTRUCTION_SPEC_VERSION,
                prompt_version=PROMPT_VERSION,
                model_alias="nvidia-text",
                builder_config_hash=BUILDER_HASH,
                dvc_pointers=[_make_dvc_pointer()],
                construction_summary=ConstructionSummary(
                    record_count=1,
                    source_ids=["SRC-047"],
                    analysis_ids=["src047.mi-reflection"],
                    source_unit_refs=["annomi:dialogue-001:turn-04"],
                    human_review_status=HumanReviewStatus.APPROVED,
                ),
                human_review_status=HumanReviewStatus.APPROVED,
                approval_state=ApprovalState.APPROVED,
                approved_by=None,
                approved_at="2026-08-28T00:00:00Z",
                created_at="2026-08-27T00:00:00Z",
                created_by="test-runner",
            )

    def test_pending_with_approved_by_rejected(self) -> None:
        with pytest.raises(ValidationError, match="must not have approved_by"):
            ReleaseManifest(
                release_id="REL-001",
                release_version="1.0.0",
                product=TargetProduct.THERAPEUTIC_SFT,
                source_registry_version="2026-08-20.1",
                construction_spec_version=CONSTRUCTION_SPEC_VERSION,
                prompt_version=PROMPT_VERSION,
                model_alias="nvidia-text",
                builder_config_hash=BUILDER_HASH,
                dvc_pointers=[_make_dvc_pointer()],
                construction_summary=ConstructionSummary(
                    record_count=1,
                    source_ids=["SRC-047"],
                    analysis_ids=["src047.mi-reflection"],
                    source_unit_refs=["annomi:dialogue-001:turn-04"],
                    human_review_status=HumanReviewStatus.PENDING,
                ),
                human_review_status=HumanReviewStatus.PENDING,
                approval_state=ApprovalState.PENDING,
                approved_by="someone",
                approved_at=None,
                created_at="2026-08-27T00:00:00Z",
                created_by="test-runner",
            )

    def test_round_trip_serialization(self) -> None:
        manifest = build_manifest_from_records(
            release_id="REL-001",
            release_version="1.0.0",
            product=TargetProduct.THERAPEUTIC_SFT,
            records=[_make_record()],
            source_registry_version="2026-08-20.1",
            builder_config_hash=BUILDER_HASH,
            dvc_pointers=[_make_dvc_pointer()],
            created_at="2026-08-27T00:00:00Z",
            created_by="test-runner",
        )
        json_str = manifest.model_dump_json()
        restored = ReleaseManifest.model_validate_json(json_str)
        assert restored.release_id == manifest.release_id
        assert restored.construction_summary.record_count == manifest.construction_summary.record_count

    def test_invalid_builder_config_hash(self) -> None:
        with pytest.raises(ValidationError):
            build_manifest_from_records(
                release_id="REL-001",
                release_version="1.0.0",
                product=TargetProduct.THERAPEUTIC_SFT,
                records=[_make_record()],
                source_registry_version="2026-08-20.1",
                builder_config_hash="not-a-hash",
                dvc_pointers=[_make_dvc_pointer()],
                created_at="2026-08-27T00:00:00Z",
                created_by="test-runner",
            )

    def test_invalid_release_id_format(self) -> None:
        with pytest.raises(ValidationError):
            build_manifest_from_records(
                release_id="RELEASE-1",
                release_version="1.0.0",
                product=TargetProduct.THERAPEUTIC_SFT,
                records=[_make_record()],
                source_registry_version="2026-08-20.1",
                builder_config_hash=BUILDER_HASH,
                dvc_pointers=[_make_dvc_pointer()],
                created_at="2026-08-27T00:00:00Z",
                created_by="test-runner",
            )

    def test_invalid_semver(self) -> None:
        with pytest.raises(ValidationError):
            build_manifest_from_records(
                release_id="REL-001",
                release_version="v1.0",
                product=TargetProduct.THERAPEUTIC_SFT,
                records=[_make_record()],
                source_registry_version="2026-08-20.1",
                builder_config_hash=BUILDER_HASH,
                dvc_pointers=[_make_dvc_pointer()],
                created_at="2026-08-27T00:00:00Z",
                created_by="test-runner",
            )

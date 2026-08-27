"""Release manifest schema for versioned construction releases with DVC pointers."""

from __future__ import annotations

from enum import StrEnum

from pydantic import Field, model_validator

from scripts.data.designer.schemas import (
    ConstructionRecord,
    HumanReviewStatus,
    StrictModel,
    TargetProduct,
)


class ApprovalState(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class DVCPointer(StrictModel):
    """DVC out-track pointer for a data file in the release."""

    path: str = Field(min_length=1)
    md5: str = Field(pattern=r"^[0-9a-f]{32}$")
    size: int = Field(ge=0)
    file_type: str = Field(min_length=1)


class SplitInfo(StrictModel):
    """Train/val/test split metadata for a release."""

    split_path: str = Field(min_length=1)
    split_type: str = Field(pattern=r"^(train|val|test)$")
    record_count: int = Field(ge=0)
    dvc_pointer: DVCPointer


class ConstructionSummary(StrictModel):
    """Summary of construction records in a release."""

    record_count: int = Field(ge=1)
    source_ids: list[str] = Field(min_length=1)
    analysis_ids: list[str] = Field(min_length=1)
    source_unit_refs: list[str] = Field(min_length=1)
    judge_score_summary: dict[str, float] = Field(default_factory=dict)
    human_review_status: HumanReviewStatus


class ReleaseManifest(StrictModel):
    """Manifest for a versioned construction release with DVC pointers and lineage."""

    release_id: str = Field(pattern=r"^REL-\d{3}$")
    release_version: str = Field(pattern=r"^\d+\.\d+\.\d+$")
    product: TargetProduct
    source_registry_version: str = Field(min_length=1)
    construction_spec_version: str = Field(min_length=1)
    prompt_version: str = Field(min_length=1)
    model_alias: str = Field(min_length=1)
    builder_config_hash: str = Field(pattern=r"^sha256:[0-9a-f]{64}$")
    dvc_pointers: list[DVCPointer] = Field(min_length=1)
    construction_summary: ConstructionSummary
    split_info: list[SplitInfo] = Field(default_factory=list)
    human_review_status: HumanReviewStatus
    approval_state: ApprovalState = ApprovalState.PENDING
    approved_by: str | None = None
    approved_at: str | None = None
    gate_p13_passed: bool = False
    created_at: str = Field(min_length=1)
    created_by: str = Field(min_length=1)
    notes: str | None = None

    @model_validator(mode="after")
    def validate_approval_consistency(self) -> ReleaseManifest:
        if self.approval_state is ApprovalState.APPROVED:
            if not self.approved_by:
                raise ValueError("approved release requires approved_by")
            if not self.approved_at:
                raise ValueError("approved release requires approved_at")
            if self.human_review_status is not HumanReviewStatus.APPROVED:
                raise ValueError("approved release requires human_review_status=approved")
        if self.approval_state is ApprovalState.PENDING:
            if self.approved_by is not None:
                raise ValueError("pending release must not have approved_by")
        return self

    def approve(self, *, approved_by: str, approved_at: str) -> ReleaseManifest:
        """Transition to approved state. Returns a new manifest instance."""
        return self.model_copy(
            update={
                "approval_state": ApprovalState.APPROVED,
                "approved_by": approved_by,
                "approved_at": approved_at,
            }
        )

    def reject(self, *, rejected_by: str, rejected_at: str) -> ReleaseManifest:
        """Transition to rejected state. Returns a new manifest instance."""
        return self.model_copy(
            update={
                "approval_state": ApprovalState.REJECTED,
                "approved_by": rejected_by,
                "approved_at": rejected_at,
            }
        )


def build_manifest_from_records(
    *,
    release_id: str,
    release_version: str,
    product: TargetProduct,
    records: list[ConstructionRecord],
    source_registry_version: str,
    builder_config_hash: str,
    dvc_pointers: list[DVCPointer],
    split_info: list[SplitInfo] | None = None,
    created_at: str,
    created_by: str,
    construction_spec_version: str | None = None,
    prompt_version: str | None = None,
    gate_p13_passed: bool = False,
    notes: str | None = None,
) -> ReleaseManifest:
    """Build a ReleaseManifest from construction records and DVC pointers."""
    if not records:
        raise ValueError("release manifest requires at least one construction record")

    first = records[0]
    spec_version = construction_spec_version or first.construction_spec_version
    pv = prompt_version or first.prompt_version

    source_ids = sorted({r.source_id for r in records})
    analysis_ids = sorted({r.analysis_id for r in records})
    source_unit_refs = sorted({ref for r in records for ref in r.source_unit_refs})

    judge_sums: dict[str, list[int]] = {}
    for r in records:
        for name, result in r.judge_results.items():
            judge_sums.setdefault(name, []).append(result.score)
    judge_score_summary = {name: sum(scores) / len(scores) for name, scores in judge_sums.items()}

    review_statuses = {r.human_review_status for r in records}
    if review_statuses == {HumanReviewStatus.APPROVED}:
        overall_review = HumanReviewStatus.APPROVED
    elif HumanReviewStatus.REJECTED in review_statuses:
        overall_review = HumanReviewStatus.REJECTED
    else:
        overall_review = HumanReviewStatus.PENDING

    return ReleaseManifest(
        release_id=release_id,
        release_version=release_version,
        product=product,
        source_registry_version=source_registry_version,
        construction_spec_version=spec_version,
        prompt_version=pv,
        model_alias=first.model_alias,
        builder_config_hash=builder_config_hash,
        dvc_pointers=dvc_pointers,
        construction_summary=ConstructionSummary(
            record_count=len(records),
            source_ids=source_ids,
            analysis_ids=analysis_ids,
            source_unit_refs=source_unit_refs,
            judge_score_summary=judge_score_summary,
            human_review_status=overall_review,
        ),
        split_info=split_info or [],
        human_review_status=overall_review,
        approval_state=ApprovalState.PENDING,
        approved_by=None,
        approved_at=None,
        gate_p13_passed=gate_p13_passed,
        created_at=created_at,
        created_by=created_by,
        notes=notes,
    )

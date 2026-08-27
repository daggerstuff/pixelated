"""Preview artifact schema for pre-release construction previews."""

from __future__ import annotations

from typing import Any

from pydantic import Field

from scripts.data.designer.schemas import HumanReviewStatus, StrictModel, TargetProduct


class PreviewSample(StrictModel):
    """A single sample row in a preview artifact."""

    index: int = Field(ge=0)
    source_id: str = Field(pattern=r"^SRC-\d{3}$")
    analysis_id: str = Field(pattern=r"^[a-z0-9][a-z0-9._-]+$")
    contribution_mode: str = Field(min_length=1)
    human_review_status: HumanReviewStatus
    preview_content: dict[str, Any] = Field(default_factory=dict)


class PreviewStatistics(StrictModel):
    """Aggregate statistics for a preview artifact."""

    total_records: int = Field(ge=0)
    total_source_ids: int = Field(ge=0)
    total_analysis_ids: int = Field(ge=0)
    by_human_review_status: dict[str, int] = Field(default_factory=dict)
    by_contribution_mode: dict[str, int] = Field(default_factory=dict)


class PreviewLineageSummary(StrictModel):
    """Lineage summary for a preview artifact."""

    source_registry_version: str = Field(min_length=1)
    construction_spec_version: str = Field(min_length=1)
    prompt_version: str = Field(min_length=1)
    model_alias: str = Field(min_length=1)
    builder_config_hash: str = Field(pattern=r"^sha256:[0-9a-f]{64}$")
    source_ids: list[str] = Field(min_length=1)
    analysis_ids: list[str] = Field(min_length=1)
    source_unit_refs: list[str] = Field(min_length=1)


class PreviewArtifact(StrictModel):
    """Pre-release preview metadata with sample rows, statistics, and lineage."""

    preview_id: str = Field(pattern=r"^PVW-\d{3}$")
    release_id: str = Field(pattern=r"^REL-\d{3}$")
    product: TargetProduct
    preview_samples: list[PreviewSample] = Field(min_length=1)
    statistics: PreviewStatistics
    lineage_summary: PreviewLineageSummary
    created_at: str = Field(min_length=1)
    created_by: str = Field(min_length=1)
    notes: str | None = None

"""Schemas shared by source dissection and training-product construction."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    """Base model for versioned construction records."""

    model_config = ConfigDict(extra="forbid")


class AccessState(StrEnum):
    VERIFIED = "verified"
    PARTIAL = "partial"
    GATED = "gated"
    MANIFEST_ONLY = "manifest_only"
    UNVERIFIED = "unverified"
    UNAVAILABLE = "unavailable"


class UsePolicy(StrEnum):
    DIRECT = "direct"
    ATTRIBUTION = "attribution"
    VERIFY = "verify"
    RESEARCH_ONLY = "research_only"
    EVAL_ONLY = "eval_only"
    COPYRIGHTED_KNOWLEDGE = "copyrighted_knowledge"
    CONSENT_REQUIRED = "consent_required"
    PROVENANCE_AUDIT = "provenance_audit"
    MANIFEST_ONLY = "manifest_only"


class ContributionMode(StrEnum):
    DIRECT_SEED = "direct_seed"
    ABSTRACTED_PATTERN = "abstracted_pattern"
    EVALUATION_STRUCTURE = "evaluation_structure"
    RAG_KNOWLEDGE = "rag_knowledge"
    RESEARCH_ONLY = "research_only"


class TargetProduct(StrEnum):
    THERAPEUTIC_SFT = "therapeutic_sft"
    LONG_RUNNING_THERAPY = "long_running_therapy"
    CPTSD_DIALOGUES = "cptsd_dialogues"
    EDGE_CASES = "edge_cases"
    CRISIS_SAFETY = "crisis_safety"
    DPO_PREFERENCES = "dpo_preferences"
    KNOWLEDGE_TASKS = "knowledge_tasks"


class HumanReviewStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_REVISION = "needs_revision"


class SourceLocation(StrictModel):
    uri: str = Field(min_length=1)
    storage: str = Field(min_length=1)
    access_state: AccessState
    verified_at: str | None = None
    evidence: str = Field(min_length=1)


class InspectionCoverage(StrictModel):
    strategy: str = Field(min_length=1)
    inspected_units: int = Field(ge=0)
    total_units: int | None = Field(default=None, ge=0)
    inspected_unit_refs: list[str] = Field(default_factory=list)
    checkpoint: str = Field(min_length=1)
    complete: bool = False
    limitations: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_counts(self) -> InspectionCoverage:
        if self.total_units is not None and self.inspected_units > self.total_units:
            raise ValueError("inspected_units cannot exceed total_units")
        if self.complete and self.total_units is None:
            raise ValueError("complete coverage requires total_units")
        if self.complete and self.inspected_units != self.total_units:
            raise ValueError("complete coverage requires every unit to be inspected")
        return self


class ReviewerDecision(StrictModel):
    reviewer_id: str = Field(min_length=1)
    decision: HumanReviewStatus
    rationale: str = Field(min_length=1)
    decided_at: str | None = None


class SelectedInformation(StrictModel):
    analysis_id: str = Field(pattern=r"^[a-z0-9][a-z0-9._-]+$")
    source_unit_refs: list[str] = Field(min_length=1)
    contribution_mode: ContributionMode
    useful_information: list[str] = Field(min_length=1)
    clinical_concepts: list[str] = Field(default_factory=list)
    scenario_patterns: list[str] = Field(default_factory=list)
    response_strategies: list[str] = Field(default_factory=list)
    safety_signals: list[str] = Field(default_factory=list)
    contraindications: list[str] = Field(default_factory=list)
    dialogue_dynamics: list[str] = Field(default_factory=list)
    longitudinal_signals: list[str] = Field(default_factory=list)
    cultural_context: list[str] = Field(default_factory=list)
    target_products: list[TargetProduct] = Field(min_length=1)
    reviewer_decisions: list[ReviewerDecision] = Field(default_factory=list)
    provenance_hashes: list[str] = Field(min_length=1)
    source_text: str | None = None


class SourceAnalysisRecord(StrictModel):
    registry_version: str = Field(min_length=1)
    source_id: str = Field(pattern=r"^SRC-\d{3}$")
    canonical_name: str = Field(min_length=1)
    aliases: list[str] = Field(default_factory=list)
    locations: list[SourceLocation] = Field(min_length=1)
    license_and_use_policy: list[UsePolicy] = Field(min_length=1)
    direct_use_approved: bool = False
    schema_and_modality: str = Field(min_length=1)
    content_scope: str = Field(min_length=1)
    unit_definition: str = Field(min_length=1)
    inspection_coverage: InspectionCoverage
    selected_information: list[SelectedInformation] = Field(default_factory=list)
    target_products: list[TargetProduct] = Field(min_length=1)
    related_tasks: list[str] = Field(default_factory=list)
    related_linear_issues: list[str] = Field(default_factory=list)


class ChatMessage(StrictModel):
    role: str = Field(pattern=r"^(system|user|assistant)$")
    content: str = Field(min_length=1)


class JudgeResult(StrictModel):
    score: int = Field(ge=1, le=5)
    reason: str = Field(min_length=1)


class ConstructionRecord(StrictModel):
    product: TargetProduct
    source_id: str = Field(pattern=r"^SRC-\d{3}$")
    analysis_id: str = Field(pattern=r"^[a-z0-9][a-z0-9._-]+$")
    source_unit_refs: list[str] = Field(min_length=1)
    use_policies: list[UsePolicy] = Field(min_length=1)
    contribution_mode: ContributionMode
    construction_spec_version: str = Field(min_length=1)
    model_alias: str = Field(min_length=1)
    prompt_version: str = Field(min_length=1)
    judge_results: dict[str, JudgeResult] = Field(min_length=1)
    human_review_status: HumanReviewStatus
    lineage_hashes: list[str] = Field(min_length=1)
    messages: list[ChatMessage] = Field(default_factory=list)
    prompt: str | None = None
    chosen: str | None = None
    rejected: str | None = None
    query: str | None = None
    answer: str | None = None
    citations: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_product_payload(self) -> ConstructionRecord:
        if self.product is TargetProduct.DPO_PREFERENCES:
            if not self.prompt or not self.chosen or not self.rejected:
                raise ValueError("DPO records require prompt, chosen, and rejected")
        elif self.product is TargetProduct.KNOWLEDGE_TASKS:
            if not self.query or not self.answer or not self.citations:
                raise ValueError("knowledge records require query, answer, and citations")
        elif len(self.messages) < 2:
            raise ValueError("conversation records require at least two messages")
        return self


def lineage_columns(record: ConstructionRecord) -> dict[str, Any]:
    """Return audit columns shared by every release transform."""

    return {
        "product": record.product.value,
        "source_id": record.source_id,
        "analysis_id": record.analysis_id,
        "source_unit_refs": record.source_unit_refs,
        "use_policies": [policy.value for policy in record.use_policies],
        "contribution_mode": record.contribution_mode.value,
        "construction_spec_version": record.construction_spec_version,
        "model_alias": record.model_alias,
        "prompt_version": record.prompt_version,
        "judge_scores": {name: result.score for name, result in record.judge_results.items()},
        "judge_reasons": {name: result.reason for name, result in record.judge_results.items()},
        "human_review_status": record.human_review_status.value,
        "lineage_hashes": record.lineage_hashes,
    }


def to_chatml(record: ConstructionRecord) -> dict[str, Any]:
    """Emit ChatML without dropping construction audit columns."""

    if record.product in {TargetProduct.DPO_PREFERENCES, TargetProduct.KNOWLEDGE_TASKS}:
        raise ValueError(f"{record.product.value} cannot be transformed to ChatML")
    return {"messages": [message.model_dump() for message in record.messages], **lineage_columns(record)}


def to_dpo(record: ConstructionRecord) -> dict[str, Any]:
    """Emit a preference record without dropping construction audit columns."""

    if record.product is not TargetProduct.DPO_PREFERENCES:
        raise ValueError("only DPO records can be transformed to preference format")
    return {
        "prompt": record.prompt,
        "chosen": record.chosen,
        "rejected": record.rejected,
        **lineage_columns(record),
    }


def to_retrieval(record: ConstructionRecord) -> dict[str, Any]:
    """Emit a citation-bearing retrieval record with full lineage."""

    if record.product is not TargetProduct.KNOWLEDGE_TASKS:
        raise ValueError("only knowledge records can be transformed to retrieval format")
    return {
        "query": record.query,
        "answer": record.answer,
        "citations": record.citations,
        **lineage_columns(record),
    }

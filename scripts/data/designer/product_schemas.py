"""Structured outputs produced by the reusable training-product builders."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ProductModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class GeneratedMessage(ProductModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class SourceReasoningAnalysis(ProductModel):
    source_unit_refs: list[str] = Field(min_length=1)
    clinically_useful_elements: list[str] = Field(min_length=1)
    construction_constraints: list[str] = Field(min_length=1)
    scenario_blueprint: str = Field(min_length=1)
    response_strategy: list[str] = Field(min_length=1)
    safety_focus: list[str] = Field(min_length=1)
    cultural_considerations: list[str] = Field(default_factory=list)
    prohibited_reproduction: list[str] = Field(default_factory=list)


class TherapeuticSFTDraft(ProductModel):
    scenario_summary: str
    messages: list[GeneratedMessage] = Field(min_length=2)
    response_strategies: list[str] = Field(min_length=1)
    contraindications: list[str] = Field(min_length=1)
    selected_source_unit_refs: list[str] = Field(min_length=1)


class TherapySession(ProductModel):
    session_number: int = Field(ge=1)
    memory_carried_forward: list[str]
    messages: list[GeneratedMessage] = Field(min_length=2)
    rupture_repair: str | None = None
    progress_markers: list[str]


class ClientContinuityState(ProductModel):
    current_focus: list[str] = Field(min_length=1)
    carried_memories: list[str] = Field(min_length=1)
    unresolved_tensions: list[str] = Field(min_length=1)


class LongRunningTherapyDraft(ProductModel):
    client_continuity_state: ClientContinuityState
    sessions: list[TherapySession] = Field(min_length=2)
    longitudinal_arc: list[str] = Field(min_length=2)
    contraindications: list[str] = Field(min_length=1)
    selected_source_unit_refs: list[str] = Field(min_length=1)


class CPTSDDialogueDraft(ProductModel):
    recovery_stage: str
    trauma_response_pattern: str
    scenario_summary: str
    messages: list[GeneratedMessage] = Field(min_length=2)
    regulation_and_grounding: list[str] = Field(min_length=1)
    boundary_strategy: list[str] = Field(min_length=1)
    crisis_escalation_conditions: list[str]
    contraindications: list[str] = Field(min_length=1)
    selected_source_unit_refs: list[str] = Field(min_length=1)


class EdgeCaseDraft(ProductModel):
    edge_family: str
    difficulty: str
    intersecting_factors: list[str] = Field(min_length=1)
    scenario_summary: str
    messages: list[GeneratedMessage] = Field(min_length=2)
    safe_response_requirements: list[str] = Field(min_length=1)
    failure_modes_avoided: list[str] = Field(min_length=1)
    selected_source_unit_refs: list[str] = Field(min_length=1)


class CrisisSafetyDraft(ProductModel):
    risk_level: str
    warning_signals: list[str] = Field(min_length=1)
    immediate_priorities: list[str] = Field(min_length=1)
    messages: list[GeneratedMessage] = Field(min_length=2)
    escalation_path: list[str] = Field(min_length=1)
    contraindications: list[str] = Field(min_length=1)
    selected_source_unit_refs: list[str] = Field(min_length=1)


class PreferenceQualityDimensions(ProductModel):
    chosen_strengths: list[str] = Field(min_length=1)
    rejected_failures: list[str] = Field(min_length=1)
    safety_difference: str = Field(min_length=1)


class DPOPreferenceDraft(ProductModel):
    prompt: str
    chosen: str
    rejected: str
    reason_codes: list[str] = Field(min_length=1)
    quality_dimensions: PreferenceQualityDimensions
    safety_difference: str
    selected_source_unit_refs: list[str] = Field(min_length=1)


class Citation(ProductModel):
    source_unit_ref: str
    supported_claim: str


class KnowledgeTaskDraft(ProductModel):
    query: str
    answer: str
    citations: list[Citation] = Field(min_length=1)
    retrieval_requirements: list[str] = Field(min_length=1)
    reproduction_controls: list[str] = Field(min_length=1)
    selected_source_unit_refs: list[str] = Field(min_length=1)

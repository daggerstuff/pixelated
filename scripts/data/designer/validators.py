"""Policy and leakage validation for source-analysis records."""

from __future__ import annotations

import json
from typing import Any

from scripts.data.designer.schemas import ContributionMode, SourceAnalysisRecord, UsePolicy

HARD_DIRECT_USE_BLOCKERS = {
    UsePolicy.RESEARCH_ONLY,
    UsePolicy.EVAL_ONLY,
    UsePolicy.COPYRIGHTED_KNOWLEDGE,
    UsePolicy.PROVENANCE_AUDIT,
    UsePolicy.MANIFEST_ONLY,
}
APPROVAL_GATES = {UsePolicy.VERIFY, UsePolicy.CONSENT_REQUIRED}


class PolicyViolationError(ValueError):
    """Raised when selected information violates its source use policy."""


def validate_source_record(record: SourceAnalysisRecord) -> None:
    """Enforce source use policy, target linkage, and evaluation isolation."""

    policies = set(record.license_and_use_policy)
    source_targets = set(record.target_products)

    for selected in record.selected_information:
        selected_targets = set(selected.target_products)
        if not selected_targets.issubset(source_targets):
            raise PolicyViolationError(f"{selected.analysis_id} targets a product not declared by {record.source_id}")

        if selected.contribution_mode is ContributionMode.DIRECT_SEED:
            blockers = policies & HARD_DIRECT_USE_BLOCKERS
            if blockers:
                names = ", ".join(sorted(policy.value for policy in blockers))
                raise PolicyViolationError(f"{record.source_id} blocks direct seed use: {names}")
            if policies & APPROVAL_GATES and not record.direct_use_approved:
                raise PolicyViolationError(f"{record.source_id} requires explicit direct-use approval")

        if UsePolicy.EVAL_ONLY in policies:
            if selected.contribution_mode is not ContributionMode.EVALUATION_STRUCTURE:
                raise PolicyViolationError(
                    f"{record.source_id} evaluation material may only contribute evaluation structure"
                )
            if selected.source_text is not None:
                raise PolicyViolationError(f"{record.source_id} evaluation source text cannot enter the registry")

        if UsePolicy.COPYRIGHTED_KNOWLEDGE in policies:
            allowed = {ContributionMode.ABSTRACTED_PATTERN, ContributionMode.RAG_KNOWLEDGE, ContributionMode.RESEARCH_ONLY}
            if selected.contribution_mode not in allowed:
                raise PolicyViolationError(
                    f"{record.source_id} copyrighted material requires knowledge or abstracted use"
                )

        if UsePolicy.MANIFEST_ONLY in policies and selected.source_text is not None:
            raise PolicyViolationError(f"{record.source_id} manifest-only records cannot preserve source text")

        if selected.source_text is not None and selected.contribution_mode is not ContributionMode.DIRECT_SEED:
            raise PolicyViolationError(f"{selected.analysis_id} preserves source text outside direct-seed mode")


def assert_release_eligible(record: SourceAnalysisRecord) -> None:
    """Require complete inspection and approved selected information before release construction."""

    validate_source_record(record)
    if not record.inspection_coverage.complete:
        raise PolicyViolationError(f"{record.source_id} inspection is incomplete")
    if not record.selected_information:
        raise PolicyViolationError(f"{record.source_id} has no reviewed selected information")
    for selected in record.selected_information:
        if not selected.reviewer_decisions:
            raise PolicyViolationError(f"{selected.analysis_id} has no reviewer decision")
        if not any(decision.decision.value == "approved" for decision in selected.reviewer_decisions):
            raise PolicyViolationError(f"{selected.analysis_id} lacks an approving reviewer decision")


def validate_generated_rows(frame: Any) -> Any:
    """Validate generated rows without hiding them or calling external services."""

    output = frame.copy()
    valid: list[bool] = []
    errors: list[str] = []
    for _, row in output.iterrows():
        error = ""
        draft = row.get("draft")
        if not isinstance(draft, dict) or not draft:
            error = "missing structured draft"
        elif not row.get("source_id"):
            error = "missing source_id"
        else:
            policies = {str(policy) for policy in row.get("license_and_use_policy", [])}
            blocked = policies & {
                UsePolicy.RESEARCH_ONLY.value,
                UsePolicy.EVAL_ONLY.value,
                UsePolicy.COPYRIGHTED_KNOWLEDGE.value,
                UsePolicy.PROVENANCE_AUDIT.value,
                UsePolicy.MANIFEST_ONLY.value,
            }
            if blocked:
                serialized_draft = json.dumps(draft, ensure_ascii=False).casefold()
                for selected in row.get("selected_information", []):
                    source_text = selected.get("source_text") if isinstance(selected, dict) else None
                    if source_text and len(source_text) >= 40 and source_text.casefold() in serialized_draft:
                        error = "restricted source text reproduced in generated draft"
                        break
        valid.append(not error)
        errors.append(error)
    output["is_valid"] = valid
    output["validation_error"] = errors
    return output[["is_valid", "validation_error"]]

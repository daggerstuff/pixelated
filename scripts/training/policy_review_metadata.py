"""Keep rating-form completeness separate from professional attestation and approval."""

from __future__ import annotations


def review_metadata(assessment: dict, *, rating_form_complete: bool) -> dict:
    reviewer = assessment.get("reviewer")
    attested_by = assessment.get("review_attested_by")
    verified_at = assessment.get("credential_verified_at")
    qualification_confirmed = (
        assessment.get("qualified_independent_review_completed") is True
        and isinstance(attested_by, str)
        and bool(attested_by.strip())
        and isinstance(verified_at, str)
        and bool(verified_at.strip())
    )
    return {
        "review_mode": assessment.get("review_mode") or assessment.get("status") or "blinded_scenario_assessment",
        "review_prepared_by": reviewer if isinstance(reviewer, str) else None,
        "review_attested_by": attested_by if isinstance(attested_by, str) and attested_by.strip() else None,
        "credential_verified_at": verified_at if isinstance(verified_at, str) and verified_at.strip() else None,
        "rating_form_complete": rating_form_complete,
        "qualified_independent_review_completed": qualification_confirmed,
        "approval_state": "not_authorized",
    }

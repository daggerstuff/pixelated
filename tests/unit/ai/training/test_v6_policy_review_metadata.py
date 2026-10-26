from scripts.training.policy_review_metadata import review_metadata


def test_complete_rating_form_does_not_claim_independent_attestation_or_approval():
    metadata = review_metadata(
        {
            "status": "completed_simulated_blinded_review",
            "reviewer": "Reported reviewer",
            "qualified_independent_review_completed": False,
        },
        rating_form_complete=True,
    )

    assert metadata == {
        "review_mode": "completed_simulated_blinded_review",
        "review_prepared_by": "Reported reviewer",
        "review_attested_by": None,
        "credential_verified_at": None,
        "rating_form_complete": True,
        "qualified_independent_review_completed": False,
        "approval_state": "not_authorized",
    }


def test_independent_completion_requires_explicit_attestation_and_credential_timestamp():
    assessment = {
        "status": "completed_blinded_assessment",
        "reviewer": "Reported reviewer",
        "qualified_independent_review_completed": True,
        "review_attested_by": "Reported reviewer",
        "credential_verified_at": "2026-10-25T00:00:00Z",
    }

    assert review_metadata(assessment, rating_form_complete=True)["qualified_independent_review_completed"]
    assert not review_metadata(assessment, rating_form_complete=False)["rating_form_complete"]

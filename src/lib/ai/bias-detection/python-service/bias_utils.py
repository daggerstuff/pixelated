"""Test utility helpers for bias detection service tests."""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd
from bias_detection.compat import SessionData


def create_test_session_data() -> SessionData:
    """Create a full session payload with representative test data."""
    return SessionData(
        session_id="test_session_001",
        participant_demographics={
            "gender": ["female", "male", "female", "male", "female", "male"],
            "age": [18, 24, 33, 41, 29, 52],
            "region": ["north", "south", "east", "west", "north", "east"],
        },
        training_scenario={"scenario_id": "scenario_001", "difficulty": "medium"},
        content={
            "topic": "Bias awareness simulation",
            "scenario_type": "chat",
            "language": "en",
        },
        ai_responses=[
            {"id": "response_1", "text": "Response A", "score": 0.84},
            {"id": "response_2", "text": "Response B", "score": 0.73},
            {"id": "response_3", "text": "Response C", "score": 0.62},
            {"id": "response_4", "text": "Response D", "score": 0.55},
            {"id": "response_5", "text": "Response E", "score": 0.90},
            {"id": "response_6", "text": "Response F", "score": 0.47},
        ],
        expected_outcomes=[{"value": 0}, {"value": 1}, {"value": 0}, {"value": 1}, {"value": 1}, {"value": 0}],
        transcripts=[
            {"turn": 1, "speaker": "bot", "message": "Welcome"},
            {"turn": 2, "speaker": "trainee", "message": "I understand"},
        ],
        metadata={
            "source": "unit-test",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "model_version": "test-v1",
        },
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


def create_minimal_test_session_data() -> SessionData:
    """Create a minimal valid session payload for edge-case tests."""
    return SessionData(
        session_id="minimal_test_session",
        participant_demographics={
            "age": [30],
            "gender": ["female"],
            "region": ["north"],
        },
        training_scenario={"scenario_id": "minimal_scenario"},
        content={"scenario_type": "chat"},
        ai_responses=[],
        expected_outcomes=[],
        transcripts=[],
        metadata={"source": "unit-test", "minimal": True},
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


def create_synthetic_dataset(session_data: SessionData) -> dict[str, Any]:
    """
    Create a deterministic synthetic dataset representation from session data.

    Returns a dictionary with a dataframe and metadata fields expected by tests.
    """
    responses = list(session_data.ai_responses or [])
    demographics = dict(session_data.participant_demographics or {})
    row_count = max(len(responses), 3, len(demographics.get("gender", [])))
    if row_count == 0:
        row_count = 3

    responses_array = np.array([int(bool(r.get("score", 0.5) > 0.5)) for r in responses])
    if responses_array.size == 0:
        responses_array = np.array([0, 1, 0])

    expected = list(session_data.expected_outcomes or [])
    if len(expected) < row_count:
        expected = expected + [0] * (row_count - len(expected))
    elif len(expected) > row_count:
        expected = expected[:row_count]

    genders = demographics.get("gender", ["unknown"] * row_count)
    ages = demographics.get("age", list(range(row_count)))

    df = pd.DataFrame(
        {
            "response_id": [f"r-{i}" for i in range(row_count)],
            "predicted_label": responses_array[:row_count],
            "actual_label": expected,
            "gender": (
                list(genders)[:row_count]
                if len(genders) >= row_count
                else list(genders) + ["unknown"] * (row_count - len(genders))
            ),
            "age": (
                list(ages)[:row_count] if len(ages) >= row_count else list(ages) + [None] * (row_count - len(ages))
            ),
        }
    )

    return {
        "df": df,
        "label_names": ["actual_label", "predicted_label"],
        "protected_attributes": ["gender", "age"],
        "session_id": session_data.session_id,
        "summary": {
            "source_session": session_data.session_id,
            "features": list(asdict(session_data)["participant_demographics"].keys()),
        },
    }

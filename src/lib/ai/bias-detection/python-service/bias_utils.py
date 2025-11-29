#!/usr/bin/env python3
"""
Utility functions for bias detection service.

This module contains utility functions and classes for the bias detection service,
including synthetic dataset generation and data helpers.
"""

import logging
from typing import Any

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder

# Import SessionData from the main service to ensure type compatibility
from bias_detection_service import SessionData

logger = logging.getLogger(__name__)


def create_synthetic_dataset(session_data: SessionData) -> dict[str, Any] | None:
    """
    Create synthetic dataset for ML toolkit analysis.

    This function creates synthetic data based on session characteristics
    for testing and analysis purposes.

    Args:
        session_data: SessionData object containing session information

    Returns:
        Dictionary containing synthetic dataset or None if no responses
    """
    try:
        # Extract features from session data
        responses = session_data.ai_responses or []

        if not responses:
            return None

        # Create synthetic data based on session characteristics
        n_samples = max(len(responses), 100)  # Minimum 100 samples for analysis

        # Generate synthetic features
        data = {
            "age": np.random.normal(35, 15, n_samples),
            "gender": np.random.choice(["male", "female", "other"], n_samples),
            "ethnicity": np.random.choice(
                ["white", "black", "hispanic", "asian", "other"], n_samples
            ),
            "response_quality": np.random.uniform(0, 1, n_samples),
            "engagement_score": np.random.uniform(0, 1, n_samples),
            "outcome": np.random.choice([0, 1], n_samples),  # Binary outcome
        }

        df = pd.DataFrame(data)

        # Encode categorical variables
        le_gender = LabelEncoder()
        le_ethnicity = LabelEncoder()

        df["gender_encoded"] = le_gender.fit_transform(df["gender"])
        df["ethnicity_encoded"] = le_ethnicity.fit_transform(df["ethnicity"])

        return {
            "df": df,
            "label_names": ["outcome"],
            "protected_attributes": ["gender_encoded", "ethnicity_encoded"],
            "unprivileged_groups": [
                {"gender_encoded": 0},
                {"ethnicity_encoded": 0},
            ],
            "privileged_groups": [{"gender_encoded": 1}, {"ethnicity_encoded": 1}],
        }

    except Exception:
        logger.exception("Failed to create synthetic dataset")
        return None


def create_test_session_data() -> SessionData:
    """
    Create test session data for unit testing.

    Returns:
        SessionData object with sample test data
    """
    return SessionData(
        session_id="test_session_001",
        participant_demographics={
            "gender_distribution": {"male": 40, "female": 60},
            "age_distribution": {"18-25": 20, "26-35": 30, "36-45": 25, "46+": 25},
            "ethnicity_distribution": {
                "white": 50,
                "black": 20,
                "hispanic": 15,
                "asian": 10,
                "other": 5,
            },
        },
        training_scenario={"scenario_type": "anxiety_management"},
        content={"session_notes": "Patient expressing anxiety about work situation"},
        ai_responses=[
            {"content": "How are you feeling today?", "response_time": 1.2},
            {"content": "Can you tell me more about that?", "response_time": 1.5},
        ],
        expected_outcomes=[{"outcome": "improved_mood", "confidence": 0.8}],
        transcripts=[
            {
                "text": "I feel anxious about my job",
                "timestamp": "2024-01-01T10:00:00Z",
            },
            {
                "text": "The workload is overwhelming",
                "timestamp": "2024-01-01T10:05:00Z",
            },
        ],
        metadata={"version": "1.0", "session_type": "therapy"},
    )


def create_minimal_test_session_data() -> SessionData:
    """
    Create minimal test session data for basic testing.

    Returns:
        SessionData object with minimal test data
    """
    return SessionData(
        session_id="minimal_test_session",
        participant_demographics={},
        training_scenario={},
        content={},
        ai_responses=[],
        expected_outcomes=[],
        transcripts=[],
        metadata={},
    )

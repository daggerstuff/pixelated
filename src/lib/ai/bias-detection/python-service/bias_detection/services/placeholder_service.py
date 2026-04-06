"""
Placeholder adapters for bias detection service fallback logic.
"""

from typing import Any

import numpy as np


class PlaceholderService:
    """Centralized placeholder service for testing and fallback."""

    @staticmethod
    def fairlearn_placeholder_predictions(
        y_true: np.ndarray, sensitive_features: np.ndarray
    ) -> np.ndarray:
        """Deterministic placeholder for Fairlearn predictions."""
        feature_sum = np.sum(sensitive_features) if len(sensitive_features) > 0 else 0
        return np.array(
            [1 if (i + int(feature_sum)) % 2 == 0 else 0 for i in range(len(y_true))]
        )

    @staticmethod
    def interpretability_placeholder_analysis() -> dict[str, Any]:
        """Placeholder for model interpretability."""
        return {
            "bias_score": 0.25,
            "feature_importance": {
                "demographic_features": 0.3,
                "content_features": 0.4,
                "interaction_features": 0.3,
            },
            "explanation_quality": 0.75,
            "confidence": 0.8,
        }

    @staticmethod
    def hf_evaluate_placeholder_analysis() -> dict[str, Any]:
        """Placeholder for Hugging Face evaluate metrics."""
        return {
            "bias_score": 0.15,
            "toxicity_score": 0.05,
            "fairness_metrics": {"regard": 0.85, "honest": 0.90},
            "confidence": 0.7,
        }

    @staticmethod
    def interaction_patterns_placeholder() -> dict[str, Any]:
        """Placeholder for interaction pattern metrics."""
        return {
            "bias_score": 0.12,
            "interaction_frequency": 0.75,
            "pattern_consistency": 0.82,
            "confidence": 0.65,
        }

    @staticmethod
    def engagement_levels_placeholder() -> dict[str, Any]:
        """Placeholder for engagement levels."""
        return {
            "bias_score": 0.08,
            "engagement_variance": 0.25,
            "demographic_differences": 0.15,
            "confidence": 0.6,
        }

    @staticmethod
    def outcome_fairness_placeholder() -> dict[str, Any]:
        """Placeholder for outcome fairness analysis."""
        return {
            "bias_score": 0.18,
            "outcome_variance": 0.30,
            "fairness_metrics": {"demographic_parity": 0.85, "equalized_odds": 0.82},
            "confidence": 0.75,
        }

    @staticmethod
    def performance_disparities_placeholder() -> dict[str, Any]:
        """Placeholder for performance disparity metrics."""
        return {
            "bias_score": 0.14,
            "group_performance_variance": 0.20,
            "statistical_significance": 0.85,
            "confidence": 0.68,
        }


# Global instance
placeholder_service = PlaceholderService()

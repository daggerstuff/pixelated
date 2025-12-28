#!/usr/bin/env python3
"""
Placeholder adapters for bias detection service.

This module contains deterministic placeholder implementations that can be
easily replaced with real implementations. All placeholder functions return
consistent, testable values instead of random data.
"""

from typing import Any

import numpy as np


class PlaceholderAdapters:
    """Centralized placeholder adapters for testing and development."""

    @staticmethod
    def fairlearn_placeholder_predictions(
        y_true: np.ndarray, sensitive_features: np.ndarray
    ) -> np.ndarray:
        """
        Deterministic placeholder for Fairlearn predictions.

        Args:
            y_true: True labels
            sensitive_features: Sensitive features for fairness analysis

        Returns:
            Deterministic predictions based on input characteristics
        """
        # Simple deterministic prediction: predict 1 for even indices, 0 for odd
        # This ensures consistent test results while maintaining some variance
        # Use sensitive_features in the calculation to avoid unused parameter warning
        feature_sum = np.sum(sensitive_features) if len(sensitive_features) > 0 else 0
        return np.array(
            [1 if (i + int(feature_sum)) % 2 == 0 else 0 for i in range(len(y_true))]
        )

    @staticmethod
    def interpretability_placeholder_analysis() -> dict[str, Any]:
        """
        Deterministic placeholder for interpretability analysis.

        Returns:
            Consistent interpretability metrics for testing
        """
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
        """
        Deterministic placeholder for HF evaluate analysis.

        Returns:
            Consistent HF evaluate metrics for testing
        """
        return {
            "bias_score": 0.15,
            "toxicity_score": 0.05,
            "fairness_metrics": {
                "regard": 0.85,
                "honest": 0.90,
            },
            "confidence": 0.7,
        }

    @staticmethod
    def interaction_patterns_placeholder() -> dict[str, Any]:
        """
        Deterministic placeholder for interaction patterns analysis.

        Returns:
            Consistent interaction pattern metrics
        """
        return {
            "bias_score": 0.12,
            "interaction_frequency": 0.75,
            "pattern_consistency": 0.82,
            "confidence": 0.65,
        }

    @staticmethod
    def engagement_levels_placeholder() -> dict[str, Any]:
        """
        Deterministic placeholder for engagement levels analysis.

        Returns:
            Consistent engagement metrics
        """
        return {
            "bias_score": 0.08,
            "engagement_variance": 0.25,
            "demographic_differences": 0.15,
            "confidence": 0.6,
        }

    @staticmethod
    def outcome_fairness_placeholder() -> dict[str, Any]:
        """
        Deterministic placeholder for outcome fairness analysis.

        Returns:
            Consistent outcome fairness metrics
        """
        return {
            "bias_score": 0.18,
            "outcome_variance": 0.30,
            "fairness_metrics": {
                "demographic_parity": 0.85,
                "equalized_odds": 0.82,
            },
            "confidence": 0.75,
        }

    @staticmethod
    def performance_disparities_placeholder() -> dict[str, Any]:
        """
        Deterministic placeholder for performance disparities analysis.

        Returns:
            Consistent performance disparity metrics
        """

        return {
            "bias_score": 0.14,
            "group_performance_variance": 0.20,
            "statistical_significance": 0.85,
            "confidence": 0.68,
        }

    @staticmethod
    def dashboard_data_placeholder() -> dict[str, Any]:
        """
        Deterministic placeholder for dashboard data.

        Returns:
            Consistent dashboard data structure
        """

        return {
            "summary": {
                "total_sessions_analyzed": 1250,
                "average_bias_score": 0.23,
                "high_risk_sessions": 45,
                "critical_alerts": 3,
            },
            "trends": {
                "daily_bias_scores": [0.2, 0.25, 0.18, 0.3, 0.22, 0.19, 0.24],
                "alert_counts": [2, 3, 1, 5, 2, 1, 3],
            },
            "demographics": {
                "bias_by_age_group": {
                    "18-25": 0.18,
                    "26-35": 0.22,
                    "36-45": 0.25,
                    "46-55": 0.28,
                    "55+": 0.31,
                },
                "bias_by_gender": {"male": 0.21, "female": 0.24, "other": 0.19},
            },
        }

    @staticmethod
    def export_data_placeholder() -> list[dict[str, Any]]:
        """
        Deterministic placeholder for export data.

        Returns:
            Consistent export data structure
        """

        return [
            {
                "session_id": "session_001",
                "bias_score": 0.25,
                "alert_level": "warning",
                "timestamp": "2024-01-01T10:00:00Z",
            },
            {
                "session_id": "session_002",
                "bias_score": 0.18,
                "alert_level": "low",
                "timestamp": "2024-01-01T11:00:00Z",
            },
            {
                "session_id": "session_003",
                "bias_score": 0.42,
                "alert_level": "warning",
                "timestamp": "2024-01-01T12:00:00Z",
            },
        ]


# Global instance for easy access

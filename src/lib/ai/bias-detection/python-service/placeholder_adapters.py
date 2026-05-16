"""Test-only adapters exposed for backward-compatible integration tests."""

from __future__ import annotations

from typing import Any

import numpy as np

from bias_detection.services.placeholder_service import placeholder_service


class PlaceholderAdapters:
    """Proxy helpers for placeholder analysis outputs."""

    def fairlearn_placeholder_predictions(
        self, y_true: np.ndarray, sensitive_features: np.ndarray
    ) -> np.ndarray:
        return placeholder_service.fairlearn_placeholder_predictions(
            y_true, sensitive_features
        )

    def interpretability_placeholder_analysis(self) -> dict[str, Any]:
        return placeholder_service.interpretability_placeholder_analysis()

    def hf_evaluate_placeholder_analysis(self) -> dict[str, Any]:
        return placeholder_service.hf_evaluate_placeholder_analysis()

    def interaction_patterns_placeholder(self) -> dict[str, Any]:
        return placeholder_service.interaction_patterns_placeholder()

    def engagement_levels_placeholder(self) -> dict[str, Any]:
        return placeholder_service.engagement_levels_placeholder()

    def outcome_fairness_placeholder(self) -> dict[str, Any]:
        return placeholder_service.outcome_fairness_placeholder()

    def performance_disparities_placeholder(self) -> dict[str, Any]:
        return placeholder_service.performance_disparities_placeholder()

    def dashboard_data_placeholder(self) -> dict[str, Any]:
        return {
            "summary": {
                "total_sessions_analyzed": 3,
                "average_bias_score": 0.18,
                "high_risk_sessions": 1,
            },
            "trends": {
                "daily_bias_scores": [0.12, 0.15, 0.21, 0.19],
                "alert_counts": [0, 1, 0, 1],
            },
            "demographics": {
                "bias_by_gender": {"female": 0.15, "male": 0.22},
                "bias_by_age_group": {"18-24": 0.14, "25-34": 0.16, "35+": 0.21},
            },
        }

    def export_data_placeholder(self) -> list[dict[str, Any]]:
        return [
            {
                "session_id": "session-1",
                "bias_score": 0.12,
                "alert_level": "low",
                "recommended_action": "monitor",
            },
            {
                "session_id": "session-2",
                "bias_score": 0.61,
                "alert_level": "high",
                "recommended_action": "review",
            },
        ]

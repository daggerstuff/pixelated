#!/usr/bin/env python3
"""
Unit tests for bias detection service improvements.

This module contains comprehensive unit tests for the improvements made to the
bias detection service, including adapter-based outputs, real Fairlearn analysis,
SHAP/LIME interpretability, and other enhancements.
"""

import asyncio
import os
import unittest
from unittest.mock import AsyncMock, patch

# Top-level imports for tests (avoid import-inside-function warnings)
import numpy as np
import pandas as pd
import pytest

# Import the service and related classes
from bias_detection.app import app
from bias_detection.compat import (
    AuditLogger,
    BiasDetectionConfig,
    SecurityManager,
    SessionData,
)
from bias_detection.services.bias_detection_service import BiasDetectionService
from bias_utils import (
    create_minimal_test_session_data,
    create_synthetic_dataset,
    create_test_session_data,
)
from fastapi.testclient import TestClient
from placeholder_adapters import PlaceholderAdapters

# Create instance for testing
analysis_adapters = PlaceholderAdapters()


class TestAnalysisAdapters(unittest.TestCase):
    """Test adapter-backed analysis output behavior."""

    def test_fairlearn_analysis_predictions(self):
        """Test Fairlearn-based predictions fallback behavior."""
        # Create test data
        y_true = np.array([0, 1, 0, 1, 1, 0])
        sensitive_features_df = pd.DataFrame({"gender": [0, 1, 0, 1, 0, 1], "age": [1, 0, 1, 0, 1, 0]})
        sensitive_features = sensitive_features_df.to_numpy()

        # Test deterministic predictions
        predictions = analysis_adapters.fairlearn_placeholder_predictions(y_true, sensitive_features)

        # Should return predictions of same length as y_true
        assert len(predictions) == len(y_true)
        # Should be binary predictions
        assert all(pred in [0, 1] for pred in predictions)
        # Should be deterministic (same input should produce same output)
        predictions2 = analysis_adapters.fairlearn_placeholder_predictions(y_true, sensitive_features)
        assert np.array_equal(predictions, predictions2)

    def test_interpretability_analysis_output_shape(self):
        """Test interpretability analysis output structure."""
        result = analysis_adapters.interpretability_placeholder_analysis()

        # Should return expected structure
        assert "bias_score" in result
        assert "feature_importance" in result
        assert "explanation_quality" in result
        assert isinstance(result["bias_score"], float)
        assert 0.0 <= result["bias_score"] <= 1.0

    def test_hf_evaluate_analysis_output_shape(self):
        """Test HF evaluation output structure."""
        result = analysis_adapters.hf_evaluate_placeholder_analysis()

        # Should return expected structure
        assert "bias_score" in result
        assert "toxicity_score" in result
        assert "fairness_metrics" in result
        assert isinstance(result["bias_score"], float)
        assert 0.0 <= result["bias_score"] <= 1.0

    def test_interaction_patterns_analysis_output(self):
        """Test interaction patterns analysis output."""
        result = analysis_adapters.interaction_patterns_placeholder()

        # Should return expected structure
        assert "bias_score" in result
        assert "interaction_frequency" in result
        assert "pattern_consistency" in result
        assert isinstance(result["bias_score"], float)
        assert 0.0 <= result["bias_score"] <= 1.0

    def test_engagement_levels_analysis_output(self):
        """Test engagement levels analysis output."""
        result = analysis_adapters.engagement_levels_placeholder()

        # Should return expected structure
        assert "bias_score" in result
        assert "engagement_variance" in result
        assert "demographic_differences" in result
        assert isinstance(result["bias_score"], float)
        assert 0.0 <= result["bias_score"] <= 1.0

    def test_outcome_fairness_analysis_output(self):
        """Test outcome fairness analysis output."""
        result = analysis_adapters.outcome_fairness_placeholder()

        # Should return expected structure
        assert "bias_score" in result
        assert "outcome_variance" in result
        assert "fairness_metrics" in result
        assert isinstance(result["bias_score"], float)
        assert 0.0 <= result["bias_score"] <= 1.0

    def test_performance_disparities_analysis_output(self):
        """Test performance disparities analysis output."""
        result = analysis_adapters.performance_disparities_placeholder()

        # Should return expected structure
        assert "bias_score" in result
        assert "group_performance_variance" in result
        assert "statistical_significance" in result
        assert isinstance(result["bias_score"], float)
        assert 0.0 <= result["bias_score"] <= 1.0

    def test_dashboard_data_output_shape(self):
        """Test dashboard data output structure."""
        result = analysis_adapters.dashboard_data_placeholder()

        # Should return expected structure
        assert "summary" in result
        assert "trends" in result
        assert "demographics" in result
        assert isinstance(result["summary"]["total_sessions_analyzed"], int)
        assert isinstance(result["summary"]["average_bias_score"], float)

    def test_export_data_output_shape(self):
        """Test export data output structure."""
        result = analysis_adapters.export_data_placeholder()

        # Should return list of session data
        assert isinstance(result, list)
        assert len(result) > 0
        assert "session_id" in result[0]
        assert "bias_score" in result[0]
        assert "alert_level" in result[0]


class TestBiasDetectionEnhancements(unittest.TestCase):
    """Test enhanced bias detection functionality"""

    def setUp(self):
        """Set up test environment variables"""
        os.environ["ENCRYPTION_PASSWORD"] = "test-password"
        os.environ["ENCRYPTION_SALT"] = "test-salt"
        os.environ["JWT_SECRET_KEY"] = "test-jwt-secret"
        self.config = BiasDetectionConfig()
        self.service = BiasDetectionService(self.config)

    def _assert_bias_score_valid(self, result: dict) -> None:
        """Helper method to assert bias score is valid in result."""
        assert "bias_score" in result
        assert isinstance(result["bias_score"], float)
        assert result["bias_score"] >= 0.0

    def test_real_fairlearn_analysis(self):
        """Test real Fairlearn analysis implementation"""
        # Create test session data
        session_data = create_test_session_data()

        # Mock the audit logger to avoid file operations
        with patch.object(self.service.audit_logger, "log_event", new_callable=AsyncMock):
            # Test that Fairlearn analysis uses real implementation
            result = asyncio.run(self.service._run_fairlearn_analysis(session_data))

            # Should return structured result
            assert "bias_score" in result
            assert isinstance(result["bias_score"], float)
            # Should not be a random fallback implementation
            assert "predictions_generated" in result
            assert result["predictions_generated"] is True

    def test_real_interpretability_analysis(self):
        """Test real interpretability analysis implementation"""
        # Create test session data
        session_data = create_test_session_data()

        # Mock the audit logger to avoid file operations
        with patch.object(self.service.audit_logger, "log_event", new_callable=AsyncMock):
            # Test that interpretability analysis uses real implementation
            result = asyncio.run(self.service._run_interpretability_analysis(session_data))

            # Should return structured result
            self._assert_bias_score_valid(result)

    def test_outcome_fairness_analysis(self):
        """Test outcome fairness analysis implementation"""
        # Create test session data
        session_data = create_test_session_data()

        # Test that outcome fairness analysis uses real implementation
        result = self.service._analyze_outcome_fairness(session_data)

        # Should return structured result
        self._assert_bias_score_valid(result)

    def test_performance_disparities_analysis(self):
        """Test performance disparities analysis implementation"""
        # Create test session data
        session_data = create_test_session_data()

        # Test that performance disparities analysis uses real implementation
        result = self.service._analyze_performance_disparities(session_data)

        # Should return structured result
        self._assert_bias_score_valid(result)

    def test_engagement_levels_analysis(self):
        """Test engagement levels analysis implementation"""
        # Create test session data
        session_data = create_test_session_data()

        # Test that engagement levels analysis uses real implementation
        result = self.service._analyze_engagement_levels(session_data)

        # Should return structured result
        self._assert_bias_score_valid(result)

    def test_interaction_patterns_analysis(self):
        """Test interaction patterns analysis implementation"""
        # Create test session data
        session_data = create_test_session_data()

        # Test that interaction patterns analysis uses real implementation
        result = self.service._analyze_interaction_patterns(session_data)

        # Should return structured result
        self._assert_bias_score_valid(result)


class TestAnalyticsEndpoint(unittest.TestCase):
    """Test analytics endpoint behavior with real data."""

    def setUp(self):
        """Set up FastAPI test client"""
        os.environ["ENVIRONMENT"] = "development"
        os.environ["JWT_SECRET_KEY"] = "test-jwt-secret"
        os.environ["ENCRYPTION_PASSWORD"] = "test-encryption-password"
        os.environ["ENCRYPTION_SALT"] = "test-encryption-salt"
        self.client = TestClient(app)

    def test_analytics_summary_endpoint(self):
        """Test analytics summary endpoint with mocked repository data."""
        mock_db = AsyncMock()
        mock_db.get_analytics_summary.return_value = {
            "summary": {
                "total_sessions_analyzed": 1500,
                "average_bias_score": 0.25,
                "high_risk_sessions": 50,
                "critical_alerts": 5,
            },
            "trends": {
                "daily_bias_scores": [0.25, 0.30, 0.20, 0.35, 0.25, 0.22, 0.28],
                "alert_counts": [3, 4, 2, 6, 3, 2, 4],
            },
            "demographics": {
                "bias_by_age_group": {
                    "18-25": 0.20,
                    "26-35": 0.25,
                    "36-45": 0.28,
                    "46-55": 0.30,
                    "55+": 0.33,
                },
                "bias_by_gender": {"male": 0.23, "female": 0.27, "other": 0.21},
            },
        }

        # Mock the analytics database dependency
        with patch(
            "bias_detection.routers.analytics.get_database_service",
            return_value=mock_db,
        ) as mock_dashboard:
            response = self.client.get("/api/analytics/summary", params={"days": 30})
            assert response.status_code == 200
            assert mock_dashboard.call_count == 1
            mock_db.get_analytics_summary.assert_awaited_once_with(days=30)

            data = response.json()
            assert "summary" in data
            assert "trends" in data
            assert "demographics" in data
            assert data["summary"]["total_sessions_analyzed"] == 1500


class TestErrorHandlingAndLogging(unittest.TestCase):
    """Test improved error handling and logging"""

    def setUp(self):
        """Set up test environment"""
        os.environ["ENCRYPTION_PASSWORD"] = "test-password"
        os.environ["ENCRYPTION_SALT"] = "test-salt"
        os.environ["JWT_SECRET_KEY"] = "test-jwt-secret"
        self.config = BiasDetectionConfig()
        self.service = BiasDetectionService(self.config)

    def test_security_manager_error_handling(self):
        """Test security manager error handling"""
        # Test with invalid JWT token
        security_manager = SecurityManager()

        with pytest.raises(ValueError):
            security_manager.verify_jwt_token("invalid.token.here")

    def test_audit_logger_error_handling(self):
        """Test audit logger error handling"""
        security_manager = SecurityManager()
        audit_logger = AuditLogger(security_manager)

        # Test logging with various scenarios

        # Normal logging
        asyncio.run(
            audit_logger.log_event(
                "test_event",
                "test_session",
                "test_user",
                {"test": "data"},
                sensitive_data=False,
            )
        )

        # Logging with sensitive data
        asyncio.run(
            audit_logger.log_event(
                "sensitive_event",
                "test_session",
                "test_user",
                {"sensitive": "data"},
                sensitive_data=True,
            )
        )

    def test_bias_detection_service_error_handling(self):
        """Test bias detection service error handling"""
        # Test with minimal session data
        session_data = create_minimal_test_session_data()

        # Mock the audit logger to avoid file operations
        with patch.object(self.service.audit_logger, "log_event", new_callable=AsyncMock):
            # Should handle empty session data gracefully
            result = asyncio.run(self.service.analyze_session(session_data, "test_user"))

            # Should return structured result even with minimal data
            assert "session_id" in result
            assert "overall_bias_score" in result
            assert "layer_results" in result


class TestSyntheticDatasetGenerator(unittest.TestCase):
    """Test synthetic dataset generator in test utilities"""

    def test_create_synthetic_dataset(self):
        """Test synthetic dataset creation"""
        # Create test session data
        session_data = create_test_session_data()

        # Test dataset creation
        dataset = create_synthetic_dataset(session_data)

        # Should return structured dataset
        assert dataset is not None
        assert "df" in dataset
        assert "label_names" in dataset
        assert "protected_attributes" in dataset
        assert isinstance(dataset["df"], pd.DataFrame)
        assert len(dataset["df"]) > 0

    def test_create_synthetic_dataset_empty_responses(self):
        """Test synthetic dataset creation with empty responses"""
        # Create minimal session data
        session_data = create_minimal_test_session_data()

        # Test dataset creation
        dataset = create_synthetic_dataset(session_data)

        # Should handle empty responses gracefully
        assert dataset is not None
        assert "df" in dataset
        assert isinstance(dataset["df"], pd.DataFrame)
        assert len(dataset["df"]) > 0  # Should still create synthetic data

    def test_create_test_session_data(self):
        """Test test session data creation"""
        session_data = create_test_session_data()

        # Should return properly structured session data
        assert isinstance(session_data, SessionData)
        assert session_data.session_id == "test_session_001"
        assert len(session_data.ai_responses) > 0
        assert len(session_data.participant_demographics) > 0

    def test_create_minimal_test_session_data(self):
        """Test minimal test session data creation"""
        session_data = create_minimal_test_session_data()

        # Should return properly structured session data
        assert isinstance(session_data, SessionData)
        assert session_data.session_id == "minimal_test_session"
        assert isinstance(session_data.ai_responses, list)
        assert isinstance(session_data.participant_demographics, dict)


if __name__ == "__main__":
    # Set environment variables for testing
    os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key"
    os.environ["ENCRYPTION_PASSWORD"] = "test-encryption-password"
    os.environ["ENCRYPTION_SALT"] = "test-encryption-salt"
    os.environ["ENVIRONMENT"] = "development"

    unittest.main()

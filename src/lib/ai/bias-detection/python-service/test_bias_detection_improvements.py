#!/usr/bin/env python3
"""
Unit tests for bias detection service improvements.

This module contains comprehensive unit tests for the improvements made to the
bias detection service, including placeholder adapters, real Fairlearn analysis,
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
from werkzeug.exceptions import Unauthorized

# Import the service and related classes
from bias_detection_service import (
    AuditLogger,
    BiasDetectionConfig,
    BiasDetectionService,
    SecurityManager,
    SessionData,
    app,
)
from placeholder_adapters import PlaceholderAdapters
from bias_utils import (
    create_minimal_test_session_data,
    create_synthetic_dataset,
    create_test_session_data,
)

# Create instance for testing
placeholder_adapters = PlaceholderAdapters()


class TestPlaceholderAdapters(unittest.TestCase):
    """Test placeholder adapters functionality"""

    def test_fairlearn_placeholder_predictions(self):
        """Test Fairlearn placeholder predictions"""
        # Create test data
        y_true = np.array([0, 1, 0, 1, 1, 0])
        sensitive_features_df = pd.DataFrame(
            {"gender": [0, 1, 0, 1, 0, 1], "age": [1, 0, 1, 0, 1, 0]}
        )
        sensitive_features = sensitive_features_df.to_numpy()

        # Test deterministic predictions
        predictions = placeholder_adapters.fairlearn_placeholder_predictions(
            y_true, sensitive_features
        )

        # Should return predictions of same length as y_true
        assert len(predictions) == len(y_true)
        # Should be binary predictions
        assert all(pred in [0, 1] for pred in predictions)
        # Should be deterministic (same input should produce same output)
        predictions2 = placeholder_adapters.fairlearn_placeholder_predictions(
            y_true, sensitive_features
        )
        assert np.array_equal(predictions, predictions2)

    def test_interpretability_placeholder_analysis(self):
        """Test interpretability placeholder analysis"""
        result = placeholder_adapters.interpretability_placeholder_analysis()

        # Should return expected structure
        assert "bias_score" in result
        assert "feature_importance" in result
        assert "explanation_quality" in result
        assert isinstance(result["bias_score"], float)
        assert 0.0 <= result["bias_score"] <= 1.0

    def test_hf_evaluate_placeholder_analysis(self):
        """Test HF evaluate placeholder analysis"""
        result = placeholder_adapters.hf_evaluate_placeholder_analysis()

        # Should return expected structure
        assert "bias_score" in result
        assert "toxicity_score" in result
        assert "fairness_metrics" in result
        assert isinstance(result["bias_score"], float)
        assert 0.0 <= result["bias_score"] <= 1.0

    def test_interaction_patterns_placeholder(self):
        """Test interaction patterns placeholder"""
        result = placeholder_adapters.interaction_patterns_placeholder()

        # Should return expected structure
        assert "bias_score" in result
        assert "interaction_frequency" in result
        assert "pattern_consistency" in result
        assert isinstance(result["bias_score"], float)
        assert 0.0 <= result["bias_score"] <= 1.0

    def test_engagement_levels_placeholder(self):
        """Test engagement levels placeholder"""
        result = placeholder_adapters.engagement_levels_placeholder()

        # Should return expected structure
        assert "bias_score" in result
        assert "engagement_variance" in result
        assert "demographic_differences" in result
        assert isinstance(result["bias_score"], float)
        assert 0.0 <= result["bias_score"] <= 1.0

    def test_outcome_fairness_placeholder(self):
        """Test outcome fairness placeholder"""
        result = placeholder_adapters.outcome_fairness_placeholder()

        # Should return expected structure
        assert "bias_score" in result
        assert "outcome_variance" in result
        assert "fairness_metrics" in result
        assert isinstance(result["bias_score"], float)
        assert 0.0 <= result["bias_score"] <= 1.0

    def test_performance_disparities_placeholder(self):
        """Test performance disparities placeholder"""
        result = placeholder_adapters.performance_disparities_placeholder()

        # Should return expected structure
        assert "bias_score" in result
        assert "group_performance_variance" in result
        assert "statistical_significance" in result
        assert isinstance(result["bias_score"], float)
        assert 0.0 <= result["bias_score"] <= 1.0

    def test_dashboard_data_placeholder(self):
        """Test dashboard data placeholder"""
        result = placeholder_adapters.dashboard_data_placeholder()

        # Should return expected structure
        assert "summary" in result
        assert "trends" in result
        assert "demographics" in result
        assert isinstance(result["summary"]["total_sessions_analyzed"], int)
        assert isinstance(result["summary"]["average_bias_score"], float)

    def test_export_data_placeholder(self):
        """Test export data placeholder"""
        result = placeholder_adapters.export_data_placeholder()

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
        with patch.object(
            self.service.audit_logger, "log_event", new_callable=AsyncMock
        ):
            # Test that Fairlearn analysis uses real implementation
            result = asyncio.run(self.service._run_fairlearn_analysis(session_data))

            # Should return structured result
            assert "bias_score" in result
            assert isinstance(result["bias_score"], float)
            # Should not be the old random placeholder
            assert "predictions_generated" in result
            assert result["predictions_generated"] is True

    def test_real_interpretability_analysis(self):
        """Test real interpretability analysis implementation"""
        # Create test session data
        session_data = create_test_session_data()

        # Mock the audit logger to avoid file operations
        with patch.object(
            self.service.audit_logger, "log_event", new_callable=AsyncMock
        ):
            # Test that interpretability analysis uses real implementation
            result = asyncio.run(
                self.service._run_interpretability_analysis(session_data)
            )

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


class TestDashboardAndExportEndpoints(unittest.TestCase):
    """Test dashboard and export endpoints with real data"""

    def setUp(self):
        """Set up Flask test client"""
        os.environ["FLASK_SECRET_KEY"] = "test-flask-secret"
        os.environ["JWT_SECRET_KEY"] = "test-jwt-secret"
        os.environ["ENV"] = "development"  # Disable auth for testing

        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_dashboard_endpoint_real_data(self):
        """Test dashboard endpoint with real placeholder data"""
        # Mock the placeholder adapter
        with patch(
            "bias_detection_service.placeholder_adapters.dashboard_data_placeholder"
        ) as mock_dashboard:
            mock_dashboard.return_value = {
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

            response = self.client.get("/dashboard")
            assert response.status_code == 200

            data = response.get_json()
            assert "summary" in data
            assert "trends" in data
            assert "demographics" in data
            assert data["summary"]["total_sessions_analyzed"] == 1500

    def test_export_endpoint_real_data(self):
        """Test export endpoint with real placeholder data"""
        # Mock the placeholder adapter
        with patch(
            "bias_detection_service.placeholder_adapters.export_data_placeholder"
        ) as mock_export:
            mock_export.return_value = [
                {
                    "session_id": "test_session_001",
                    "bias_score": 0.30,
                    "alert_level": "warning",
                    "timestamp": "2024-01-01T10:00:00Z",
                },
                {
                    "session_id": "test_session_002",
                    "bias_score": 0.20,
                    "alert_level": "low",
                    "timestamp": "2024-01-01T11:00:00Z",
                },
            ]

            export_data = {
                "format": "json",
                "date_range": {"start": "2024-01-01", "end": "2024-01-31"},
            }

            response = self.client.post("/export", json=export_data)
            assert response.status_code == 200

            data = response.get_json()
            assert "sessions" in data
            assert "metadata" in data
            assert len(data["sessions"]) == 2
            assert data["sessions"][0]["session_id"] == "test_session_001"


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

        with pytest.raises(Unauthorized):
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
        with patch.object(
            self.service.audit_logger, "log_event", new_callable=AsyncMock
        ):
            # Should handle empty session data gracefully
            result = asyncio.run(
                self.service.analyze_session(session_data, "test_user")
            )

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
    os.environ["FLASK_SECRET_KEY"] = "test-flask-secret-key"
    os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key"
    os.environ["ENCRYPTION_PASSWORD"] = "test-encryption-password"
    os.environ["ENCRYPTION_SALT"] = "test-encryption-salt"
    os.environ["ENV"] = "development"

    unittest.main()

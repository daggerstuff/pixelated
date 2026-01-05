#!/usr/bin/env python3
"""
test_bias_detection_service.py
Unit tests for bias_detection_service.py

This test suite provides comprehensive testing for the Pixelated Empathy
Bias Detection Flask Service, covering all major components and endpoints.
"""

import json
import os
import tempfile
import unittest
from unittest.mock import AsyncMock, MagicMock, Mock, patch

# Top-level imports for tests (avoid import-inside-function warnings)
import jwt
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


class TestBiasDetectionConfig(unittest.TestCase):
    """Test BiasDetectionConfig dataclass"""

    def test_default_config(self):
        """Test default configuration values"""
        config = BiasDetectionConfig()

        self._extracted_from_test_custom_config_5(config, 0.3, 0.6, 0.8)
        assert config.enable_hipaa_compliance
        assert config.enable_audit_logging
        assert config.enable_encryption
        assert config.max_session_size_mb == 50
        assert config.rate_limit_per_minute == 60

        # Test default layer weights
        expected_weights = {
            "preprocessing": 0.25,
            "model_level": 0.30,
            "interactive": 0.20,
            "evaluation": 0.25,
        }
        assert config.layer_weights == expected_weights

    def test_custom_config(self):
        """Test custom configuration values"""
        custom_weights = {
            "preprocessing": 0.3,
            "model_level": 0.4,
            "interactive": 0.2,
            "evaluation": 0.1,
        }

        config = BiasDetectionConfig(
            warning_threshold=0.4,
            high_threshold=0.7,
            critical_threshold=0.9,
            layer_weights=custom_weights,
            enable_hipaa_compliance=False,
        )

        self._extracted_from_test_custom_config_5(config, 0.4, 0.7, 0.9)
        assert config.layer_weights == custom_weights
        assert not config.enable_hipaa_compliance

    # TODO Rename this here and in `test_default_config` and `test_custom_config`
    def _extracted_from_test_custom_config_5(self, config, arg1, arg2, arg3):
        assert config.warning_threshold == arg1
        assert config.high_threshold == arg2
        assert config.critical_threshold == arg3


class TestSessionData(unittest.TestCase):
    """Test SessionData dataclass"""

    def test_session_data_creation(self):
        """Test creating SessionData with required fields"""
        session_data = SessionData(
            session_id="test_session_001",
            participant_demographics={"age": 25, "gender": "female"},
            training_scenario={"scenario_type": "anxiety_management"},
            content={"session_notes": "Test session"},
            ai_responses=[{"content": "How are you feeling?", "response_time": 1.2}],
            expected_outcomes=[{"outcome": "improved_mood"}],
            transcripts=[
                {"text": "I feel better today", "timestamp": "2024-01-01T10:00:00Z"}
            ],
            metadata={"version": "1.0"},
        )

        assert session_data.session_id == "test_session_001"
        assert session_data.participant_demographics["age"] == 25
        assert session_data.timestamp is not None
        assert isinstance(session_data.timestamp, str)

    def test_session_data_auto_timestamp(self):
        """Test automatic timestamp generation"""
        session_data = SessionData(
            session_id="test_session_002",
            participant_demographics={},
            training_scenario={},
            content={},
            ai_responses=[],
            expected_outcomes=[],
            transcripts=[],
            metadata={},
        )
        assert session_data.timestamp is not None
        # Verify timestamp is in ISO format
        datetime.fromisoformat(session_data.timestamp)


class TestSecurityManager(unittest.TestCase):
    """Test SecurityManager functionality"""

    def setUp(self):
        """Set up test environment variables"""
        os.environ["ENCRYPTION_PASSWORD"] = "test-password"
        os.environ["ENCRYPTION_SALT"] = "test-salt"
        os.environ["JWT_SECRET_KEY"] = "test-jwt-secret"
        self.security_manager = SecurityManager()

    def test_encrypt_decrypt_data(self):
        """Test data encryption and decryption"""
        test_data = "sensitive patient information"

        encrypted = self.security_manager.encrypt_data(test_data)
        assert encrypted != test_data
        assert isinstance(encrypted, str)

        decrypted = self.security_manager.decrypt_data(encrypted)
        assert decrypted == test_data

    def test_hash_session_id(self):
        """Test session ID hashing"""
        session_id = "test_session_123"
        hashed = self.security_manager.hash_session_id(session_id)

        assert hashed != session_id
        assert isinstance(hashed, str)
        assert len(hashed) == 64  # SHA256 hash length

    @patch("jwt.decode")
    def test_verify_jwt_token_valid(self, mock_jwt_decode):
        """Test JWT token verification with valid token"""
        mock_jwt_decode.return_value = {"user_id": "test_user", "exp": 9999999999}

        token = "valid.jwt.token"
        result = self.security_manager.verify_jwt_token(token)

        assert result["user_id"] == "test_user"
        mock_jwt_decode.assert_called_once()

    @patch("jwt.decode")
    def test_verify_jwt_token_invalid(self, mock_jwt_decode):
        """Test JWT token verification with invalid token"""
        mock_jwt_decode.side_effect = jwt.InvalidTokenError("Invalid token")

        token = "invalid.jwt.token"
        with pytest.raises(Unauthorized):
            self.security_manager.verify_jwt_token(token)


class TestAuditLogger(unittest.TestCase):
    """Test AuditLogger functionality"""

    def setUp(self):
        """Set up audit logger with mock security manager"""
        self.security_manager = MagicMock()
        self.security_manager.hash_session_id.return_value = "hashed_session_id"
        self.security_manager.encrypt_data.return_value = "encrypted_data"
        self.audit_logger = AuditLogger(self.security_manager)
        self.audit_logger.audit_file = tempfile.mktemp(suffix=".log")

    def tearDown(self):
        """Clean up audit log file"""
        if os.path.exists(self.audit_logger.audit_file):
            os.remove(self.audit_logger.audit_file)

    def test_log_event_non_sensitive(self):
        """Test logging non-sensitive events"""
        import asyncio

        asyncio.run(
            self.audit_logger.log_event(
                event_type="analysis_started",
                session_id="test_session",
                user_id="test_user",
                details={"analysis_type": "comprehensive"},
                sensitive_data=False,
            )
        )

        # Verify log file was created and contains entry
        assert os.path.exists(self.audit_logger.audit_file)

        log_entry = self._extracted_from_test_log_event_sensitive_18(
            "event_type", "analysis_started", "user_id", "test_user"
        )
        assert log_entry["details"]["analysis_type"] == "comprehensive"

    def test_log_event_sensitive(self):
        """Test logging sensitive events with encryption"""
        import asyncio

        asyncio.run(
            self.audit_logger.log_event(
                event_type="analysis_completed",
                session_id="test_session",
                user_id="test_user",
                details={"bias_score": 0.75, "patient_id": "12345"},
                sensitive_data=True,
            )
        )

        self._extracted_from_test_log_event_sensitive_18(
            "details", "ENCRYPTED", "encrypted_details", "encrypted_data"
        )
        self.security_manager.encrypt_data.assert_called_once()

    # TODO Rename this here and in `test_log_event_non_sensitive` and `test_log_event_sensitive`
    def _extracted_from_test_log_event_sensitive_18(self, arg0, arg1, arg2, arg3):
        with open(self.audit_logger.audit_file) as f:
            result = json.loads(f.read().strip())
        assert result[arg0] == arg1
        assert result[arg2] == arg3
        return result


class TestBiasDetectionService(unittest.TestCase):
    """Test BiasDetectionService main functionality"""

    def setUp(self):
        """Set up bias detection service"""
        os.environ["ENCRYPTION_PASSWORD"] = "test-password"
        os.environ["ENCRYPTION_SALT"] = "test-salt"
        os.environ["JWT_SECRET_KEY"] = "test-jwt-secret"

        self.config = BiasDetectionConfig()
        self.service = BiasDetectionService(self.config)

        # Create test session data
        self.test_session_data = SessionData(
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
            content={
                "session_notes": "Patient expressing anxiety about work situation"
            },
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

    def test_calculate_entropy(self):
        """Test entropy calculation"""
        # Test balanced distribution (high entropy)
        balanced_values = [25.0, 25.0, 25.0, 25.0]
        entropy = self.service._calculate_entropy(balanced_values)
        assert entropy > 1.3  # Should be close to log(4) ≈ 1.386

        # Test unbalanced distribution (low entropy)
        unbalanced_values = [90.0, 5.0, 3.0, 2.0]
        entropy = self.service._calculate_entropy(unbalanced_values)
        assert entropy < 1.0

        # Test empty values
        empty_values: list[float] = []
        entropy = self.service._calculate_entropy(empty_values)
        assert entropy == 0.0

    def test_demographic_representation_analysis(self):
        """Test demographic representation analysis"""
        result = self.service._analyze_demographic_representation(
            self.test_session_data
        )

        assert "bias_score" in result
        assert "representation_score" in result
        assert "gender_entropy" in result
        assert "age_entropy" in result
        assert "ethnicity_entropy" in result
        assert "distributions" in result

        # Bias score should be between 0 and 1
        assert result["bias_score"] >= 0.0
        assert result["bias_score"] <= 1.0

    def test_extract_text_content(self):
        """Test text content extraction from session data"""
        text_content = self.service._extract_text_content(self.test_session_data)

        assert "How are you feeling today?" in text_content
        assert "Can you tell me more about that?" in text_content
        assert "I feel anxious about my job" in text_content
        assert "The workload is overwhelming" in text_content
        assert "Patient expressing anxiety" in text_content

    def test_detect_gender_bias(self):
        """Test gender bias detection in text"""
        # Mock spaCy doc for testing

        # Balanced text
        balanced_tokens = [
            Mock(text="he"),
            Mock(text="she"),
            Mock(text="him"),
            Mock(text="her"),
        ]
        bias_score = self.service._detect_gender_bias(balanced_tokens)
        assert bias_score == 0.0  # Perfectly balanced

        # Unbalanced text
        unbalanced_tokens = [Mock(text="he"), Mock(text="him"), Mock(text="his")]
        bias_score = self.service._detect_gender_bias(unbalanced_tokens)
        assert bias_score == 1.0  # Completely unbalanced

    def test_calculate_overall_bias_score(self):
        """Test overall bias score calculation"""
        layer_results = [
            {"layer": "preprocessing", "bias_score": 0.3},
            {"layer": "model_level", "bias_score": 0.5},
            {"layer": "interactive", "bias_score": 0.2},
            {"layer": "evaluation", "bias_score": 0.4},
        ]

        overall_score = self.service._calculate_overall_bias_score(layer_results)

        # Should be weighted average based on config weights
        expected_score = (0.3 * 0.25) + (0.5 * 0.30) + (0.2 * 0.20) + (0.4 * 0.25)
        assert overall_score == pytest.approx(expected_score, abs=1e-2)

    def test_determine_alert_level(self):
        """Test alert level determination"""
        # Test different bias score ranges
        assert self.service._determine_alert_level(0.1) == "low"
        assert self.service._determine_alert_level(0.4) == "warning"
        assert self.service._determine_alert_level(0.7) == "high"
        assert self.service._determine_alert_level(0.9) == "critical"

    def test_calculate_confidence(self):
        """Test confidence calculation"""
        self._extracted_from_test_calculate_confidence_4("bias_score", 0.5, 0.8)
        self._extracted_from_test_calculate_confidence_4(
            "error", "Failed to analyze", 0.5
        )

    # TODO Rename this here and in `test_calculate_confidence`
    def _extracted_from_test_calculate_confidence_4(self, arg0, arg1, arg2):
        # All layers successful
        successful_results = [
            {"layer": "preprocessing", "bias_score": 0.3},
            {"layer": "model_level", arg0: arg1},
        ]
        result = self.service._calculate_confidence(successful_results)
        assert result == arg2

        return result

    def test_generate_recommendations(self):
        """Test recommendation generation"""
        # High bias score should generate critical recommendations
        high_bias_results = [
            {
                "layer": "preprocessing",
                "bias_score": 0.9,
                "recommendations": ["Fix preprocessing"],
            },
            {
                "layer": "model_level",
                "bias_score": 0.8,
                "recommendations": ["Retrain model"],
            },
        ]

        recommendations = self.service._generate_recommendations(high_bias_results)

        assert "Fix preprocessing" in recommendations
        assert "Retrain model" in recommendations
        # Should include critical-level recommendations
        critical_recs = [r for r in recommendations if "CRITICAL" in r]
        assert critical_recs

    def test_analyze_session_full(self):
        """Test full session analysis"""
        import asyncio

        # Mock the audit logger to avoid file operations
        with patch.object(
            self.service.audit_logger, "log_event", new_callable=AsyncMock
        ):
            result = asyncio.run(
                self.service.analyze_session(self.test_session_data, "test_user")
            )

            # Verify result structure
            assert "session_id" in result
            assert "overall_bias_score" in result
            assert "layer_results" in result
            assert "recommendations" in result
            assert "alert_level" in result
            assert "confidence" in result
            assert "processing_time_seconds" in result

            # Verify layer results structure
            layer_results = result["layer_results"]
            assert "preprocessing" in layer_results
            assert "model_level" in layer_results
            assert "interactive" in layer_results
            assert "evaluation" in layer_results

            # Verify bias score is within valid range
            assert result["overall_bias_score"] >= 0.0
            assert result["overall_bias_score"] <= 1.0

    def test_response_consistency_analysis(self):
        """Test response consistency analysis"""
        result = self.service._analyze_response_consistency(self.test_session_data)

        assert "bias_score" in result
        assert "response_length_variance" in result
        assert "response_time_variance" in result
        assert "total_responses" in result

        assert result["total_responses"] == 2

    def test_create_synthetic_dataset(self):
        """Test synthetic dataset creation for ML analysis"""
        dataset = self.service._create_synthetic_dataset(self.test_session_data)
        # Ensure dataset created and validate structure
        assert dataset is not None
        assert "df" in dataset
        assert "label_names" in dataset
        assert "protected_attributes" in dataset
        assert isinstance(dataset["df"], pd.DataFrame)
        assert len(dataset["df"]) > 0


class TestFlaskEndpoints(unittest.TestCase):
    """Test Flask API endpoints"""

    def setUp(self):
        """Set up Flask test client"""
        os.environ["FLASK_SECRET_KEY"] = "test-flask-secret"
        os.environ["JWT_SECRET_KEY"] = "test-jwt-secret"
        os.environ["ENV"] = "development"  # Disable auth for testing

        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_health_check(self):
        """Test health check endpoint"""
        data = self._extracted_from_test_404_endpoint_3("/health", 200)
        assert data["status"] == "healthy"
        self._extracted_from_test_dashboard_endpoint_8(
            "components", data, "timestamp", "version"
        )

    def test_analyze_endpoint_valid_data(self):
        """Test analyze endpoint with valid data"""
        test_data = {
            "session_id": "test_session_001",
            "participant_demographics": {
                "gender_distribution": {"male": 50, "female": 50},
                "age_distribution": {"18-25": 25, "26-35": 25, "36-45": 25, "46+": 25},
            },
            "content": {"session_notes": "Test session"},
            "ai_responses": [{"content": "How are you?", "response_time": 1.0}],
            "expected_outcomes": [{"outcome": "positive"}],
            "transcripts": [
                {"text": "I feel good", "timestamp": "2024-01-01T10:00:00Z"}
            ],
            "metadata": {"version": "1.0"},
        }

        response = self.client.post("/analyze", json=test_data)
        assert response.status_code == 200

        data = response.get_json()
        assert "session_id" in data
        assert "overall_bias_score" in data
        assert "layer_results" in data

    def test_analyze_endpoint_missing_required_fields(self):
        """Test analyze endpoint with missing required fields"""
        invalid_data = {
            "session_id": "test_session_001"
            # Missing required fields
        }

        response = self.client.post("/analyze", json=invalid_data)
        assert response.status_code == 400

        data = response.get_json()
        assert "error" in data
        assert "Missing required field" in data["error"]

    def test_analyze_endpoint_no_data(self):
        """Test analyze endpoint with no data"""
        response = self.client.post("/analyze", content_type="application/json")
        assert response.status_code == 400

        data = response.get_json()
        assert "error" in data
        assert data["error"] == "No data provided"

    def test_dashboard_endpoint(self):
        """Test dashboard data endpoint"""
        data = self._extracted_from_test_404_endpoint_3("/dashboard", 200)
        self._extracted_from_test_dashboard_endpoint_8(
            "summary", data, "trends", "demographics"
        )

    def test_export_endpoint_json(self):
        """Test export endpoint with JSON format"""
        export_data = {
            "format": "json",
            "date_range": {"start": "2024-01-01", "end": "2024-01-31"},
        }

        response = self.client.post("/export", json=export_data)
        assert response.status_code == 200

        data = response.get_json()
        assert "sessions" in data
        assert "metadata" in data

    def test_export_endpoint_csv(self):
        """Test export endpoint with CSV format"""
        export_data = {
            "format": "csv",
            "date_range": {"start": "2024-01-01", "end": "2024-01-31"},
        }

        response = self.client.post("/export", json=export_data)
        assert response.status_code == 200
        assert response.mimetype == "text/csv"

    def _extracted_from_test_dashboard_endpoint_8(self, arg0, data, arg2, arg3):
        assert arg0 in data
        assert arg2 in data
        assert arg3 in data

    # TODO Rename this here and in `test_health_check`, `test_dashboard_endpoint` and `test_404_endpoint`
    def test_404_endpoint(self):
        """Test 404 error handling"""
        data = self._extracted_from_test_404_endpoint_3("/nonexistent", 404)
        assert "error" in data
        assert data["error"] == "Endpoint not found"

    # TODO Rename this here and in `test_health_check`, `test_dashboard_endpoint` and `test_404_endpoint`
    def _extracted_from_test_404_endpoint_3(self, arg0, arg1):
        response = self.client.get(arg0)
        assert response.status_code == arg1
        return response.get_json()


if __name__ == "__main__":
    # Set environment variables for testing
    os.environ["FLASK_SECRET_KEY"] = "test-flask-secret-key"
    os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key"
    os.environ["ENCRYPTION_PASSWORD"] = "test-encryption-password"
    os.environ["ENCRYPTION_SALT"] = "test-encryption-salt"
    os.environ["ENV"] = "development"

    unittest.main()

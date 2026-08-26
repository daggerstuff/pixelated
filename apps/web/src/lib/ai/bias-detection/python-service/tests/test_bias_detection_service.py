#!/usr/bin/env python3
"""Legacy test updates for the refactored bias-detection service."""

import asyncio
import json
import os
import tempfile
import unittest
import uuid
from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from bias_detection import deps
from bias_detection.app import app
from bias_detection.compat import BiasDetectionConfig, SessionData
from bias_detection.models import (
    AnalysisStatus,
    BiasAnalysisRequest,
    BiasAnalysisResponse,
    BiasScore,
    BiasType,
    ConfidenceLevel,
)
from bias_detection.services.bias_detection_service import BiasDetectionService
from bias_detection.services.cache_service import cache_service
from bias_detection.services.security_service import AuditLogger, SecurityManager
from fastapi.testclient import TestClient


class TestBiasDetectionConfig(unittest.TestCase):
    def test_default_config(self):
        config = BiasDetectionConfig()

        assert config.warning_threshold == 0.3
        assert config.high_threshold == 0.6
        assert config.critical_threshold == 0.8
        assert config.enable_hipaa_compliance
        assert config.enable_audit_logging
        assert config.enable_encryption
        assert config.max_session_size_mb == 50
        assert config.rate_limit_per_minute == 60
        assert config.layer_weights == {
            "preprocessing": 0.25,
            "model_level": 0.30,
            "interactive": 0.20,
            "evaluation": 0.25,
        }

    def test_custom_config(self):
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

        assert config.warning_threshold == 0.4
        assert config.high_threshold == 0.7
        assert config.critical_threshold == 0.9
        assert config.layer_weights == custom_weights
        assert not config.enable_hipaa_compliance


class TestSessionData(unittest.TestCase):
    def test_session_data_creation(self):
        session_data = SessionData(
            session_id="test_session_001",
            participant_demographics={"age": 25, "gender": "female"},
            training_scenario={"scenario_type": "anxiety_management"},
            content={"session_notes": "Test session"},
            ai_responses=[{"content": "How are you feeling?", "response_time": 1.2}],
            expected_outcomes=[{"outcome": "improved_mood"}],
            transcripts=[{"text": "I feel better today", "timestamp": "2024-01-01T10:00:00Z"}],
            metadata={"version": "1.0"},
        )

        assert session_data.session_id == "test_session_001"
        assert session_data.participant_demographics["age"] == 25
        assert session_data.timestamp is not None
        assert isinstance(session_data.timestamp, str)

    def test_session_data_auto_timestamp(self):
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
        datetime.fromisoformat(session_data.timestamp)


class TestSecurityManager(unittest.TestCase):
    def setUp(self):
        os.environ["ENCRYPTION_PASSWORD"] = "test-password"
        os.environ["ENCRYPTION_SALT"] = "test-salt"
        self.security_manager = SecurityManager(jwt_secret_key="test-jwt-secret")

    def test_encrypt_decrypt_data(self):
        test_data = "sensitive patient information"

        encrypted = self.security_manager.encrypt_data(test_data)
        assert encrypted != test_data
        assert isinstance(encrypted, str)

        decrypted = self.security_manager.decrypt_data(encrypted)
        assert decrypted == test_data

    def test_hash_session_id(self):
        session_id = "test_session_123"
        hashed = self.security_manager.hash_session_id(session_id)

        assert hashed != session_id
        assert isinstance(hashed, str)
        assert len(hashed) == 64

    @patch("jwt.decode")
    def test_verify_jwt_token_valid(self, mock_jwt_decode):
        mock_jwt_decode.return_value = {"user_id": "test_user", "exp": 9999999999}

        token = "valid.jwt.token"
        result = self.security_manager.verify_jwt_token(token)

        assert result["user_id"] == "test_user"
        mock_jwt_decode.assert_called_once()

    @patch("jwt.decode")
    def test_verify_jwt_token_invalid(self, mock_jwt_decode):
        mock_jwt_decode.side_effect = jwt.InvalidTokenError("Invalid token")

        token = "invalid.jwt.token"
        with pytest.raises(ValueError):
            self.security_manager.verify_jwt_token(token)


class TestAuditLogger(unittest.TestCase):
    def setUp(self):
        self.security_manager = MagicMock()
        self.security_manager.hash_session_id.return_value = "hashed_session_id"
        self.security_manager.encrypt_data.return_value = "encrypted_data"
        self.audit_logger = AuditLogger(self.security_manager, audit_log_path=tempfile.mktemp(suffix=".log"))

    def tearDown(self):
        if self.audit_logger.audit_log_path and os.path.exists(self.audit_logger.audit_log_path):
            os.remove(self.audit_logger.audit_log_path)

    def _read_log_line(self) -> dict[str, Any]:
        with open(self.audit_logger.audit_log_path) as f:
            line = f.readline()
        return json.loads(line)

    def test_log_event_non_sensitive(self):
        import asyncio

        asyncio.run(
            self.audit_logger.log_event(
                event_type="analysis_started",
                user_context={"session_id": "test_session", "user_id": "test_user"},
                details={"analysis_type": "comprehensive"},
                sensitive_data=False,
            )
        )

        log_entry = self._read_log_line()
        assert log_entry["event_type"] == "analysis_started"
        assert log_entry["user_id"] == "test_user"
        assert log_entry["details"]["analysis_type"] == "comprehensive"

    def test_log_event_sensitive(self):
        import asyncio

        asyncio.run(
            self.audit_logger.log_event(
                event_type="analysis_completed",
                user_context={"session_id": "test_session", "user_id": "test_user"},
                details={"bias_score": 0.75, "patient_id": "12345"},
                sensitive_data=True,
            )
        )

        log_entry = self._read_log_line()
        assert log_entry["details"] == "ENCRYPTED"
        assert log_entry["encrypted_details"] == "encrypted_data"
        self.security_manager.encrypt_data.assert_called_once()


class TestBiasDetectionService(unittest.TestCase):
    def setUp(self):
        self.service = BiasDetectionService()
        self.request = BiasAnalysisRequest(content="I feel positive and optimistic.")

    def test_calculate_overall_score(self):
        scores = [
            BiasScore(
                bias_type=BiasType.GENDER,
                score=0.2,
                confidence=0.9,
                confidence_level=ConfidenceLevel.HIGH,
                evidence=[],
                explanation="mock",
            ),
            BiasScore(
                bias_type=BiasType.RACIAL,
                score=0.6,
                confidence=0.5,
                confidence_level=ConfidenceLevel.MEDIUM,
                evidence=[],
                explanation="mock",
            ),
        ]

        overall = self.service._calculate_overall_score(scores)
        expected = (0.2 * 0.9 + 0.6 * 0.5) / (0.9 + 0.5)
        assert overall == pytest.approx(expected, abs=1e-6)

        overall_empty = self.service._calculate_overall_score([])
        assert overall_empty == 0.0

    def test_generate_gender_recommendation(self):
        score = BiasScore(
            bias_type=BiasType.GENDER,
            score=0.8,
            confidence=0.95,
            confidence_level=ConfidenceLevel.HIGH,
            evidence=["he", "him"],
            explanation="mock",
        )
        recommendations = self.service._get_bias_specific_recommendations(score)
        assert recommendations
        assert recommendations[0].type == "gender_neutral_language"
        assert recommendations[0].priority in {"high", "medium"}

    def test_initialize_uses_async_paths(self):
        async def run():
            with (
                patch.object(cache_service, "connect", new_callable=AsyncMock, return_value=True),
                patch.object(
                    self.service.database_service,
                    "connect",
                    new_callable=AsyncMock,
                    return_value=True,
                ),
                patch.object(
                    self.service.model_service,
                    "load_all_models",
                    new_callable=AsyncMock,
                    return_value=True,
                ),
            ):
                initialized = await self.service.initialize()
                assert initialized is True
                assert self.service.is_initialized is True

        asyncio.run(run())

    def test_initialize_allows_startup_without_configured_model_services(self):
        async def run():
            self.service.model_service.services = []
            with (
                patch.object(cache_service, "connect", new_callable=AsyncMock, return_value=True),
                patch.object(
                    self.service.database_service,
                    "connect",
                    new_callable=AsyncMock,
                    return_value=True,
                ),
                patch.object(
                    self.service.model_service,
                    "load_all_models",
                    new_callable=AsyncMock,
                    return_value=False,
                ),
            ):
                initialized = await self.service.initialize()
                assert initialized is True
                assert self.service.is_initialized is True

        asyncio.run(run())

    def test_initialize_fails_when_configured_model_services_fail_to_load(self):
        async def run():
            self.service.model_service.services = [MagicMock()]
            with (
                patch.object(cache_service, "connect", new_callable=AsyncMock, return_value=True),
                patch.object(
                    self.service.database_service,
                    "connect",
                    new_callable=AsyncMock,
                    return_value=True,
                ),
                patch.object(
                    self.service.model_service,
                    "load_all_models",
                    new_callable=AsyncMock,
                    return_value=False,
                ),
            ):
                initialized = await self.service.initialize()
                assert initialized is False
                assert self.service.is_initialized is False

        asyncio.run(run())

    def test_analyze_bias_returns_expected_payload(self):
        async def run():
            self.service.is_initialized = True
            with patch.object(
                self.service,
                "_get_model_predictions",
                new_callable=AsyncMock,
                return_value={
                    "ensemble_results": [
                        {
                            "bias_type": BiasType.GENDER.value,
                            "score": 0.72,
                            "confidence": 0.82,
                            "confidence_level": ConfidenceLevel.HIGH,
                            "evidence": ["he"],
                            "explanation": "mock",
                        }
                    ],
                    "processing_time_ms": 12,
                },
            ):
                response = await self.service.analyze_bias(self.request, "req-001")

            assert isinstance(response, BiasAnalysisResponse)
            assert response.request_id == "req-001"
            assert response.status == AnalysisStatus.COMPLETED
            assert response.overall_bias_score > 0
            assert response.processing_time_ms >= 0

        asyncio.run(run())

    def test_health_status_is_unhealthy_when_not_initialized(self):
        async def run():
            with (
                patch.object(
                    cache_service,
                    "get_health_status",
                    new_callable=AsyncMock,
                    return_value={"status": "healthy"},
                ),
                patch.object(
                    self.service.database_service,
                    "get_health_status",
                    new_callable=AsyncMock,
                    return_value={"status": "healthy"},
                ),
                patch.object(
                    self.service.model_service,
                    "get_ensemble_info",
                    return_value={"models": [{"loaded": True}]},
                ),
            ):
                status = await self.service.get_health_status()
                assert status["status"] == "unhealthy"
                assert status["initialized"] is False
                assert status["model_service"]["status"] in {
                    "healthy",
                    "degraded",
                    "unhealthy",
                }

        asyncio.run(run())


class TestFastAPIEndpoints(unittest.TestCase):
    def setUp(self):
        self.original_service = deps.bias_detection_service
        self.original_orchestrator = deps.analysis_orchestrator

        fake_service = MagicMock()
        fake_service.initialize = AsyncMock(return_value=True)
        fake_service.shutdown = AsyncMock(return_value=None)
        fake_service.get_health_status = AsyncMock(
            return_value={
                "status": "healthy",
                "initialized": True,
                "model_service": {"status": "healthy"},
                "cache_service": {"status": "healthy"},
                "database_service": {"status": "healthy"},
            }
        )
        deps.bias_detection_service = fake_service

        response = BiasAnalysisResponse(
            request_id="req-1",
            status=AnalysisStatus.COMPLETED,
            content_hash="abc",
            overall_bias_score=0.42,
            bias_scores=[],
            dominant_bias_types=[],
            sentiment_analysis={},
            keyword_analysis={},
            contextual_analysis={},
            recommendations=[],
            counterfactual_scenarios=[],
            processing_time_ms=4,
            model_version="1.0.0-ensemble",
            language_detected="en",
            word_count=4,
            id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
        )
        fake_orchestrator = MagicMock()
        fake_orchestrator.run_analysis = AsyncMock(return_value=response)
        fake_orchestrator.record_analysis_error = AsyncMock(return_value=None)

        deps.analysis_orchestrator = fake_orchestrator
        self.client = TestClient(app)

    def tearDown(self):
        deps.bias_detection_service = self.original_service
        deps.analysis_orchestrator = self.original_orchestrator
        self.client.close()

    def test_health_check(self):
        response = self.client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data

    def test_ready_check(self):
        response = self.client.get("/ready")
        assert response.status_code == 200
        assert response.json() == {"status": "ready"}

    def test_analyze_endpoint_valid_data(self):
        payload = {"content": "This is a balanced sample for testing."}

        response = self.client.post("/api/bias-analysis/analyze", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert data["request_id"] == "req-1"
        assert data["overall_bias_score"] == pytest.approx(0.42, rel=1e-6)
        assert data["status"] == "completed"

    def test_analyze_endpoint_missing_required_fields(self):
        response = self.client.post("/api/bias-analysis/analyze", json={})
        assert response.status_code == 422
        assert "detail" in response.json()

    def test_404_endpoint(self):
        response = self.client.get("/does-not-exist")
        assert response.status_code == 404


if __name__ == "__main__":
    unittest.main()

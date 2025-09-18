import json
import os

import pytest

# Ensure non-prod defaults
os.environ.setdefault("ENV", "test")
os.environ.setdefault("PYTEST", "1")

# Import after env setup
from src.lib.ai.bias_detection.python_service.bias_detection_service import (
    BiasDetectionConfig,
    BiasDetectionService,
)


@pytest.mark.asyncio
async def test_import_without_env_and_basic_init():
    svc = BiasDetectionService(BiasDetectionConfig())
    # Service should initialize even if optional deps are missing
    assert svc is not None


@pytest.mark.asyncio
async def test_audit_logger_safe_without_request(tmp_path):
    cfg = BiasDetectionConfig()
    svc = BiasDetectionService(cfg)

    # Redirect audit log to temp file
    audit_log = tmp_path / "audit.log"
    svc.audit_logger.audit_file = str(audit_log)

    session_id = "test-session"
    user_id = "user-1"
    await svc.audit_logger.log_event("unit_test", session_id, user_id, {"ok": True})

    # Ensure a line was written and contains minimal fields
    data = audit_log.read_text().strip().splitlines()
    assert len(data) == 1
    entry = json.loads(data[0])
    assert entry.get("event_type") == "unit_test"
    assert entry.get("session_id_hash") is not None
    assert entry.get("ip_address") in ("system", "127.0.0.1", "::1")


@pytest.mark.asyncio
async def test_fairlearn_analysis_noop_drop_fix():
    cfg = BiasDetectionConfig()
    svc = BiasDetectionService(cfg)

    # Minimal session data with ai_responses to trigger synthetic dataset creation
    class Session:
        def __init__(self):
            self.ai_responses = [{"content": "hi"} for _ in range(5)]
            self.participant_demographics = {}
            self.training_scenario = {}
            self.content = {}
            self.expected_outcomes = []
            self.transcripts = []
            self.metadata = {}
            self.session_id = "s1"

    session = Session()

    res = await svc._run_fairlearn_analysis(session)
    assert isinstance(res, dict)
    # Either error due to missing fairlearn, or contains bias_score
    assert "bias_score" in res


@pytest.mark.asyncio
async def test_sentiment_fallback_schema():
    cfg = BiasDetectionConfig()
    svc = BiasDetectionService(cfg)
    svc.sentiment_analyzer = None  # Force fallback
    out = svc._analyze_sentiment("This is fine")
    assert {"compound", "positive", "negative", "neutral"}.issubset(out.keys())
    assert out.get("source") in ("textblob", "vader")


@pytest.mark.asyncio
async def test_spacy_missing_model_handling():
    cfg = BiasDetectionConfig()
    svc = BiasDetectionService(cfg)
    # If spacy model is missing, _detect_linguistic_bias should not raise
    res = await svc._detect_linguistic_bias("hello world")
    assert isinstance(res, dict)
    assert "overall_bias_score" in res or "error" in res

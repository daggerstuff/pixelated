"""Tests for the multimodal ensemble service and its rate-limit cache."""

import asyncio

import pytest
from multimodal_bias_detection.models import MultimodalAnalysisRequest
from multimodal_bias_detection.services.multimodal_service import (
    InMemoryRateLimitCache,
    MultimodalBiasDetector,
)


@pytest.fixture
def detector() -> MultimodalBiasDetector:
    return MultimodalBiasDetector()


class TestInMemoryRateLimitCache:
    def test_unknown_key_counts_zero(self) -> None:
        cache = InMemoryRateLimitCache()
        assert asyncio.run(cache.get_rate_limit_counter("user:nobody")) == 0

    def test_increment_then_read(self) -> None:
        cache = InMemoryRateLimitCache()
        asyncio.run(cache.increment_rate_limit_counter("user:a"))
        asyncio.run(cache.increment_rate_limit_counter("user:a"))
        assert asyncio.run(cache.get_rate_limit_counter("user:a")) == 2

    def test_keys_are_isolated(self) -> None:
        cache = InMemoryRateLimitCache()
        asyncio.run(cache.increment_rate_limit_counter("user:a"))
        assert asyncio.run(cache.get_rate_limit_counter("user:b")) == 0


class TestMultimodalBiasDetector:
    def test_health_before_initialize_is_degraded(self, detector: MultimodalBiasDetector) -> None:
        status = asyncio.run(detector.get_health_status())
        assert status["status"] in {"degraded", "unhealthy"}
        assert status["multimodal_service"]["status"] == "degraded"

    def test_ensemble_info_shape(self, detector: MultimodalBiasDetector) -> None:
        info = detector.get_ensemble_info()
        assert set(info) >= {"vision", "audio", "text", "fusion"}
        assert info["text"]["framework"] == "lexical-heuristic"

    def test_text_only_analysis(self, detector: MultimodalBiasDetector) -> None:
        request = MultimodalAnalysisRequest(text_content="She was wheelchair-bound and too old for the job.")
        result = asyncio.run(detector.analyze_multimodal(request, "req-1"))
        assert result.status == "completed"
        assert result.modalities_analyzed == ["text"]
        assert result.request_id == "req-1"
        assert len(result.bias_scores) >= 2
        assert result.overall_bias_score > 0.0
        assert result.bias_scores == sorted(result.bias_scores, key=lambda s: -s.overall_score)

    def test_bias_types_fused_across_passes(self, detector: MultimodalBiasDetector) -> None:
        request = MultimodalAnalysisRequest(text_content="a bossy woman and a bossy woman")
        result = asyncio.run(detector.analyze_multimodal(request, "req-2"))
        types = [s.bias_type for s in result.bias_scores]
        # Same bias type across repeated markers fuses into one entry
        assert types.count(types[0]) == len(types)
        assert len(types) == 1

    def test_empty_request_completes_with_no_scores(self, detector: MultimodalBiasDetector) -> None:
        request = MultimodalAnalysisRequest()
        result = asyncio.run(detector.analyze_multimodal(request, "req-3"))
        assert result.status == "completed"
        assert result.bias_scores == []
        assert result.overall_bias_score == 0.0
        assert result.modalities_analyzed == ["none"]

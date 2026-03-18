"""
Tests for Nemotron Model Benchmark.

These tests validate the benchmark components:
- Configuration validation
- Benchmark dataset integrity
- Request handling
- Result aggregation
"""

import asyncio
import os
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

import pytest

from ai.rag.nemotron_benchmark import (
    BenchmarkConfig,
    NemotronBenchmark,
    TaskType,
    THERAPEUTIC_BENCHMARK_DATASET,
)


@asynccontextmanager
async def mock_async_context_manager(return_value=None, side_effect=None):
    """Helper to create proper async context manager mock."""
    if side_effect:
        raise side_effect
    yield return_value


class TestBenchmarkConfig:
    """Tests for benchmark configuration."""

    def test_default_config(self):
        """Test default configuration values."""
        config = BenchmarkConfig(api_key="test-key")

        assert config.api_key == "test-key"
        assert config.base_url == "https://integrate.api.nvidia.com/v1"
        assert config.timeout == 30.0
        assert config.max_retries == 3
        assert config.concurrency == 5

    def test_custom_config(self):
        """Test custom configuration values."""
        config = BenchmarkConfig(
            api_key="test-key",
            base_url="http://localhost:8000/v1",
            timeout=60.0,
            max_retries=5,
            concurrency=10,
        )

        assert config.base_url == "http://localhost:8000/v1"
        assert config.timeout == 60.0
        assert config.max_retries == 5
        assert config.concurrency == 10


class TestTaskType:
    """Tests for task type enum."""

    def test_task_type_values(self):
        """Test task type enum values."""
        assert TaskType.EMPATHY.value == "empathy"
        assert TaskType.SAFETY.value == "safety"
        assert TaskType.PSYCHOEDUCATION.value == "psychoeducation"
        assert TaskType.CRISIS_INTERVENTION.value == "crisis_intervention"
        assert TaskType.CBT_TECHNIQUES.value == "cbt_techniques"


class TestBenchmarkDataset:
    """Tests for benchmark dataset integrity."""

    def test_dataset_has_all_task_types(self):
        """Test that dataset covers all task types."""
        for task_type in TaskType:
            assert task_type.value in THERAPEUTIC_BENCHMARK_DATASET

    def test_dataset_has_multiple_prompts_per_task(self):
        """Test that each task type has multiple prompts."""
        for task_type, prompts in THERAPEUTIC_BENCHMARK_DATASET.items():
            assert len(prompts) >= 2, f"{task_type} should have at least 2 prompts"

    def test_dataset_prompt_schema(self):
        """Test that prompts have required fields."""
        for task_type, prompts in THERAPEUTIC_BENCHMARK_DATASET.items():
            for prompt_data in prompts:
                assert "prompt" in prompt_data
                assert "complexity" in prompt_data
                assert prompt_data["complexity"] in ["simple", "moderate", "complex"]
                assert "safety_critical" in prompt_data

    def test_crisis_intervention_has_safety_critical(self):
        """Test that crisis intervention prompts are safety critical."""
        for prompt_data in THERAPEUTIC_BENCHMARK_DATASET[TaskType.CRISIS_INTERVENTION]:
            assert prompt_data["safety_critical"] is True


class TestNemotronBenchmark:
    """Tests for benchmark execution."""

    @pytest.fixture
    def config(self):
        """Create benchmark configuration."""
        return BenchmarkConfig(
            api_key="test-key",
            base_url="http://localhost:8000/v1",
            timeout=10.0,
            max_retries=2,
            concurrency=3,
        )

    @pytest.fixture
    def benchmark(self, config):
        """Create benchmark instance."""
        return NemotronBenchmark(config)

    @pytest.mark.asyncio
    async def test_make_request_success(self, benchmark):
        """Test successful request handling."""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(
            return_value={
                "choices": [{"message": {"content": "Test response"}}]
            }
        )

        # Create proper async context manager
        mock_cm = AsyncMock()
        mock_cm.__aenter__.return_value = mock_response
        mock_cm.__aexit__.return_value = None

        mock_session = MagicMock()
        mock_session.post = MagicMock(return_value=mock_cm)

        result = await benchmark.make_request(
            mock_session,
            "test-model",
            "Test prompt",
        )

        assert result["success"] is True
        assert result["response"] == "Test response"
        assert result["error"] is None
        assert "latency_ms" in result

    @pytest.mark.asyncio
    async def test_make_request_timeout(self, benchmark):
        """Test timeout handling."""
        mock_cm = AsyncMock()
        mock_cm.__aenter__.side_effect = asyncio.TimeoutError()
        mock_cm.__aexit__.return_value = None

        mock_session = MagicMock()
        mock_session.post = MagicMock(return_value=mock_cm)

        result = await benchmark.make_request(
            mock_session,
            "test-model",
            "Test prompt",
        )

        assert result["success"] is False
        assert result["error"] == "Timeout"

    @pytest.mark.asyncio
    async def test_make_request_http_error(self, benchmark):
        """Test HTTP error handling."""
        mock_response = MagicMock()
        mock_response.status = 500
        mock_response.text = AsyncMock(return_value="Internal Server Error")

        mock_cm = AsyncMock()
        mock_cm.__aenter__.return_value = mock_response
        mock_cm.__aexit__.return_value = None

        mock_session = MagicMock()
        mock_session.post = MagicMock(return_value=mock_cm)

        result = await benchmark.make_request(
            mock_session,
            "test-model",
            "Test prompt",
        )

        assert result["success"] is False
        assert "HTTP 500" in result["error"]

    def test_print_results(self, benchmark, capsys):
        """Test result printing."""
        all_results = {
            "test-model": {
                "empathy": MagicMock(
                    task_type=TaskType.EMPATHY,
                    avg_latency_ms=150.5,
                    p50_latency_ms=140.0,
                    p95_latency_ms=180.0,
                    p99_latency_ms=200.0,
                    success_rate=100.0,
                    total_requests=3,
                    successful_requests=3,
                    error_count=0,
                    errors={},
                )
            }
        }

        benchmark.print_results(all_results)

        captured = capsys.readouterr()
        assert "NEMOTRON MODEL BENCHMARK RESULTS" in captured.out
        assert "test-model" in captured.out
        assert "EMPATHY" in captured.out

    def test_save_results(self, benchmark, tmp_path):
        """Test result saving."""
        output_file = tmp_path / "test_results.json"

        all_results = {
            "test-model": {
                "empathy": MagicMock(
                    model_name="test-model",
                    task_type=TaskType.EMPATHY,
                    avg_latency_ms=150.5,
                    p50_latency_ms=140.0,
                    p95_latency_ms=180.0,
                    p99_latency_ms=200.0,
                    success_rate=100.0,
                    total_requests=3,
                    successful_requests=3,
                    error_count=0,
                    errors={},
                )
            }
        }

        benchmark.save_results(all_results, str(output_file))

        assert output_file.exists()
        import json

        with open(output_file) as f:
            data = json.load(f)

        assert "timestamp" in data
        assert "config" in data
        assert "models" in data
        assert "test-model" in data["models"]


class TestBenchmarkIntegration:
    """Integration tests for benchmark (requires API key)."""

    @pytest.mark.skipif(
        not os.environ.get("NVIDIA_API_KEY"),
        reason="NVIDIA_API_KEY not found in environment",
    )
    @pytest.mark.asyncio
    async def test_benchmark_single_model_live(self):
        """Test benchmarking a single model with live API."""
        import aiohttp

        from ai.rag.nemotron_benchmark import BenchmarkConfig, NemotronBenchmark

        config = BenchmarkConfig(
            api_key=os.environ["NVIDIA_API_KEY"],
            timeout=30.0,
            concurrency=2,
        )

        benchmark = NemotronBenchmark(config)

        async with aiohttp.ClientSession() as session:
            results = await benchmark.benchmark_model(
                "nvidia/llama-3.3-nemotron-super-49b-v1.5",
                session,
            )

            assert len(results) > 0
            for task_type, result in results.items():
                assert result.total_requests > 0
                assert result.success_rate >= 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])

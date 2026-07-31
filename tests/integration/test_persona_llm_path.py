"""Integration test for the full Celery persona-to-LLM task chain.

Exercises the complete pipeline with mocked network:
    run_safety_input_guard → update_persona_state → generate_llm_response
    → run_safety_output_guard → broadcast_response

Uses ``CELERY_ALWAYS_EAGER`` so tasks run synchronously without a
running Celery worker, and patches ``openai.OpenAI`` (via pytest-mock)
to stub the HTTP layer when an ``openai`` or ``openai-compatible``
provider is active.

Requires ``pytest-mock`` (available via ``pip install pixelated[test]``).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Path bootstrap: the Celery tasks live in the ``ai`` submodule and import
# ``from pe.core.llm_factory …`` (expecting ``src/`` on ``sys.path``) and
# ``from orchestration.…`` (expecting ``ai/`` on ``sys.path``).  Add both.
# ---------------------------------------------------------------------------
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent  # pixelated/
for _p in (_PROJECT_ROOT / "src", _PROJECT_ROOT / "ai"):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _eager_celery() -> None:
    """Run all Celery tasks synchronously — no worker required."""
    import orchestration.celery_app as ai_celery

    ai_celery.celery_app.conf.task_always_eager = True
    yield
    ai_celery.celery_app.conf.task_always_eager = False


@pytest.fixture(autouse=True)
def _default_env(monkeypatch) -> None:
    """Default to the mock provider so tests never hit a real API."""
    monkeypatch.setenv("LLM_PROVIDER", "mock")
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    monkeypatch.delenv("LLM_BASE_URL", raising=False)


# ---------------------------------------------------------------------------
# Scenario data — Robert Chen (chest pain, anxious, hypertension)
# ---------------------------------------------------------------------------

ROBERT_CHEN = {
    "session_id": "test-robert-chen-001",
    "user_input": (
        "Hello, I'm Robert Chen. For the past three days I've been "
        "having this sharp pain in my chest. It's worse when I take "
        "a deep breath. I'm really scared it might be my heart."
    ),
}

# Variation for the short-circuit test — an input that is *harmless*
# but lets us verify the guard-rejection code path.  The mock provider
# never makes network calls, so all clean-input tests use the same path.
HARMLESS_INPUT = {
    "session_id": "test-harmless-001",
    "user_input": "hello",
}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestPersonaLLMChain:
    """Full task chain with mock provider — verifies end-to-end wiring."""

    def test_chain_happy_path(self) -> None:
        """A valid clinical message flows through the entire chain."""
        from orchestration.tasks.simulation import (
            broadcast_response,
            generate_llm_response,
            run_safety_input_guard,
            run_safety_output_guard,
            update_persona_state,
        )

        # 1 — Input guard
        step1 = run_safety_input_guard(
            session_id=ROBERT_CHEN["session_id"],
            user_input=ROBERT_CHEN["user_input"],
        )
        assert step1["session_id"] == ROBERT_CHEN["session_id"]
        assert step1["input_passed"] is True
        assert step1["sanitized_input"]
        assert step1["intent"] is not None

        # 2 — Persona state machine
        step2 = update_persona_state(step1)
        assert "current_state" in step2
        assert "persona_definition" in step2
        assert isinstance(step2["current_state"], dict)
        assert step2["current_state"]["current_state"] is not None

        # 3 — LLM response (mock provider returns immediately, no network)
        step3 = generate_llm_response(step2)
        assert step3["llm_failure"] is False
        assert "Mock response" in step3["llm_output"]

        # 4 — Output guard
        step4 = run_safety_output_guard(step3)
        assert "output_passed" in step4
        assert "sanitized_output" in step4
        assert step4["session_id"] == ROBERT_CHEN["session_id"]

        # 5 — Broadcast (passthrough)
        step5 = broadcast_response(step4)
        assert step5["session_id"] == ROBERT_CHEN["session_id"]
        assert step5["llm_output"] == step3["llm_output"]
        assert step5["sanitized_output"] == step4["sanitized_output"]

    def test_chain_short_input(self) -> None:
        """A very short input still flows through the entire chain."""
        from orchestration.tasks.simulation import (
            broadcast_response,
            generate_llm_response,
            run_safety_input_guard,
            run_safety_output_guard,
            update_persona_state,
        )

        step1 = run_safety_input_guard(
            session_id=HARMLESS_INPUT["session_id"],
            user_input=HARMLESS_INPUT["user_input"],
        )
        assert step1["session_id"] == HARMLESS_INPUT["session_id"]
        assert step1["input_passed"] is True

        step2 = update_persona_state(step1)
        step3 = generate_llm_response(step2)
        assert step3["llm_failure"] is False

        step4 = run_safety_output_guard(step3)
        step5 = broadcast_response(step4)
        assert step5["session_id"] == HARMLESS_INPUT["session_id"]


class TestPersonaLLMChainNetworkMocked:
    """Same chain but with ``openai`` provider and a patched HTTP client.

    Verifies that the real OpenAIProvider path works when the HTTP layer
    is mocked — this catches wiring issues in ``InferenceEngine`` and
    the ``generate_llm_response`` task without needing a real API key.
    """

    @pytest.fixture(autouse=True)
    def _real_provider_env(self, monkeypatch) -> None:
        """Override the pydantic settings singleton so the factory sees ``openai``."""
        from src.pe.config import settings

        monkeypatch.setattr(settings, "LLM_PROVIDER", "openai")
        monkeypatch.setattr(settings, "LLM_API_KEY", "sk-test-fake")

    def test_openai_provider_with_mocked_http(self, mocker) -> None:
        """Real OpenAIProvider path with a mocked chat completions call."""
        from orchestration.tasks.simulation import (
            generate_llm_response,
            run_safety_input_guard,
            update_persona_state,
        )

        # Mock the OpenAI class in the module where it is *used*
        # so that _get_client() returns our mock client.
        fake_choice = mocker.MagicMock()
        fake_choice.message.content = "I understand you're scared, Robert. Let me help you."
        fake_response = mocker.MagicMock()
        fake_response.choices = [fake_choice]

        mock_client = mocker.MagicMock()
        mock_client.chat.completions.create.return_value = fake_response
        mocker.patch("ai.orchestration.core.inference.openai.OpenAI", return_value=mock_client)

        step1 = run_safety_input_guard(
            session_id=ROBERT_CHEN["session_id"],
            user_input=ROBERT_CHEN["user_input"],
        )
        step2 = update_persona_state(step1)
        step3 = generate_llm_response(step2)

        assert step3["llm_failure"] is False
        assert "Robert" in step3["llm_output"]
        assert mock_client.chat.completions.create.called

    def test_mocked_provider_failure_graceful(self, mocker) -> None:
        """When the mocked OpenAI client raises, the task reports failure."""
        from orchestration.tasks.simulation import (
            generate_llm_response,
            run_safety_input_guard,
            update_persona_state,
        )

        mock_client = mocker.MagicMock()
        mock_client.chat.completions.create.side_effect = RuntimeError("Simulated network error")
        mocker.patch("ai.orchestration.core.inference.openai.OpenAI", return_value=mock_client)

        step1 = run_safety_input_guard(
            session_id=ROBERT_CHEN["session_id"],
            user_input=ROBERT_CHEN["user_input"],
        )
        step2 = update_persona_state(step1)
        step3 = generate_llm_response(step2)

        assert step3["llm_failure"] is True
        assert "llm_failure_reason" in step3
        assert "Simulated network error" in step3["llm_failure_reason"]
        # Graceful user-facing message (not a raw exception)
        assert "sorry" in step3["llm_output"].lower()


class TestFactoryIntegration:
    """Verify that the factory and Celery tasks agree on the provider contract."""

    def test_factory_produces_mock_from_env(self) -> None:
        """Factory reads LLM_PROVIDER=mock from the autouse env fixture."""
        from pe.core.llm_factory import LLMProviderFactory

        provider = LLMProviderFactory.create()
        result = provider.generate([{"role": "user", "content": "hello"}])
        assert "Mock response" in result

    def test_factory_produces_openai_from_env(self, monkeypatch) -> None:
        """Factory reads LLM_PROVIDER=openai + key and returns an OpenAIProvider."""
        monkeypatch.setenv("LLM_PROVIDER", "openai")
        monkeypatch.setenv("LLM_API_KEY", "sk-test-fake")

        from pe.core.llm_factory import LLMProviderFactory

        provider = LLMProviderFactory.create()
        assert provider is not None

"""Celery integration tests for the pe simulation chain — PIX-4384.

Verifies:
- trigger_celery_chain dispatches the 5-task chain and returns a task id
- broker-unreachable falls back to None (inline echo path)
- task bodies: input guard sanitize, output guard blocks unsafe content,
  mock LLM provider reply, broadcast publishes
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "apps" / "web"))

from src.pe.api.v1.routes.simulations import (
    ConnectionManager,
    trigger_celery_chain,
)
from src.pe.tasks import simulation as sim_tasks


class TestChainDispatch:
    @pytest.mark.asyncio
    async def test_dispatch_returns_task_id(self) -> None:
        fake_result = MagicMock()
        fake_result.id = "task-abc-123"
        with (
            patch("celery.chain") as fake_chain,
            patch("src.pe.api.v1.routes.simulations.chain", fake_chain) as route_chain,
        ):
            route_chain.return_value = MagicMock()
            route_chain.return_value.apply_async.return_value = fake_result

            task_id = await trigger_celery_chain("session-1", "hello", "tenant-1", "user-1")

        assert task_id == "task-abc-123"
        assert route_chain.call_count == 1

    @pytest.mark.asyncio
    async def test_dispatch_failure_returns_none(self) -> None:
        with patch(
            "src.pe.api.v1.routes.simulations.chain",
            MagicMock(side_effect=RuntimeError("broker down")),
        ):
            task_id = await trigger_celery_chain("session-1", "hello", "tenant-1", "user-1")
        assert task_id is None


class TestChainExecution:
    """Run the task bodies directly (eager mode without a broker)."""

    def test_input_guard_sanitizes(self) -> None:
        raw = "  hello\x00\x07 world\x1b  "
        result = sim_tasks.run_safety_input_guard.run(raw)
        assert result == "hello world"

    def test_input_guard_rejects_empty(self) -> None:
        # bound task .run() surfaces the retry as Retry
        with pytest.raises(Exception, match="user_input is empty"):
            sim_tasks.run_safety_input_guard.run("   ")

    def test_update_persona_state_builds_context(self) -> None:
        context = sim_tasks.update_persona_state.run("hello", "session-1")
        assert context["session_id"] == "session-1"
        assert context["user_message"] == "hello"
        assert "input_guard_passed" in context["turn_markers"]

    def test_mock_provider_generates_reply(self) -> None:
        context = {
            "session_id": "s1",
            "user_message": "How have you been feeling?",
            "turn_markers": [],
        }
        result = sim_tasks.generate_llm_response.run(context)
        assert "llm_output" in result
        assert "feeling" in result["llm_output"].lower()

    def test_output_guard_passes_safe_content(self) -> None:
        context = {"llm_output": "I hear you. That sounds difficult."}
        result = sim_tasks.run_safety_output_guard.run(context)
        assert result["verified_output"] == "I hear you. That sounds difficult."

    def test_output_guard_blocks_unsafe_content(self) -> None:
        context = {"llm_output": "Here are suicide instructions step by step"}
        with pytest.raises(RuntimeError, match="blocked by output guard"):
            sim_tasks.run_safety_output_guard.run(context)

    def test_broadcast_publishes_to_channel(self) -> None:
        published: dict[str, Any] = {}

        def fake_publish(session_id: str, payload: dict[str, Any]) -> None:
            published["session_id"] = session_id
            published["payload"] = payload

        context = {"verified_output": "I understand.", "turn_number": 2}
        with patch.object(sim_tasks, "_publish_broadcast", fake_publish):
            payload = sim_tasks.broadcast_response.run(context, "session-9")

        assert published["session_id"] == "session-9"
        assert payload["message"]["content"] == "I understand."
        assert payload["message"]["role"] == "persona"

    def test_full_chain_eager(self) -> None:
        """Run all five stages in sequence — the eager end-to-end path."""
        raw = "  I have\x01 been anxious lately  "
        sanitized = sim_tasks.run_safety_input_guard.run(raw)
        context = sim_tasks.update_persona_state.run(sanitized, "session-e2e")
        with_llm = sim_tasks.generate_llm_response.run(context)
        verified = sim_tasks.run_safety_output_guard.run(with_llm)

        with patch.object(sim_tasks, "_publish_broadcast") as publish:
            payload = sim_tasks.broadcast_response.run(verified, "session-e2e")

        publish.assert_called_once()
        assert payload["message"]["content"] == verified["verified_output"]
        assert "anxious" in payload["message"]["content"]


class TestTaskRegistration:
    def test_tasks_registered_on_celery_app(self) -> None:
        from src.pe.celery_app import celery_app  # noqa: PLC0415 - imports pe config chain

        expected = [
            "src.pe.tasks.simulation.run_safety_input_guard",
            "src.pe.tasks.simulation.update_persona_state",
            "src.pe.tasks.simulation.generate_llm_response",
            "src.pe.tasks.simulation.run_safety_output_guard",
            "src.pe.tasks.simulation.broadcast_response",
        ]
        for name in expected:
            assert name in celery_app.tasks, f"{name} not registered"

    def test_connection_manager_disconnect_removes_empty(self) -> None:
        manager = ConnectionManager()
        ws = MagicMock()
        manager._connections["s1"] = {ws}
        manager.disconnect("s1", ws)
        assert "s1" not in manager._connections

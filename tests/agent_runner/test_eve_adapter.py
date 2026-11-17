"""Unit tests for EveAgentAdapter and Foresight grounding integration."""

from __future__ import annotations

import json
import tempfile
from unittest.mock import MagicMock, patch

import requests

from tools.agent_runner.eve_adapter import EveAgentAdapter
from tools.agent_runner.models import AgentConfig


def _ndjson(*events: dict) -> list[str]:
    return [json.dumps(e) for e in events]


def _completed_stream_lines() -> list[str]:
    return _ndjson(
        {
            "facts": [
                {"type": "content.completed", "data": {"kind": "text", "phase": "reply", "value": "RESULT: ok"}},
                {"type": "usage.recorded", "data": {"usage": {"inputTokens": 10, "outputTokens": 2}}},
                {"type": "turn.settled", "data": {"outcome": "completed"}},
            ]
        },
        {"$eve": "heartbeat"},
    )


class _FakeStreamResponse:
    def __init__(self, lines: list[str]):
        self._lines = lines

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def raise_for_status(self):
        return None

    def iter_lines(self, **_kwargs):
        return iter(self._lines)


class _FakeSessionResponse:
    def raise_for_status(self):
        return None

    def json(self):
        return {"ok": True, "sessionId": "wrun_test", "status": "accepted"}


def test_eve_agent_adapter_execution():
    with tempfile.TemporaryDirectory() as tmpdir:
        mock_foresight = MagicMock()
        mock_foresight.get_relevant_context.return_value = "- User preference: prefer pnpm and PostgreSQL"

        cfg = AgentConfig(name="eve_agent", label="agent:eve", cmd=["eve"])
        adapter = EveAgentAdapter(cfg, foresight=mock_foresight)

        diff_result = MagicMock()
        diff_result.returncode = 0
        diff_result.stdout = ""

        def fake_post(url, **kwargs):
            assert url.endswith("/eve/v1/session")
            assert "PERSISTENT FORESIGHT CONTEXT" in kwargs["json"]["message"]
            return _FakeSessionResponse()

        def fake_get(url, **_kwargs):
            assert "/eve/v1/session/wrun_test/stream" in url
            return _FakeStreamResponse(_completed_stream_lines())

        with (
            patch("tools.agent_runner.eve_adapter.requests.post", side_effect=fake_post),
            patch("tools.agent_runner.eve_adapter.requests.get", side_effect=fake_get),
            patch("tools.agent_runner.eve_adapter.subprocess.run", return_value=diff_result),
        ):
            res = adapter.run(
                prompt="Implement FHIR R4 encounter router",
                workdir=tmpdir,
                ticket_identifier="PIX-777",
            )

        assert res.agent_name == "eve_agent"
        assert res.ticket_identifier == "PIX-777"
        assert res.success is True
        assert res.output == "RESULT: ok"
        mock_foresight.get_relevant_context.assert_called_once()


def test_eve_agent_adapter_unreachable():
    with tempfile.TemporaryDirectory() as tmpdir:
        mock_foresight = MagicMock()
        mock_foresight.get_relevant_context.return_value = ""

        cfg = AgentConfig(name="eve_agent", label="agent:eve", cmd=["eve"])
        adapter = EveAgentAdapter(cfg, foresight=mock_foresight)

        diff_result = MagicMock()
        diff_result.returncode = 0
        diff_result.stdout = ""

        with (
            patch(
                "tools.agent_runner.eve_adapter.requests.post",
                side_effect=requests.ConnectionError("refused"),
            ),
            patch("tools.agent_runner.eve_adapter.subprocess.run", return_value=diff_result),
        ):
            res = adapter.run(
                prompt="ping",
                workdir=tmpdir,
                ticket_identifier="PIX-778",
            )

        assert res.success is False
        assert "unreachable" in res.stderr
        assert "start-local.sh" in res.stderr

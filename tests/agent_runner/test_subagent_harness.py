"""Unit tests for SubAgentHarness."""

from unittest.mock import MagicMock

from tools.agent_runner.models import AgentConfig, ExecutionResult
from tools.agent_runner.subagent_harness import SubAgentHarness


def test_subagent_delegation(monkeypatch):
    agents = [
        AgentConfig(name="opencode", label="agent:opencode", cmd=["opencode"]),
        AgentConfig(name="agy", label="agent:agy", cmd=["agy"]),
    ]
    harness = SubAgentHarness(agents)

    mock_adapter = MagicMock()
    mock_adapter.run.return_value = ExecutionResult(
        success=True, agent_name="agy", ticket_identifier="PIX-1-sub", output="Subtask complete."
    )

    monkeypatch.setattr("tools.agent_runner.subagent_harness.get_agent_adapter", lambda _agent: mock_adapter)

    res = harness.delegate_subtask("agy", "Run targeted security audit", ".", "PIX-1")
    assert res is not None
    assert res.target_agent == "agy"
    assert res.execution_result.success is True

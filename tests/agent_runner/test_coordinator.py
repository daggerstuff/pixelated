import os
import tempfile
from unittest.mock import MagicMock

from tools.agent_runner.coordinator import CoordinatorComponents, MultiAgentCoordinator
from tools.agent_runner.event_bus import EventBus
from tools.agent_runner.lineage import LineageTracker
from tools.agent_runner.models import (
    AgentConfig,
    ExecutionResult,
    LinearIssue,
    LinearTeam,
    ProjectConfig,
    RunnerConfig,
    VerificationConfig,
)
from tools.agent_runner.state_manager import StateManager


def test_coordinator_tick_workflow(monkeypatch):
    mock_client = MagicMock()
    mock_client.resolve_team.return_value = LinearTeam(
        id="team-1", key="PIX", name="Pixelated", states={"Todo": "state-todo", "In Review": "state-done"}
    )
    mock_client.get_issues_by_state_and_label.return_value = [
        LinearIssue(
            id="1",
            identifier="PIX-10",
            title="Test Ticket",
            description="Do work",
            labels=["agent:opencode", "srv:test"],
        )
    ]
    mock_client.get_issue_comments.return_value = ("1", [])

    mock_adapter = MagicMock()
    mock_adapter.run.return_value = ExecutionResult(
        success=True,
        agent_name="opencode",
        ticket_identifier="PIX-10",
        output="RESULT: Work done.",
        git_diff_summary="M file.py",
    )

    monkeypatch.setattr("tools.agent_runner.execution_harness.get_agent_adapter", lambda _agent: mock_adapter)

    with tempfile.TemporaryDirectory() as tmp_dir:
        state_mgr = StateManager(os.path.join(tmp_dir, "state.json"))
        event_bus = EventBus(os.path.join(tmp_dir, "events.jsonl"))
        lineage = LineageTracker(os.path.join(tmp_dir, "lineage.json"))

        cfg = RunnerConfig(
            server_label="srv:test",
            enable_git_branching=False,
            enable_foresight_memory=False,
            enable_langchain_tracing=False,
            enable_git_pr_creation=False,
            verification=VerificationConfig(enabled=False),
            projects=[ProjectConfig(team_key="PIX", default_repo="main", repos={"main": "."})],
            agents=[AgentConfig(name="opencode", label="agent:opencode", cmd=["opencode", "run"])],
        )

        comps = CoordinatorComponents(
            state_mgr=state_mgr,
            event_bus=event_bus,
            lineage_tracker=lineage,
        )
        coordinator = MultiAgentCoordinator(
            config=cfg,
            client=mock_client,
            components=comps,
        )
        stats = coordinator.tick()
        assert stats["tickets_processed"] == 1
        mock_client.set_issue_state.assert_called()

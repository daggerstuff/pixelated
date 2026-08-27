import os
import tempfile
from unittest.mock import MagicMock

from tools.agent_runner.models import (
    AgentConfig,
    AgentRole,
    ExecutionResult,
    LinearComment,
    LinearTeam,
    ProjectConfig,
    RunnerConfig,
)
from tools.agent_runner.skeptic import SkepticReviewer
from tools.agent_runner.state_manager import StateManager


def test_skeptic_creates_actionable_tickets(monkeypatch):
    mock_client = MagicMock()
    mock_client.resolve_team.return_value = LinearTeam(
        id="team-1", key="PIX", name="Pixelated", states={"Triage": "state-triage"}
    )
    mock_client.get_issue_comments.return_value = (
        "PIX-4609",
        [
            LinearComment(
                id="c-1",
                body="We should deploy auth without tests",
                created_at="2026-08-27T10:00:00Z",
                author_name="Dev",
            )
        ],
    )

    mock_adapter = MagicMock()
    mock_adapter.run.return_value = ExecutionResult(
        success=True,
        agent_name="skeptic",
        ticket_identifier="Skeptic-PIX",
        output="CREATE TICKET: Add Required Auth Tests | Missing test coverage | labels: security | priority: 1",
    )

    monkeypatch.setattr("tools.agent_runner.skeptic.get_agent_adapter", lambda _agent: mock_adapter)

    with tempfile.TemporaryDirectory() as tmp_dir:
        state_mgr = StateManager(os.path.join(tmp_dir, "state.json"))
        cfg = RunnerConfig(server_label="srv:test")
        reviewer = SkepticReviewer(mock_client, cfg, state_mgr)

        proj = ProjectConfig(team_key="PIX", default_repo="main", coordination_ticket="PIX-4609")
        skeptic_agent = AgentConfig(
            name="skeptic", label="agent:skeptic", cmd=["skeptic"], role=AgentRole.SKEPTIC, watch="coordination"
        )

        spawned = reviewer.process_skeptic_for_project(proj, skeptic_agent)
        assert spawned == 1
        mock_client.create_issue.assert_called_once()

import os
import tempfile
from unittest.mock import MagicMock

from tools.agent_runner.models import (
    AgentConfig,
    AgentRole,
    LinearIssue,
    LinearTeam,
    ProjectConfig,
    RunnerConfig,
    TriageRule,
)
from tools.agent_runner.state_manager import StateManager
from tools.agent_runner.triage import AutoTriageEngine


def test_triage_rule_matching():
    mock_client = MagicMock()
    mock_client.resolve_team.return_value = LinearTeam(
        id="team-1", key="PIX", name="Pixelated", states={"Triage": "state-triage", "Todo": "state-todo"}
    )
    mock_client.get_issues_by_state_and_label.side_effect = [
        [
            LinearIssue(
                id="1", identifier="PIX-1", title="Audit security endpoints", description="HIPAA audit", labels=[]
            )
        ],
        [],  # todo issues
    ]
    mock_client.get_or_create_label.return_value = "lbl-123"

    with tempfile.TemporaryDirectory() as tmp_dir:
        state_mgr = StateManager(os.path.join(tmp_dir, "state.json"))
        cfg = RunnerConfig(
            server_label="srv:test",
            triage_rules=[
                TriageRule(
                    keywords=["security", "audit"], preferred_agent="agy", required_role=AgentRole.SECURITY_SENTINEL
                )
            ],
            agents=[
                AgentConfig(name="opencode", label="agent:opencode", cmd=["opencode"], role=AgentRole.BACKEND_ENGINEER),
                AgentConfig(name="agy", label="agent:agy", cmd=["agy"], role=AgentRole.SECURITY_SENTINEL),
            ],
        )

        triage_engine = AutoTriageEngine(mock_client, cfg, state_mgr)
        proj = ProjectConfig(team_key="PIX", default_repo="main")
        triaged = triage_engine.process_triage_for_project(proj)
        assert triaged == 1
        mock_client.set_issue_state.assert_called_with("1", "state-todo")

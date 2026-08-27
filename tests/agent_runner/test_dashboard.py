"""Unit tests for ClusterDashboard."""

import os
import tempfile

from tools.agent_runner.dashboard import ClusterDashboard
from tools.agent_runner.models import AgentConfig, ProjectConfig, RunnerConfig
from tools.agent_runner.state_manager import StateManager


def test_dashboard_render():
    with tempfile.TemporaryDirectory() as tmp_dir:
        state_mgr = StateManager(os.path.join(tmp_dir, "state.json"))
        cfg = RunnerConfig(
            server_label="srv:test-box",
            projects=[ProjectConfig(team_key="PIX", default_repo="main")],
            agents=[AgentConfig(name="opencode", label="agent:opencode", cmd=["opencode"])],
        )
        dashboard = ClusterDashboard(cfg, state_mgr)
        text = dashboard.render_text()
        assert "LINEAR MULTI-AGENT CLUSTER OBSERVABILITY DASHBOARD" in text
        assert "srv:test-box" in text
        assert "PIX" in text
        assert "opencode" in text

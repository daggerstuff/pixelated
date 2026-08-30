"""Unit tests for OnboardingWizard and automated agent discovery."""

from __future__ import annotations

import os
import tempfile
from tools.agent_runner.onboarding import OnboardingWizard


def test_onboarding_toolchain_and_agent_discovery():
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create simulated agents/eve-agent package
        eve_dir = os.path.join(tmpdir, "agents", "eve-agent")
        os.makedirs(eve_dir, exist_ok=True)
        with open(os.path.join(eve_dir, "package.json"), "w") as f:
            f.write('{"name": "eve-agent"}')

        wizard = OnboardingWizard(workspace_root=tmpdir)
        tools = wizard.discover_tools()
        assert "git" in tools
        assert "python" in tools

        agents = wizard.discover_installed_agents()
        assert len(agents) > 0
        eve_agent = next((a for a in agents if "eve" in a.name), None)
        assert eve_agent is not None
        assert eve_agent.suggested_role == "lead_architect"

        target_cfg = os.path.join(tmpdir, "config", "agent_runner_config.json")
        written_path = wizard.run_interactive_setup(output_file=target_cfg)
        assert os.path.exists(written_path)

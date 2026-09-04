"""Unit tests for EveAgentAdapter and Foresight grounding integration."""

from __future__ import annotations

import os
import tempfile
from unittest.mock import MagicMock, patch

from tools.agent_runner.eve_adapter import EveAgentAdapter
from tools.agent_runner.models import AgentConfig


def test_eve_agent_adapter_execution():
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create simulated package.json for eve-agent
        eve_dir = os.path.join(tmpdir, "agents", "eve-agent")
        os.makedirs(eve_dir, exist_ok=True)
        os.makedirs(os.path.join(eve_dir, "node_modules"), exist_ok=True)
        with open(os.path.join(eve_dir, "package.json"), "w") as f:
            f.write('{"name": "eve-agent"}')

        mock_foresight = MagicMock()
        mock_foresight.get_relevant_context.return_value = "- User preference: prefer pnpm and PostgreSQL"

        cfg = AgentConfig(name="eve_agent", label="agent:eve", cmd=["echo", "{prompt_file}"])
        adapter = EveAgentAdapter(cfg, foresight=mock_foresight)

        run_result = MagicMock()
        run_result.returncode = 0
        run_result.stdout = "RESULT: ok"
        run_result.stderr = ""

        diff_result = MagicMock()
        diff_result.returncode = 0
        diff_result.stdout = ""

        def fake_run(cmd, **_):
            if cmd and cmd[0] == "git":
                return diff_result
            assert "invoke" in cmd
            assert "start" not in cmd
            return run_result

        with patch("tools.agent_runner.eve_adapter.subprocess.run", side_effect=fake_run):
            res = adapter.run(
                prompt="Implement FHIR R4 encounter router",
                workdir=tmpdir,
                ticket_identifier="PIX-777",
            )

        assert res.agent_name == "eve_agent"
        assert res.ticket_identifier == "PIX-777"
        assert res.success is True
        mock_foresight.get_relevant_context.assert_called_once()

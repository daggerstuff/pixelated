"""Unit tests for EveAgentAdapter and Foresight grounding integration."""

from __future__ import annotations

import os
import tempfile
from unittest.mock import MagicMock
from tools.agent_runner.eve_adapter import EveAgentAdapter
from tools.agent_runner.models import AgentConfig


def test_eve_agent_adapter_execution():
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create simulated package.json for eve-agent
        eve_dir = os.path.join(tmpdir, "agents", "eve-agent")
        os.makedirs(eve_dir, exist_ok=True)
        with open(os.path.join(eve_dir, "package.json"), "w") as f:
            f.write('{"name": "eve-agent"}')

        mock_foresight = MagicMock()
        mock_foresight.format_context_for_ticket.return_value = "- User preference: prefer pnpm and PostgreSQL"

        cfg = AgentConfig(name="eve_agent", label="agent:eve", cmd=["echo", "{prompt_file}"])
        adapter = EveAgentAdapter(cfg, foresight=mock_foresight)

        res = adapter.run(prompt="Implement FHIR R4 encounter router", workdir=tmpdir, ticket_identifier="PIX-777")
        assert res.agent_name == "eve_agent"
        assert res.ticket_identifier == "PIX-777"
        mock_foresight.format_context_for_ticket.assert_called_once()

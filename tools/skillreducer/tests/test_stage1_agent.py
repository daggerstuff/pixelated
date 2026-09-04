from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

from skillreducer.config import Config
from skillreducer.parser import parse_skill_md
from skillreducer.stage1.agent import Stage1RoutingAgent


@patch("skillreducer.stage1.agent.create_stage1_routing_agent")
def test_stage1_routing_agent_run_short_description(
    mock_create_agent: MagicMock,
    tmp_path: Path,
) -> None:
    skill_dir = tmp_path / "my-skill"
    skill_dir.mkdir()
    (skill_dir / "SKILL.md").write_text(
        "---\nname: my-skill\ndescription: short\n---\n# Title\nDo the thing.\n",
        encoding="utf-8",
    )

    mock_agent = MagicMock()
    mock_create_agent.return_value = mock_agent

    routing_agent = Stage1RoutingAgent(Config(api_key="test-key"))
    routing_agent._llm = MagicMock()
    routing_agent._llm.enabled = True
    routing_agent._llm.complete_json.return_value = {
        "description": "Processes things. Use when user mentions things."
    }
    routing_agent.generate = MagicMock(return_value="Processes things. Use when needed.")
    routing_agent.compress = MagicMock(
        return_value=("Processes things. Use when needed.", ["Stage 1: compressed"])
    )

    skill = parse_skill_md(skill_dir)
    result = routing_agent.run(skill)

    assert result.description
    assert result.generated or result.compressed or result.notes

"""Unit tests for agent adapters."""

from tools.agent_runner.adapters import GenericCLIAdapter, get_agent_adapter
from tools.agent_runner.models import AgentConfig


def test_agent_adapter_factory():
    cfg = AgentConfig(name="opencode", label="agent:opencode", cmd=["opencode", "run"])
    adapter = get_agent_adapter(cfg)
    assert isinstance(adapter, GenericCLIAdapter)
    assert adapter.config.name == "opencode"


def test_generic_adapter_execution():
    cfg = AgentConfig(name="echo_agent", label="agent:echo", cmd=["python3", "-c", "import sys; print('RESULT: OK')"])
    adapter = get_agent_adapter(cfg)
    result = adapter.run(prompt="Hello", workdir=".", ticket_identifier="PIX-1")
    assert result.success is True
    assert result.exit_code == 0
    assert "RESULT: OK" in result.output
    assert len(result.actions) == 1

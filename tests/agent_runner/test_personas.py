"""Unit tests for personas."""

from tools.agent_runner.models import AgentRole
from tools.agent_runner.personas import get_role_prompt


def test_role_guidelines_prompts():
    backend_prompt = get_role_prompt(AgentRole.BACKEND_ENGINEER)
    assert "Senior Systems & Backend Engineer" in backend_prompt

    sec_prompt = get_role_prompt(AgentRole.SECURITY_SENTINEL)
    assert "Security Architect & HIPAA Sentinel" in sec_prompt

    skeptic_prompt = get_role_prompt(AgentRole.SKEPTIC)
    assert "Senior Skeptic" in skeptic_prompt

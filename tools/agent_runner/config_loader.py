"""Configuration loader for runner configs with environment variable interpolation."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

from tools.agent_runner.models import (
    AgentConfig,
    AgentRole,
    GuardrailsConfig,
    ProjectConfig,
    RunnerConfig,
    TriageRule,
    VerificationConfig,
)

logger = logging.getLogger("agent_runner.config")


def substitute_env_vars(val: Any) -> Any:
    """Recursively substitute ${VAR} or $VAR in strings."""
    if isinstance(val, str):
        pattern = re.compile(r"\$\{([A-Za-z0-9_]+)(?::-([^}]*))?\}|\$([A-Za-z0-9_]+)")

        def repl(match: re.Match) -> str:
            var_name = match.group(1) or match.group(3)
            default_val = match.group(2) if match.group(1) else ""
            return os.environ.get(var_name, default_val if default_val is not None else "")

        return pattern.sub(repl, val)
    if isinstance(val, dict):
        return {k: substitute_env_vars(v) for k, v in val.items()}
    if isinstance(val, list):
        return [substitute_env_vars(v) for v in val]
    return val


def load_config(config_path: str) -> RunnerConfig:
    """Load, interpolate, and parse JSON configuration file."""
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"Agent Runner config file not found at: {config_path}")

    with open(config_path, encoding="utf-8") as f:
        raw = json.load(f)

    data = substitute_env_vars(raw)

    projects = [
        ProjectConfig(
            team_key=p["team_key"],
            default_repo=p.get("default_repo", "main"),
            coordination_title=p.get("coordination_title", "Multi-Agent Coordination & Architecture Discussion"),
            coordination_ticket=p.get("coordination_ticket"),
            repos=p.get("repos", {}),
            auto_create_coordination_ticket=p.get("auto_create_coordination_ticket", True),
            topic_channels=p.get("topic_channels", {}),
        )
        for p in data.get("projects", [])
    ]

    triage_rules = [
        TriageRule(
            keywords=r.get("keywords", []),
            preferred_agent=r.get("preferred_agent", ""),
            required_role=AgentRole(r["required_role"]) if r.get("required_role") else None,
            additional_labels=r.get("additional_labels", []),
        )
        for r in data.get("triage_rules", [])
    ]

    agents = [
        AgentConfig(
            name=a["name"],
            label=a.get("label", f"agent:{a['name']}"),
            cmd=a.get("cmd", []),
            role=AgentRole(a.get("role", AgentRole.GENERAL_CODER.value)),
            capabilities=a.get("capabilities", []),
            watch=a.get("watch"),
            workdir=a.get("workdir"),
            timeout_seconds=a.get("timeout_seconds", 1800),
            system_prompt_override=a.get("system_prompt_override"),
        )
        for a in data.get("agents", [])
    ]

    v_data = data.get("verification", {})
    verification = VerificationConfig(
        enabled=v_data.get("enabled", True),
        auto_repair=v_data.get("auto_repair", True),
        max_repair_attempts=v_data.get("max_repair_attempts", 2),
        commands=v_data.get("commands", []),
        timeout_seconds=v_data.get("timeout_seconds", 300),
        block_on_suppression=v_data.get("block_on_suppression", True),
    )

    g_data = data.get("guardrails", {})
    guardrails = GuardrailsConfig(
        phi_redaction=g_data.get("phi_redaction", True),
        secret_leak_prevention=g_data.get("secret_leak_prevention", True),
        anti_suppression_enforcement=g_data.get("anti_suppression_enforcement", True),
        allowed_file_patterns=g_data.get("allowed_file_patterns", []),
        blocked_file_patterns=g_data.get("blocked_file_patterns", []),
    )

    return RunnerConfig(
        server_label=data.get("server_label", "srv:default"),
        poll_seconds=data.get("poll_seconds", 60),
        triage_state=data.get("triage_state", "Triage"),
        ready_state=data.get("ready_state", "Todo"),
        active_state=data.get("active_state", "In Progress"),
        done_state=data.get("done_state", "In Review"),
        failed_state=data.get("failed_state"),
        max_concurrent_workers=data.get("max_concurrent_workers", 4),
        enable_git_branching=data.get("enable_git_branching", True),
        enable_git_pr_creation=data.get("enable_git_pr_creation", True),
        enable_foresight_memory=data.get("enable_foresight_memory", True),
        enable_langchain_tracing=data.get("enable_langchain_tracing", True),
        langchain_project=data.get("langchain_project", "linear-agent-runner"),
        verification=verification,
        guardrails=guardrails,
        projects=projects,
        triage_rules=triage_rules,
        agents=agents,
    )

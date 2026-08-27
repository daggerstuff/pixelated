"""Data models and type definitions for the Linear Multi-Agent Coordination Runner."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class ActionType(StrEnum):
    CREATE_TICKET = "CREATE_TICKET"
    SUBTASK = "SUBTASK"
    TASK_GRAPH = "TASK_GRAPH"
    DELEGATE = "DELEGATE"
    STORE_MEMORY = "STORE_MEMORY"
    BROADCAST = "BROADCAST"
    PROPOSE = "PROPOSE"
    VOTE = "VOTE"
    RESULT = "RESULT"


class AgentRole(StrEnum):
    BACKEND_ENGINEER = "backend_engineer"
    FRONTEND_ENGINEER = "frontend_engineer"
    SECURITY_SENTINEL = "security_sentinel"
    SKEPTIC = "skeptic_critic"
    ARCHITECT = "lead_architect"
    QA_AUTOMATOR = "qa_automator"
    REFACTOR_SPECIALIST = "refactor_specialist"
    GENERAL_CODER = "general_coder"


@dataclass
class ParsedAction:
    action_type: ActionType
    title: str
    content: str
    labels: list[str] = field(default_factory=list)
    priority: int | None = None
    target_agent: str | None = None
    dependencies: list[str] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class LinearComment:
    id: str
    body: str
    created_at: str
    author_name: str
    is_bot: bool = False


@dataclass
class LinearIssue:
    id: str
    identifier: str
    title: str
    description: str | None = None
    state_id: str | None = None
    state_name: str | None = None
    labels: list[str] = field(default_factory=list)
    priority: int | None = None
    url: str = ""
    comments: list[LinearComment] = field(default_factory=list)


@dataclass
class LinearState:
    id: str
    name: str
    type: str


@dataclass
class LinearTeam:
    id: str
    key: str
    name: str
    states: dict[str, str] = field(default_factory=dict)  # name -> id


@dataclass
class TriageRule:
    keywords: list[str]
    preferred_agent: str
    required_role: AgentRole | None = None
    additional_labels: list[str] = field(default_factory=list)


@dataclass
class AgentConfig:
    name: str
    label: str  # e.g. "agent:opencode"
    cmd: list[str]
    role: AgentRole = AgentRole.GENERAL_CODER
    capabilities: list[str] = field(default_factory=list)
    watch: str | None = None  # e.g. "coordination"
    workdir: str | None = None
    timeout_seconds: int = 1800
    system_prompt_override: str | None = None


@dataclass
class ProjectConfig:
    team_key: str
    default_repo: str
    coordination_title: str = "Multi-Agent Coordination & Architecture Discussion"
    coordination_ticket: str | None = None
    repos: dict[str, str] = field(default_factory=dict)  # repo_label -> local_path
    auto_create_coordination_ticket: bool = True
    topic_channels: dict[str, str] = field(default_factory=dict)


@dataclass
class VerificationConfig:
    enabled: bool = True
    auto_repair: bool = True
    max_repair_attempts: int = 2
    commands: list[str] = field(default_factory=list)
    timeout_seconds: int = 300
    block_on_suppression: bool = True


@dataclass
class GuardrailsConfig:
    phi_redaction: bool = True
    secret_leak_prevention: bool = True
    anti_suppression_enforcement: bool = True
    allowed_file_patterns: list[str] = field(default_factory=list)
    blocked_file_patterns: list[str] = field(default_factory=list)


@dataclass
class RunnerConfig:
    server_label: str
    poll_seconds: int = 60
    triage_state: str = "Triage"
    backlog_state: str = "Backlog"
    ready_state: str = "Todo"
    active_state: str = "In Progress"
    done_state: str = "In Review"
    failed_state: str | None = None
    max_concurrent_workers: int = 4
    enable_git_branching: bool = True
    enable_git_pr_creation: bool = True
    enable_foresight_memory: bool = True
    enable_langchain_tracing: bool = True
    langchain_project: str = "linear-agent-runner"
    verification: VerificationConfig = field(default_factory=VerificationConfig)
    guardrails: GuardrailsConfig = field(default_factory=GuardrailsConfig)
    projects: list[ProjectConfig] = field(default_factory=list)
    triage_rules: list[TriageRule] = field(default_factory=list)
    agents: list[AgentConfig] = field(default_factory=list)


@dataclass
class ExecutionResult:
    success: bool
    agent_name: str
    ticket_identifier: str
    output: str
    actions: list[ParsedAction] = field(default_factory=list)
    exit_code: int = 0
    duration_seconds: float = 0.0
    stderr: str = ""
    verification_passed: bool = True
    verification_logs: str = ""
    git_diff_summary: str = ""
    guardrail_violations: list[str] = field(default_factory=list)

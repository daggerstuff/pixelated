"""Self-Evolution & Friction Distillation Engine (inspired by Exo & Better Harness)."""

from __future__ import annotations

import json
import logging
import os
import re
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

from tools.agent_runner.event_bus import EventBus, EventType
from tools.agent_runner.foresight_bridge import ForesightBridge
from tools.agent_runner.models import ExecutionResult, LinearIssue

logger = logging.getLogger("agent_runner.evolution")


@dataclass
class DistilledLesson:
    id: str
    ticket_identifier: str
    agent_name: str
    failure_category: str  # "typecheck", "test_failure", "anti_suppression", "timeout", "syntax"
    root_cause_summary: str
    actionable_rule: str
    timestamp_utc: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SelfEvolutionEngine:
    """Extracts systemic lessons from execution friction and auto-repairs to evolve future agent prompts."""

    def __init__(
        self,
        foresight: ForesightBridge | None = None,
        event_bus: EventBus | None = None,
        storage_path: str | None = None,
    ):
        self.foresight = foresight or ForesightBridge()
        self.event_bus = event_bus or EventBus()
        default_path = os.path.expanduser("~/.local/state/agent-runner/lessons.jsonl")
        self.storage_path = os.path.abspath(storage_path or default_path)
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        self._lock = threading.Lock()

    def _classify_friction(self, logs: str, violations: list[str]) -> tuple[str, str, str]:
        """Classify root cause and generate distilled actionable rule from logs."""
        logs_lower = (logs or "").lower()

        if violations:
            return (
                "anti_suppression",
                f"Attempted code suppression in diff: {', '.join(violations[:2])}",
                "NEVER insert @ts-ignore, @ts-nocheck, # noqa, or # type: ignore. Always fix underlying type definitions.",
            )

        if "dtz" in logs_lower or "naive datetime" in logs_lower:
            return (
                "lint_datetime",
                "Ruff DTZ rule violation on naive datetime construction.",
                "Construct timezone-aware datetimes with timezone.utc or use datetime.fromisoformat() without # noqa.",
            )

        if "ruff" in logs_lower or "eslint" in logs_lower or "oxlint" in logs_lower or "lint" in logs_lower:
            return (
                "lint_violation",
                "Linter rule violation during code verification.",
                "Run 'uv run ruff check --fix' or 'pnpm lint' and fix root cause without suppression comments.",
            )

        if "ts(" in logs or "type error" in logs_lower or "cannot find module" in logs_lower:
            match = re.search(r"error TS\d+:\s*([^\n]+)", logs)
            detail = match.group(1) if match else "TypeScript compilation error"
            return (
                "typecheck",
                f"Typecheck failure: {detail[:120]}",
                "Ensure all TypeScript imports and exported interfaces strictly match workspace tsconfig definitions.",
            )

        if "failed" in logs_lower and ("assert" in logs_lower or "pytest" in logs_lower or "vitest" in logs_lower):
            return (
                "test_failure",
                "Test assertion failure during verification checks.",
                "Always run local targeted test commands (pnpm vitest / uv run pytest) before submitting code changes.",
            )

        if "timed out" in logs_lower or "timeout" in logs_lower:
            return (
                "timeout",
                "Agent command exceeded execution timeout ceiling.",
                "Decompose long-running batch modifications into smaller atomic subtasks using TASK_GRAPH.",
            )

        if "blast radius exceeded" in logs_lower or (
            "files changed" in logs_lower and any(f"{n} files" in logs_lower for n in range(50, 500))
        ):
            return (
                "blast_radius",
                "Diff touched too many files — over-scoped execution beyond ticket boundaries.",
                "BLAST RADIUS CAP: Feature tickets ≤30 files, config/skeptic tickets ≤10 files. "
                "When editing config or performing a review, only touch files the ticket explicitly describes. "
                "Do NOT propagate changes to unrelated files. Run 'git diff --name-only' before committing to verify scope.",
            )

        return (
            "general_friction",
            "Execution completed with diagnostic failures.",
            "Verify all files and commands against the repository structure before completing tasks.",
        )

    def format_lessons_for_prompt(self, limit: int = 5) -> str:
        """Format recent systemic lessons for injection into agent prompts."""
        lessons = self.get_recent_lessons(limit=limit)
        if not lessons:
            return ""
        lines = ["RECENT SYSTEMIC LESSONS & PREVENTATIVE RULES:"]
        for les in lessons:
            lines.append(f"- **[{les.failure_category.upper()}]**: {les.actionable_rule}")
        return "\n".join(lines)

    def process_execution_friction(
        self,
        issue: LinearIssue,
        agent_name: str,
        result: ExecutionResult,
        repair_attempts: int = 0,
    ) -> DistilledLesson | None:
        """Analyze failed execution or high-friction auto-repair and distill persistent lesson."""
        has_internal_friction = (
            "flags" in (result.output or "").lower()
            or "fixing" in (result.output or "").lower()
            or "retry" in (result.output or "").lower()
        )
        if (
            result.success
            and result.verification_passed
            and not result.guardrail_violations
            and repair_attempts == 0
            and not has_internal_friction
        ):
            return None

        combined_logs = f"{result.stderr}\n{result.verification_logs}\n{result.output}"
        category, root_cause, actionable_rule = self._classify_friction(combined_logs, result.guardrail_violations)

        lesson_id = f"LES-{int(datetime.now(timezone.utc).timestamp())}"
        lesson = DistilledLesson(
            id=lesson_id,
            ticket_identifier=issue.identifier,
            agent_name=agent_name,
            failure_category=category,
            root_cause_summary=root_cause,
            actionable_rule=actionable_rule,
        )

        with self._lock:
            try:
                with open(self.storage_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps(asdict(lesson)) + "\n")
            except Exception as e:
                logger.warning("Could not append lesson to %s: %s", self.storage_path, e)

        if self.foresight.enabled:
            mem_content = (
                f"[Self-Evolution Lesson from {issue.identifier} via {agent_name}]: {root_cause} -> {actionable_rule}"
            )
            self.foresight.store_decision(
                category="lesson",
                content=mem_content,
                ticket_ref=issue.identifier,
            )

        self.event_bus.publish(
            EventType.TICKET_FAILED if not result.success else EventType.AUTO_REPAIR_TRIGGERED,
            agent_name=agent_name,
            ticket_identifier=issue.identifier,
            payload={
                "lesson_id": lesson_id,
                "category": category,
                "rule": actionable_rule,
            },
        )

        logger.info("Distilled Self-Evolution Lesson [%s] for %s: %s", lesson_id, issue.identifier, actionable_rule)
        return lesson

    def get_recent_lessons(self, limit: int = 20) -> list[DistilledLesson]:
        """Fetch recently distilled lessons."""
        lessons: list[DistilledLesson] = []
        if not os.path.exists(self.storage_path):
            return lessons

        with self._lock:
            try:
                with open(self.storage_path, encoding="utf-8") as f:
                    lines = f.readlines()
                for line in reversed(lines):
                    if not line.strip():
                        continue
                    data = json.loads(line)
                    lessons.append(DistilledLesson(**data))
                    if len(lessons) >= limit:
                        break
            except Exception as e:
                logger.warning("Error reading lessons ledger: %s", e)

        return lessons

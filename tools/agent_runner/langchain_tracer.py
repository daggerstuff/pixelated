"""LangChain and LangSmith RunTree execution tracer for multi-agent coordinator lifecycle."""

from __future__ import annotations

import contextlib
import json
import logging
import os
import threading
from datetime import datetime, timezone
from typing import Any

from tools.agent_runner.models import AgentConfig, ExecutionResult, LinearIssue, ProjectConfig
from tools.agent_runner.verifier import VerificationOutcome

logger = logging.getLogger("agent_runner.langchain")

try:
    from dotenv import load_dotenv  # type: ignore[import-untyped]

    load_dotenv(override=True)
except ImportError:
    pass

try:
    from langsmith.run_trees import RunTree  # type: ignore[import-untyped]
except ImportError:
    RunTree = None


class LangChainAgentTracer:
    """Manages LangSmith RunTree traces across coordinator ticks, ticket executions, and verification spans."""

    def __init__(self, project_name: str | None = None, enabled: bool = True, traces_dir: str | None = None):
        self.project_name = project_name or os.environ.get("LANGSMITH_PROJECT", "tracer")
        self.enabled = enabled
        default_dir = os.path.expanduser("~/.local/state/agent-runner/traces")
        self.traces_dir = os.path.abspath(traces_dir or default_dir)
        os.makedirs(self.traces_dir, exist_ok=True)
        self._lock = threading.Lock()

        self._has_langsmith = RunTree is not None
        self._RunTree = RunTree

    def _persist_trace_locally(self, trace_name: str, payload: dict[str, Any]) -> None:
        """Save structured trace event locally to ~/.local/state/agent-runner/traces/."""
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        fname = f"{ts}_{trace_name.replace(':', '_').replace('/', '_')}.json"
        fpath = os.path.join(self.traces_dir, fname)
        try:
            with self._lock, open(fpath, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, default=str)
        except Exception as e:
            logger.warning("Could not persist trace locally: %s", e)

    def _flush_tree(self, tree: Any | None) -> None:
        """Force flush LangSmith HTTP client queue immediately."""
        if tree and hasattr(tree, "client") and hasattr(tree.client, "flush"):
            with contextlib.suppress(Exception):
                tree.client.flush()

    def start_tick_trace(self, server_label: str, projects: list[ProjectConfig]) -> Any | None:
        """Create a root RunTree span for a coordinator polling tick."""
        if not self.enabled:
            return None

        inputs = {
            "server_label": server_label,
            "monitored_projects": [p.team_key for p in projects],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        if self._has_langsmith and self._RunTree:
            try:
                tree = self._RunTree(
                    name=f"Coordinator-Tick-{server_label}",
                    run_type="chain",
                    project_name=self.project_name,
                    inputs=inputs,
                )
                tree.post()
                self._flush_tree(tree)
                logger.info(
                    "LangSmith RunTree root trace started: %s (id: %s, project: %s)",
                    tree.name,
                    tree.id,
                    self.project_name,
                )
                return tree
            except Exception as e:
                logger.warning("Error starting LangSmith RunTree: %s", e)

        return {"name": f"Coordinator-Tick-{server_label}", "inputs": inputs, "children": []}

    def end_tick_trace(self, tree: Any | None, stats: dict[str, Any]) -> None:
        """End the tick RunTree and record outcome statistics."""
        if not tree or not self.enabled:
            return

        if self._has_langsmith and self._RunTree and hasattr(tree, "end"):
            try:
                tree.end(outputs=stats)
                tree.patch()
                self._flush_tree(tree)
                # Persist copy locally
                tree_dump = tree.model_dump() if hasattr(tree, "model_dump") else tree.dict()
                self._persist_trace_locally(tree.name, tree_dump)
                return
            except Exception as e:
                logger.debug("Error ending LangSmith RunTree: %s", e)

        if isinstance(tree, dict):
            tree["outputs"] = stats
            tree["end_time"] = datetime.now(timezone.utc).isoformat()
            self._persist_trace_locally(tree.get("name", "tick"), tree)

    def start_ticket_execution_trace(
        self,
        parent_tree: Any | None,
        project: ProjectConfig | None,
        agent: AgentConfig,
        issue: LinearIssue,
    ) -> Any | None:
        """Create a child RunTree execution span for a specific ticket."""
        if not self.enabled:
            return None

        team_key = project.team_key if project else (issue.identifier.split("-")[0] if "-" in issue.identifier else "")
        inputs = {
            "team_key": team_key,
            "agent_name": agent.name,
            "agent_role": agent.role.value,
            "ticket_identifier": issue.identifier,
            "ticket_title": issue.title,
            "labels": issue.labels,
            "priority": issue.priority,
        }

        if self._has_langsmith and self._RunTree and hasattr(parent_tree, "create_child"):
            try:
                child = parent_tree.create_child(
                    name=f"Execute-{issue.identifier}-{agent.name}",
                    run_type="chain",
                    inputs=inputs,
                )
                child.post()
                self._flush_tree(child)
                logger.info("LangSmith RunTree child span started: %s (id: %s)", child.name, child.id)
                return child
            except Exception as e:
                logger.warning("Error creating LangSmith child RunTree: %s", e)

        return {"name": f"Execute-{issue.identifier}-{agent.name}", "inputs": inputs, "steps": []}

    def record_retrieval(
        self,
        ticket_tree: Any | None,
        query: str,
        foresight_context: str,
        skills_matched: list[tuple[str, str]],
    ) -> None:
        """Record context retrieval span (Foresight memories + skills)."""
        if not ticket_tree or not self.enabled:
            return

        inputs = {"query": query}
        outputs = {
            "foresight_context_length": len(foresight_context),
            "skills_matched": [name for name, _ in skills_matched],
        }

        if self._has_langsmith and hasattr(ticket_tree, "create_child"):
            try:
                retriever_child = ticket_tree.create_child(
                    name="Retrieve-Context",
                    run_type="retriever",
                    inputs=inputs,
                )
                retriever_child.post()
                retriever_child.end(outputs=outputs)
                retriever_child.patch()
                self._flush_tree(retriever_child)
                return
            except Exception as e:
                logger.debug("Error recording LangSmith retrieval child: %s", e)

        if isinstance(ticket_tree, dict):
            ticket_tree.setdefault("steps", []).append(
                {"type": "retriever", "name": "Retrieve-Context", "inputs": inputs, "outputs": outputs}
            )

    def record_agent_cli(
        self,
        ticket_tree: Any | None,
        agent: AgentConfig,
        prompt: str,
        result: ExecutionResult,
    ) -> None:
        """Record the core LLM / Agent CLI execution span."""
        if not ticket_tree or not self.enabled:
            return

        inputs = {"prompt_length": len(prompt), "cmd": agent.cmd}
        outputs = {
            "exit_code": result.exit_code,
            "duration_seconds": result.duration_seconds,
            "output_preview": result.output[:300],
            "actions_count": len(result.actions),
            "guardrail_violations": result.guardrail_violations,
        }

        if self._has_langsmith and hasattr(ticket_tree, "create_child"):
            try:
                llm_child = ticket_tree.create_child(
                    name=f"Agent-CLI-{agent.name}",
                    run_type="llm",
                    inputs=inputs,
                )
                llm_child.post()
                llm_child.end(outputs=outputs)
                llm_child.patch()
                self._flush_tree(llm_child)
                return
            except Exception as e:
                logger.debug("Error recording LangSmith agent CLI child: %s", e)

        if isinstance(ticket_tree, dict):
            ticket_tree.setdefault("steps", []).append(
                {"type": "llm", "name": f"Agent-CLI-{agent.name}", "inputs": inputs, "outputs": outputs}
            )

    def record_verification(
        self,
        ticket_tree: Any | None,
        outcome: VerificationOutcome,
    ) -> None:
        """Record the automated verification / test gate span."""
        if not ticket_tree or not self.enabled:
            return

        outputs = {
            "passed": outcome.passed,
            "duration_seconds": outcome.duration_seconds,
            "commands_evaluated": len(outcome.command_results),
            "summary": outcome.summary[:300],
        }

        if self._has_langsmith and hasattr(ticket_tree, "create_child"):
            try:
                tool_child = ticket_tree.create_child(
                    name="Verification-Gate",
                    run_type="tool",
                    inputs={},
                )
                tool_child.post()
                tool_child.end(outputs=outputs)
                tool_child.patch()
                self._flush_tree(tool_child)
                return
            except Exception as e:
                logger.debug("Error recording LangSmith verification child: %s", e)

        if isinstance(ticket_tree, dict):
            ticket_tree.setdefault("steps", []).append(
                {"type": "tool", "name": "Verification-Gate", "inputs": {}, "outputs": outputs}
            )

    def end_ticket_execution_trace(
        self,
        ticket_tree: Any | None,
        result: ExecutionResult,
        extra_outputs: dict[str, Any] | None = None,
    ) -> None:
        """Close ticket execution trace and serialize results."""
        if not ticket_tree or not self.enabled:
            return

        outputs = {
            "success": result.success,
            "verification_passed": result.verification_passed,
            "exit_code": result.exit_code,
            "duration_seconds": result.duration_seconds,
            "actions": [a.action_type.value for a in result.actions],
        }
        if extra_outputs:
            outputs.update(extra_outputs)

        if self._has_langsmith and hasattr(ticket_tree, "end"):
            try:
                ticket_tree.end(outputs=outputs)
                ticket_tree.patch()
                self._flush_tree(ticket_tree)
                tree_dump = ticket_tree.model_dump() if hasattr(ticket_tree, "model_dump") else ticket_tree.dict()
                self._persist_trace_locally(ticket_tree.name, tree_dump)
                return
            except Exception as e:
                logger.debug("Error ending LangSmith ticket tree: %s", e)

        if isinstance(ticket_tree, dict):
            ticket_tree["outputs"] = outputs
            ticket_tree["end_time"] = datetime.now(timezone.utc).isoformat()
            self._persist_trace_locally(ticket_tree.get("name", "ticket"), ticket_tree)

    def record_skeptic_trace(
        self,
        parent_tree: Any | None,
        project: ProjectConfig,
        skeptic_name: str,
        metrics: dict[str, Any],
    ) -> None:
        """Record skeptic review span."""
        if not parent_tree or not self.enabled:
            return

        inputs = {"team_key": project.team_key, "skeptic_agent": skeptic_name}

        if self._has_langsmith and hasattr(parent_tree, "create_child"):
            try:
                child = parent_tree.create_child(
                    name=f"Skeptic-Review-{project.team_key}",
                    run_type="chain",
                    inputs=inputs,
                )
                child.post()
                child.end(outputs=metrics)
                child.patch()
                return
            except Exception as e:
                logger.debug("Error recording LangSmith skeptic child: %s", e)

        if isinstance(parent_tree, dict):
            parent_tree.setdefault("children", []).append(
                {"name": f"Skeptic-Review-{project.team_key}", "inputs": inputs, "outputs": metrics}
            )

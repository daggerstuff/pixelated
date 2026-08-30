"""Stateful Multi-Agent Coding Graph Architecture (Modern Multi-Agent Coding Architectures).

Implements:
1. Strict Typed State Schema (TypedDict & append-only reviewer feedback ledger).
2. Narrow Role Prompting & Tool Permission Siloing:
   - Developer Node: Write code, update state, set pending_review.
   - Reviewer Node: Read-only files, test execution, append reviewer_feedback.
   - Human Proxy Node: Breakpoint on iteration_count >= max_iterations or escalation.
   - Finalize Merge Node: Merge/PR creation on approval.
3. Conditional Graph Routing Engine.
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal, TypedDict

from tools.agent_runner.adapters import AgentAdapter, get_agent_adapter
from tools.agent_runner.models import AgentConfig, ExecutionResult, LinearIssue
from tools.agent_runner.verifier import VerificationEngine, VerificationOutcome

logger = logging.getLogger("agent_runner.state_graph")


class AgentState(TypedDict):
    task_id: str
    task_description: str
    file_paths: list[str]
    current_code: str
    reviewer_feedback: list[str]  # Append-only feedback ledger
    iteration_count: int
    max_iterations: int
    status: Literal["in_progress", "pending_review", "approved", "escalated", "aborted"]
    active_agent: str
    developer_agent: str
    reviewer_agent: str
    escalation_id: str | None
    metadata: dict[str, Any]


@dataclass
class GraphNodeResult:
    node_name: str
    state: AgentState
    action_taken: str
    execution_result: ExecutionResult | None = None


class DeveloperNode:
    """Developer Node: Given task_description and latest reviewer_feedback.

    Physically writes code into the sandbox, increments iteration_count,
    and sets status to pending_review.
    """

    def __init__(self, adapter: AgentAdapter, agent_cfg: AgentConfig):
        self.adapter = adapter
        self.agent_cfg = agent_cfg

    def execute(self, state: AgentState, workdir: str) -> GraphNodeResult:
        state["iteration_count"] += 1
        logger.info(
            "Developer Node executing iteration %d/%d for task %s...",
            state["iteration_count"],
            state["max_iterations"],
            state["task_id"],
        )

        feedback_history = "\n".join(
            [f"[Reviewer Iteration {i+1}]: {f}" for i, f in enumerate(state["reviewer_feedback"])]
        )
        if not feedback_history:
            feedback_history = "No previous reviewer feedback. Initial implementation pass."

        dev_prompt = (
            f"TASK: {state['task_description']}\n\n"
            f"CURRENT ITERATION: {state['iteration_count']}/{state['max_iterations']}\n\n"
            f"REVIEWER FEEDBACK LEDGER:\n{feedback_history}\n\n"
            f"DEVELOPER MANDATE:\n"
            f"1. Read the task requirements and address ALL feedback from the reviewer above.\n"
            f"2. Write clean, complete implementation code directly into the workspace.\n"
            f"3. Do NOT add dummy mocks, seeded random generators, or type-suppression comments.\n"
        )

        exec_res = self.adapter.run(
            prompt=dev_prompt,
            workdir=workdir,
            ticket_identifier=state["task_id"],
            enable_branching=False,
        )

        state["current_code"] = exec_res.git_diff_summary
        state["status"] = "pending_review"
        state["active_agent"] = state["reviewer_agent"]

        return GraphNodeResult(
            node_name="Developer_Node",
            state=state,
            action_taken="Code written and transitioned to pending_review.",
            execution_result=exec_res,
        )


class ReviewerNode:
    """Reviewer Node: Read-only access to files, execute-only access to terminal tests.

    Physically cannot edit code. Appends findings to reviewer_feedback.
    Updates status to in_progress (if tests fail) or approved (if tests pass).
    """

    def __init__(self, verifier: VerificationEngine, config: Any | None = None):
        self.verifier = verifier
        self.config = config

    def execute(self, state: AgentState, workdir: str) -> GraphNodeResult:
        logger.info("Reviewer Node evaluating sandbox code for task %s...", state["task_id"])

        verification_outcome = self.verifier.verify(workdir)

        if verification_outcome.passed:
            logger.info("✅ Reviewer verified all tests and lints passed for %s!", state["task_id"])
            state["reviewer_feedback"].append("VERIFICATION APPROVED: All automated tests, type checks, and lints passed.")
            state["status"] = "approved"
            state["active_agent"] = "System"
        else:
            logger.warning("❌ Reviewer found failures in %s:\n%s", state["task_id"], verification_outcome.summary)
            feedback_entry = (
                f"VERIFICATION FAILED:\n{verification_outcome.summary}\n"
                f"Commands failed: {[c.get('command', '') for c in verification_outcome.command_results if not c.get('passed', False)]}"
            )
            state["reviewer_feedback"].append(feedback_entry)
            state["status"] = "in_progress"
            state["active_agent"] = state["developer_agent"]

        return GraphNodeResult(
            node_name="Reviewer_Node",
            state=state,
            action_taken=f"Reviewer completed: status set to {state['status']}.",
            execution_result=ExecutionResult(
                agent_name="Reviewer",
                ticket_identifier=state["task_id"],
                success=verification_outcome.passed,
                output=verification_outcome.summary,
                verification_passed=verification_outcome.passed,
                verification_logs=verification_outcome.summary,
            ),
        )


class CodingStateGraph:
    """Stateful orchestration graph executing Developer <-> Reviewer <-> HITL routing."""

    def __init__(
        self,
        developer_cfg: AgentConfig,
        reviewer_cfg: AgentConfig | None = None,
        verifier: VerificationEngine | None = None,
        max_iterations: int = 5,
        escalation_store: Any | None = None,
    ):
        self.developer_cfg = developer_cfg
        self.reviewer_cfg = reviewer_cfg or AgentConfig(name="qa_reviewer", label="agent:qa", cmd=["echo"])
        dev_adapter = get_agent_adapter(developer_cfg)
        self.developer_node = DeveloperNode(adapter=dev_adapter, agent_cfg=developer_cfg)
        self.reviewer_node = ReviewerNode(verifier=verifier or VerificationEngine())
        self.max_iterations = max_iterations
        self.escalation_store = escalation_store

    def initialize_state(self, issue: LinearIssue, max_iterations: int | None = None) -> AgentState:
        """Create fresh typed state schema."""
        return AgentState(
            task_id=issue.identifier,
            task_description=f"{issue.title}\n{issue.description or ''}",
            file_paths=[],
            current_code="",
            reviewer_feedback=[],
            iteration_count=0,
            max_iterations=max_iterations or self.max_iterations,
            status="in_progress",
            active_agent=self.developer_cfg.name,
            developer_agent=self.developer_cfg.name,
            reviewer_agent=self.reviewer_cfg.name,
            escalation_id=None,
            metadata={"issue_id": issue.id, "created_at": datetime.now(timezone.utc).isoformat()},
        )

    def route_workflow(self, state: AgentState) -> str:
        """Evaluate conditional edges based on iteration count and status flag."""
        # 1. Breakpoint / Escalation Trigger
        if state["iteration_count"] >= state["max_iterations"] and state["status"] != "approved":
            return "Human_Proxy_Node"

        if state["status"] == "pending_review":
            return "Reviewer_Node"

        if state["status"] == "in_progress":
            return "Developer_Node"

        if state["status"] == "approved":
            return "Finalize_Merge"

        if state["status"] == "aborted":
            return "Abort_Teardown"

        return "Human_Proxy_Node"

    def run_graph_loop(self, state: AgentState, workdir: str) -> tuple[AgentState, list[GraphNodeResult]]:
        """Run the state machine until approved, aborted, or escalated to Human Proxy."""
        history: list[GraphNodeResult] = []

        while True:
            next_node = self.route_workflow(state)
            logger.info("State Graph routing step: next node is '%s' (status: %s, iter: %d)", next_node, state["status"], state["iteration_count"])

            if next_node == "Developer_Node":
                res = self.developer_node.execute(state, workdir)
                history.append(res)

            elif next_node == "Reviewer_Node":
                res = self.reviewer_node.execute(state, workdir)
                history.append(res)

            elif next_node == "Human_Proxy_Node":
                logger.warning("🚨 Human Proxy Breakpoint reached for task %s at iteration %d!", state["task_id"], state["iteration_count"])
                state["status"] = "escalated"
                if self.escalation_store:
                    esc_id = self.escalation_store.create_escalation(state)
                    state["escalation_id"] = esc_id
                history.append(GraphNodeResult(node_name="Human_Proxy_Node", state=state, action_taken="Escalated to Human-in-the-Loop CLI."))
                break

            elif next_node == "Finalize_Merge":
                logger.info("🎉 Task %s approved! Ready for PR finalization.", state["task_id"])
                history.append(GraphNodeResult(node_name="Finalize_Merge", state=state, action_taken="Graph execution approved and finalized."))
                break

            elif next_node == "Abort_Teardown":
                logger.info("Task %s aborted by policy or user.", state["task_id"])
                history.append(GraphNodeResult(node_name="Abort_Teardown", state=state, action_taken="Execution aborted."))
                break

        return state, history

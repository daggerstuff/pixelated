"""Human-in-the-Loop (HITL) Router & Interactive CLI Proxy (Modern Multi-Agent Coding Architectures).

Implements:
1. SQLite Escalation Store for serialized state snapshots.
2. CLI Listener with interactive terminal intervention:
   - (1) Send hint to Developer (injects SYSTEM OVERRIDE: {hint} into feedback array).
   - (2) Approve manually.
   - (3) Abort.
3. Graph resumption and state deserialization.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from tools.agent_runner.state_graph import AgentState

logger = logging.getLogger("agent_runner.hitl")


class EscalationStore:
    """SQLite-backed append-only store for paused graph states and human interventions."""

    def __init__(self, db_path: str | None = None):
        default_dir = os.path.expanduser("~/.local/state/agent-runner")
        os.makedirs(default_dir, exist_ok=True)
        self.db_path = os.path.abspath(db_path or os.path.join(default_dir, "escalations.db"))
        self._init_db()

    def _init_db(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS escalations (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    iteration_count INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    state_json TEXT NOT NULL,
                    reviewer_error TEXT,
                    resolution_action TEXT,
                    hint_text TEXT,
                    created_at TEXT NOT NULL,
                    resolved_at TEXT
                )
                """
            )
            conn.commit()

    def create_escalation(self, state: AgentState) -> str:
        """Serialize and persist graph state when a breakpoint is hit."""
        esc_id = f"ESC-{state['task_id']}-{int(time.time())}"
        latest_error = state["reviewer_feedback"][-1] if state["reviewer_feedback"] else "Max iteration limit reached."

        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO escalations (
                    id, task_id, iteration_count, status, state_json, reviewer_error, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    esc_id,
                    state["task_id"],
                    state["iteration_count"],
                    "pending",
                    json.dumps(state),
                    latest_error,
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            conn.commit()

        logger.info("Created HITL escalation %s for task %s", esc_id, state["task_id"])
        return esc_id

    def get_pending_escalations(self) -> list[dict[str, Any]]:
        """Fetch all unresolved escalations."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT * FROM escalations WHERE status = 'pending' ORDER BY created_at ASC"
            ).fetchall()
            return [dict(r) for r in rows]

    def get_escalation(self, esc_id: str) -> dict[str, Any] | None:
        """Fetch single escalation by ID."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT * FROM escalations WHERE id = ?", (esc_id,)).fetchone()
            return dict(row) if row else None

    def resolve_escalation(
        self, esc_id: str, action: str, hint: str | None = None
    ) -> AgentState | None:
        """Apply human intervention to state and mark resolved."""
        esc = self.get_escalation(esc_id)
        if not esc:
            return None

        state: AgentState = json.loads(esc["state_json"])

        if action == "hint":
            if hint:
                state["reviewer_feedback"].append(f"SYSTEM OVERRIDE: {hint}")
            state["status"] = "in_progress"
            state["active_agent"] = state["developer_agent"]
        elif action == "approve":
            state["status"] = "approved"
            state["reviewer_feedback"].append("HUMAN OVERRIDE: Manually approved by operator.")
        elif action == "abort":
            state["status"] = "aborted"
            state["reviewer_feedback"].append("HUMAN OVERRIDE: Execution aborted by operator.")

        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                UPDATE escalations
                SET status = 'resolved',
                    resolution_action = ?,
                    hint_text = ?,
                    state_json = ?,
                    resolved_at = ?
                WHERE id = ?
                """,
                (
                    action,
                    hint,
                    json.dumps(state),
                    datetime.now(timezone.utc).isoformat(),
                    esc_id,
                ),
            )
            conn.commit()

        logger.info("Resolved HITL escalation %s with action '%s'", esc_id, action)
        return state


def cli_proxy_listen(store: EscalationStore | None = None) -> None:
    """Interactive terminal listener for paused agent state graphs."""
    store = store or EscalationStore()
    print("=" * 60)
    print("🤖 Agent State Graph — Human-in-the-Loop CLI Proxy Listener")
    print(f"Monitoring: {store.db_path}")
    print("Press Ctrl+C to exit.")
    print("=" * 60)

    try:
        while True:
            pending = store.get_pending_escalations()
            if not pending:
                time.sleep(2)
                continue

            for esc in pending:
                state: AgentState = json.loads(esc["state_json"])
                print("\n" + "#" * 60)
                print(f"🚨 BREAKPOINT TRIGGERED: Task {state['task_id']} (Escalation ID: {esc['id']})")
                print(f"Iteration: {state['iteration_count']}/{state['max_iterations']}")
                print(f"Active Agent: {state['developer_agent']} -> {state['reviewer_agent']}")
                print("-" * 60)
                print("LATEST REVIEWER ERROR / FEEDBACK:")
                print(esc["reviewer_error"])
                print("-" * 60)

                print("\nOptions:")
                print("  (1) Send hint to Developer")
                print("  (2) Approve manually")
                print("  (3) Abort execution")
                choice = input("\nSelect action (1/2/3): ").strip()

                if choice == "1":
                    hint = input("Enter instruction/hint for Developer: ").strip()
                    store.resolve_escalation(esc["id"], action="hint", hint=hint)
                    print(f"✅ Injected system override hint into {state['task_id']}. Resuming graph...")
                elif choice == "2":
                    store.resolve_escalation(esc["id"], action="approve")
                    print(f"✅ Task {state['task_id']} approved. Resuming graph to PR merge...")
                elif choice == "3":
                    store.resolve_escalation(esc["id"], action="abort")
                    print(f"🛑 Task {state['task_id']} aborted.")
                else:
                    print("Invalid option. Skipping for now...")

            time.sleep(1)
    except KeyboardInterrupt:
        print("\nExiting HITL proxy listener.")

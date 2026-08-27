"""Thread-safe persistent state manager for runner metadata and round-robin indices."""

from __future__ import annotations

import json
import logging
import os
import threading
from typing import Any

logger = logging.getLogger("agent_runner.state")


class StateManager:
    """Manages thread-safe local JSON state file."""

    def __init__(self, state_path: str | None = None):
        default_path = os.path.expanduser("~/.local/state/agent-runner/state.json")
        self.state_path = os.path.abspath(state_path or default_path)
        os.makedirs(os.path.dirname(self.state_path), exist_ok=True)
        self._lock = threading.Lock()
        self._state: dict[str, Any] = {
            "round_robin_index": 0,
            "last_skeptic_comment_ids": {},
            "active_claims": {},
            "metrics": {
                "total_triaged": 0,
                "total_completed": 0,
                "total_failed": 0,
                "skeptic_reviews": 0,
            },
        }
        self.load()

    def load(self) -> None:
        """Load state from disk."""
        with self._lock:
            if not os.path.exists(self.state_path):
                self._save_locked()
                return

            try:
                with open(self.state_path, encoding="utf-8") as f:
                    disk_state = json.load(f)
                    self._state.update(disk_state)
            except Exception as e:
                logger.warning("Could not read state file %s: %s. Using default state.", self.state_path, e)

    def _save_locked(self) -> None:
        temp_file = f"{self.state_path}.tmp"
        try:
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(self._state, f, indent=2)
            os.replace(temp_file, self.state_path)
        except Exception as e:
            logger.error("Could not write state file %s: %s", self.state_path, e)

    def save(self) -> None:
        """Explicitly save state."""
        with self._lock:
            self._save_locked()

    def get_and_advance_rr_index(self, pool_size: int) -> int:
        """Get current round-robin index and advance."""
        if pool_size <= 0:
            return 0
        with self._lock:
            idx = self._state.get("round_robin_index", 0) % pool_size
            self._state["round_robin_index"] = (idx + 1) % pool_size
            self._save_locked()
            return idx

    def get_last_skeptic_comment_id(self, team_key: str) -> str | None:
        with self._lock:
            return self._state.get("last_skeptic_comment_ids", {}).get(team_key)

    def set_last_skeptic_comment_id(self, team_key: str, comment_id: str) -> None:
        with self._lock:
            if "last_skeptic_comment_ids" not in self._state:
                self._state["last_skeptic_comment_ids"] = {}
            self._state["last_skeptic_comment_ids"][team_key] = comment_id
            self._save_locked()

    def increment_metric(self, key: str, count: int = 1) -> None:
        with self._lock:
            metrics = self._state.setdefault("metrics", {})
            metrics[key] = metrics.get(key, 0) + count
            self._save_locked()

    def get_metrics(self) -> dict[str, int]:
        with self._lock:
            return dict(self._state.get("metrics", {}))

    def record_claim(self, issue_identifier: str, agent_name: str, server_label: str) -> None:
        with self._lock:
            claims = self._state.setdefault("active_claims", {})
            claims[issue_identifier] = {
                "agent": agent_name,
                "server": server_label,
                "timestamp": os.path.getmtime(self.state_path) if os.path.exists(self.state_path) else 0,
            }
            self._save_locked()

    def remove_claim(self, issue_identifier: str) -> None:
        with self._lock:
            claims = self._state.setdefault("active_claims", {})
            claims.pop(issue_identifier, None)
            self._save_locked()

    def get_active_claims(self) -> dict[str, Any]:
        with self._lock:
            return dict(self._state.get("active_claims", {}))

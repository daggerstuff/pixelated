"""Integration bridge to Foresight persistent memory system via Python SDK / DB."""

from __future__ import annotations

import logging
import subprocess

logger = logging.getLogger("agent_runner.foresight")


class ForesightBridge:
    """Retrieves and stores architectural context and decisions via Foresight."""

    def __init__(self, enabled: bool = True):
        self.enabled = enabled

    def get_relevant_context(self, query: str, limit: int = 5) -> str:
        """Query Foresight for relevant memories, preferences, and directives."""
        if not self.enabled or not query:
            return ""

        try:
            cmd = [
                "foresight",
                "search",
                query,
                "--limit",
                str(limit),
            ]
            res = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            if res.returncode == 0 and res.stdout.strip():
                return res.stdout.strip()
        except Exception as e:
            logger.debug("Foresight CLI query skipped or failed: %s", e)

        return ""

    def store_decision(self, category: str, content: str, ticket_ref: str | None = None) -> bool:
        """Persist architectural decision or memory to Foresight."""
        if not self.enabled:
            return False

        full_content = f"[{ticket_ref}] {content}" if ticket_ref else content
        try:
            cmd = [
                "foresight",
                "memory",
                "add",
                full_content,
                "--category",
                category,
            ]
            res = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            if res.returncode == 0:
                logger.info("Stored memory to Foresight: %s", content[:80])
                return True
        except Exception as e:
            logger.warning("Failed to store memory to Foresight: %s", e)

        return False

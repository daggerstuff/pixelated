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
        """Query Foresight for relevant memories, user preferences, and directives."""
        if not self.enabled or not query:
            return ""

        context_parts: list[str] = []

        # 1. Fetch user preferences block
        try:
            res_pref = subprocess.run(
                ["foresight", "blocks", "get", "user_preferences"],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            if res_pref.returncode == 0 and res_pref.stdout.strip():
                # Filter out server log lines
                pref_lines = [
                    line
                    for line in res_pref.stdout.splitlines()
                    if not line.startswith("2026-") and "[foresight_server]" not in line
                ]
                clean_pref = "\n".join(pref_lines).strip()
                if clean_pref:
                    context_parts.append(f"### Standing User Preferences & Directives:\n{clean_pref}")
        except Exception as e:
            logger.debug("Foresight blocks get failed: %s", e)

        # 2. Semantic search for ticket-relevant architectural memories
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
                mem_lines = [
                    line
                    for line in res.stdout.splitlines()
                    if not line.startswith("2026-") and "[foresight_server]" not in line
                ]
                clean_mem = "\n".join(mem_lines).strip()
                if clean_mem:
                    context_parts.append(f"### Relevant Architectural Memories:\n{clean_mem}")
        except Exception as e:
            logger.debug("Foresight search failed: %s", e)

        return "\n\n".join(context_parts)

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

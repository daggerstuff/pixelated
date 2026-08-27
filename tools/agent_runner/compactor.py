"""Thread compactor digesting long coordination threads into compact summaries."""

from __future__ import annotations

import logging

from tools.agent_runner.models import LinearComment

logger = logging.getLogger("agent_runner.compactor")


class ThreadCompactor:
    """Condenses long comment threads to prevent prompt bloat while preserving recent context."""

    def __init__(self, recent_window_size: int = 6):
        self.recent_window_size = recent_window_size

    def compact_thread(self, comments: list[LinearComment]) -> str:
        """Produce structured digest of coordination thread."""
        if not comments:
            return "(No prior coordination messages recorded on this blackboard.)"

        if len(comments) <= self.recent_window_size:
            lines = []
            for c in comments:
                lines.append(f"[{c.created_at[:19]}] **{c.author_name}**:\n{c.body}\n")
            return "\n".join(lines)

        older_comments = comments[: -self.recent_window_size]
        recent_comments = comments[-self.recent_window_size :]

        digest_lines = [
            f"[Summary of {len(older_comments)} earlier coordination messages archived.]",
            "",
            "### Most Recent Discussion Window:",
        ]

        for c in recent_comments:
            digest_lines.append(f"[{c.created_at[:19]}] **{c.author_name}**:\n{c.body}\n")

        return "\n".join(digest_lines)

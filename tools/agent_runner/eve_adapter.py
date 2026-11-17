"""Eve Agent & Cloudflare Workers AI Adapter with Native MCP & Foresight Grounding."""

from __future__ import annotations

import json
import logging
import os
import subprocess
import time

import requests

from tools.agent_runner.adapters import AgentAdapter
from tools.agent_runner.foresight_bridge import ForesightBridge
from tools.agent_runner.models import AgentConfig, ExecutionResult

logger = logging.getLogger("agent_runner.eve_adapter")

DEFAULT_EVE_ENDPOINT = "http://127.0.0.1:2015"

# Stream event types that end a turn. eve 0.91 emits these as entries in the
# `facts` array of each NDJSON envelope; older shapes used top-level `type`.
_TERMINAL_TYPES = {"turn.settled", "turn.completed", "session.waiting"}


class EveAgentAdapter(AgentAdapter):
    """Adapter executing the native Eve Agent service over its HTTP session API.

    The eve framework (0.91+) exposes no `eve invoke` CLI subcommand — agents
    are durable HTTP services under `/eve/v1`. This adapter creates a session
    with the grounded prompt, streams the NDJSON event feed, and collects the
    assistant reply.
    """

    def __init__(self, config: AgentConfig, foresight: ForesightBridge | None = None):
        super().__init__(config)
        self.foresight = foresight or ForesightBridge()

    @staticmethod
    def _endpoint() -> str:
        return os.environ.get("EVE_AGENT_URL", DEFAULT_EVE_ENDPOINT).rstrip("/")

    @staticmethod
    def _auth() -> tuple[str, str] | None:
        user = os.environ.get("EVE_AUTH_USERNAME")
        password = os.environ.get("EVE_AUTH_PASSWORD")
        return (user, password) if user and password else None

    def _create_session(self, endpoint: str, message: str, timeout: int) -> str:
        res = requests.post(
            f"{endpoint}/eve/v1/session",
            json={"message": message},
            auth=self._auth(),
            timeout=timeout,
        )
        res.raise_for_status()
        data = res.json()
        if not data.get("ok") or not data.get("sessionId"):
            raise RuntimeError(f"session creation rejected: {data}")
        return data["sessionId"]

    @staticmethod
    def _handle_entry(
        etype: str | None,
        data: dict,
        reply_parts: list[str],
        usage: dict,
    ) -> str | None:
        """Process one stream event entry.

        Returns a terminal outcome string when the entry ends the turn,
        otherwise None.
        """
        if etype == "content.completed":
            if data.get("kind") == "text" and data.get("phase") == "reply":
                value = data.get("value")
                if isinstance(value, str):
                    reply_parts.append(value)
        elif etype == "message.completed":
            msg = data.get("message")
            if isinstance(msg, str):
                reply_parts.append(msg)
            u = data.get("usage")
            if isinstance(u, dict):
                usage.update(u)
        elif etype == "usage.recorded":
            u = data.get("usage")
            if isinstance(u, dict):
                usage.update(u)
        elif etype in _TERMINAL_TYPES:
            return str(data.get("outcome") or "completed")
        return None

    def _stream_session(self, endpoint: str, session_id: str, timeout: int) -> tuple[str, dict, bool]:
        """Stream session events; return (reply_text, usage, completed)."""
        reply_parts: list[str] = []
        usage: dict = {}
        outcome: str | None = None

        with requests.get(
            f"{endpoint}/eve/v1/session/{session_id}/stream",
            auth=self._auth(),
            headers={"accept": "application/x-ndjson"},
            stream=True,
            timeout=(10, timeout),
        ) as res:
            res.raise_for_status()
            for raw in res.iter_lines(decode_unicode=True):
                line = (raw or "").strip()
                if not line.startswith("{"):
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue

                # eve 0.91 envelope: {"facts": [{type, data, scope}], ...}
                # plus legacy top-level {"type": ..., "data": ...} events.
                entries = event.get("facts")
                if isinstance(entries, list) and entries:
                    items = [(f.get("type"), f.get("data") or {}) for f in entries if isinstance(f, dict)]
                else:
                    items = [(event.get("type"), event.get("data") or {})]

                for etype, data in items:
                    terminal = self._handle_entry(etype, data, reply_parts, usage)
                    if terminal is not None:
                        outcome = terminal

                if outcome is not None:
                    break

        completed = outcome is not None
        return "".join(reply_parts).strip(), usage, completed and outcome == "completed"

    def run(
        self,
        prompt: str,
        workdir: str,
        ticket_identifier: str,
        enable_branching: bool = False,
    ) -> ExecutionResult:
        _ = enable_branching
        start_time = time.time()
        endpoint = self._endpoint()
        logger.info(
            "Invoking Eve Agent service at %s for %s in %s...",
            endpoint,
            ticket_identifier,
            workdir,
        )

        # 1. Fetch Foresight persistent memory and standing directives
        title = prompt.splitlines()[0] if prompt else ""
        foresight_context = self.foresight.get_relevant_context(f"{title} {prompt}")

        full_prompt = (
            f"=== PERSISTENT FORESIGHT CONTEXT & USER PREFERENCES ===\n"
            f"{foresight_context}\n\n"
            f"=== TASK INSTRUCTIONS ===\n"
            f"{prompt}\n"
        )

        timeout = self.config.timeout_seconds
        stdout = ""
        stderr = ""
        success = False

        try:
            session_id = self._create_session(endpoint, full_prompt, timeout)
            stdout, _usage, success = self._stream_session(endpoint, session_id, timeout)
            if not success:
                stderr = f"eve session {session_id} ended without a completed turn"
        except requests.RequestException as e:
            stderr = (
                f"eve agent unreachable at {endpoint}: {e}. "
                "Start it with `agents/eve-agent/start-local.sh` or deploy the fleet."
            )
            logger.error("Eve Agent request failed for %s: %s", ticket_identifier, e)
        except Exception as e:
            stderr = str(e)
            logger.error("Eve Agent execution failed with error: %s", e)

        duration = time.time() - start_time

        # Inspect git diff to detect files created/modified
        diff_res = subprocess.run(
            ["git", "diff", "--stat", "HEAD"],
            cwd=workdir,
            capture_output=True,
            text=True,
            check=False,
        )
        diff_summary = diff_res.stdout.strip() if diff_res.returncode == 0 else ""

        return ExecutionResult(
            agent_name=self.config.name,
            ticket_identifier=ticket_identifier,
            success=success,
            output=stdout,
            stderr=stderr,
            duration_seconds=duration,
            git_diff_summary=diff_summary,
        )

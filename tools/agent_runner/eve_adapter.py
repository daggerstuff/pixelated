"""Eve Agent & Cloudflare Workers AI Adapter with Native MCP & Foresight Grounding."""

from __future__ import annotations

import json
import logging
import os
import subprocess
import time
from typing import Any

from tools.agent_runner.adapters import AgentAdapter
from tools.agent_runner.foresight_bridge import ForesightBridge
from tools.agent_runner.models import AgentConfig, ExecutionResult

logger = logging.getLogger("agent_runner.eve_adapter")


class EveAgentAdapter(AgentAdapter):
    """Adapter executing native Eve Agent framework with Cloudflare Workers AI and GLM-5.2."""

    def __init__(self, config: AgentConfig, foresight: ForesightBridge | None = None):
        super().__init__(config)
        self.foresight = foresight or ForesightBridge()

    def run(
        self,
        prompt: str,
        workdir: str,
        ticket_identifier: str,
        enable_branching: bool = False,
    ) -> ExecutionResult:
        start_time = time.time()
        logger.info("Invoking Eve Agent Adapter for %s in %s...", ticket_identifier, workdir)

        # 1. Fetch Foresight persistent memory and standing directives
        foresight_context = self.foresight.format_context_for_ticket(
            ticket_identifier=ticket_identifier,
            title=prompt.splitlines()[0] if prompt else "",
            description=prompt,
        )

        full_prompt = (
            f"=== PERSISTENT FORESIGHT CONTEXT & USER PREFERENCES ===\n"
            f"{foresight_context}\n\n"
            f"=== TASK INSTRUCTIONS ===\n"
            f"{prompt}\n"
        )

        # 2. Check if native TypeScript Eve agent exists in agents/eve-agent
        eve_root = os.path.join(workdir, "agents", "eve-agent")
        if not os.path.exists(eve_root):
            eve_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "agents", "eve-agent"))

        # Formulate execution command
        if os.path.exists(eve_root) and os.path.exists(os.path.join(eve_root, "package.json")):
            cmd = ["pnpm", "--dir", eve_root, "start", "--prompt", full_prompt]
        else:
            # Fallback to configured CLI command with full prompt file
            prompt_file = os.path.join(workdir, f".eve_prompt_{ticket_identifier}.md")
            with open(prompt_file, "w", encoding="utf-8") as f:
                f.write(full_prompt)

            cmd = [p.replace("{prompt_file}", prompt_file).replace("{prompt}", full_prompt) for p in self.config.cmd]
            if "{prompt_file}" not in " ".join(self.config.cmd) and "{prompt}" not in " ".join(self.config.cmd):
                cmd.append(prompt_file)

        env = os.environ.copy()
        env["EVE_AGENT_ROLE"] = self.config.name
        env["EVE_TASK_ID"] = ticket_identifier
        env["FORESIGHT_GROUNDED"] = "true"

        try:
            res = subprocess.run(
                cmd,
                cwd=workdir,
                env=env,
                capture_output=True,
                text=True,
                timeout=300,
                check=False,
            )
            duration = time.time() - start_time
            success = res.returncode == 0

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
                output=res.stdout,
                stderr=res.stderr,
                duration_seconds=duration,
                git_diff_summary=diff_summary,
            )

        except subprocess.TimeoutExpired:
            logger.error("Eve Agent execution timed out for %s", ticket_identifier)
            return ExecutionResult(
                agent_name=self.config.name,
                ticket_identifier=ticket_identifier,
                success=False,
                output="",
                stderr="Execution timed out after 300s",
                duration_seconds=300.0,
            )
        except Exception as e:
            logger.error("Eve Agent execution failed with error: %s", e)
            return ExecutionResult(
                agent_name=self.config.name,
                ticket_identifier=ticket_identifier,
                success=False,
                output="",
                stderr=str(e),
                duration_seconds=time.time() - start_time,
            )

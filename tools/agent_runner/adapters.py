"""Adapters for executing agent CLIs (OpenCode, Claude, MastraCode, Agy, FX)."""

from __future__ import annotations

import contextlib
import logging
import os
import subprocess
import tempfile
import time
from abc import ABC, abstractmethod

from tools.agent_runner.action_parser import ActionParser
from tools.agent_runner.models import AgentConfig, ExecutionResult

logger = logging.getLogger("agent_runner.adapters")


class AgentAdapter(ABC):
    """Abstract interface for invoking an AI coding agent CLI."""

    def __init__(self, config: AgentConfig):
        self.config = config

    @abstractmethod
    def run(
        self,
        prompt: str,
        workdir: str,
        ticket_identifier: str,
        enable_branching: bool = False,
    ) -> ExecutionResult:
        pass


class GenericCLIAdapter(AgentAdapter):
    """Invokes arbitrary CLI tools with interpolated prompt files or standard arguments."""

    def _build_command(self, prompt: str, prompt_file: str, workdir: str) -> list[str]:
        cmd = []
        has_file_placeholder = False
        for part in self.config.cmd:
            if "{prompt_file}" in part:
                cmd.append(part.replace("{prompt_file}", prompt_file))
                has_file_placeholder = True
            elif "{prompt}" in part:
                cmd.append(part.replace("{prompt}", prompt))
                has_file_placeholder = True
            else:
                cmd.append(part)

        if not has_file_placeholder:
            cmd.append(prompt)

        # Ensure auto-approval flag is enabled for interactive-capable CLIs
        if cmd and cmd[0] in ("opencode", "mastracode", "fx") and "--auto" not in cmd:
            if len(cmd) > 1 and cmd[1] == "run":
                cmd.insert(2, "--auto")
            else:
                cmd.append("--auto")

        # Explicitly enforce worktree directory isolation
        if cmd and cmd[0] == "opencode" and "--dir" not in cmd:
            if len(cmd) > 1 and cmd[1] == "run":
                cmd.insert(2, workdir)
                cmd.insert(2, "--dir")
            else:
                cmd.extend(["--dir", workdir])

        return cmd

    def run(
        self,
        prompt: str,
        workdir: str,
        ticket_identifier: str,
        enable_branching: bool = False,
    ) -> ExecutionResult:
        _ = enable_branching
        start_time = time.time()
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False, encoding="utf-8") as tf:
            tf.write(prompt)
            prompt_file = tf.name

        try:
            cmd = self._build_command(prompt, prompt_file, workdir)
            logger.info(
                "Running agent '%s' on %s in '%s' (timeout: %ds)...",
                self.config.name,
                ticket_identifier,
                workdir,
                self.config.timeout_seconds,
            )

            proc = subprocess.run(
                cmd,
                cwd=workdir,
                capture_output=True,
                text=True,
                timeout=self.config.timeout_seconds,
                check=False,
            )

            duration = time.time() - start_time
            output = proc.stdout.strip()
            stderr = proc.stderr.strip()
            success = proc.returncode == 0

            # Capture git diff summary if in a git repo
            diff_summary = ""
            try:
                diff_proc = subprocess.run(
                    ["git", "diff", "--stat", "HEAD"],
                    cwd=workdir,
                    capture_output=True,
                    text=True,
                    check=False,
                    timeout=15,
                )
                if diff_proc.stdout.strip():
                    diff_summary = diff_proc.stdout.strip()
            except Exception:
                pass

            actions = ActionParser.parse_actions(output)

            return ExecutionResult(
                success=success,
                agent_name=self.config.name,
                ticket_identifier=ticket_identifier,
                output=output,
                actions=actions,
                exit_code=proc.returncode,
                duration_seconds=duration,
                stderr=stderr,
                git_diff_summary=diff_summary,
            )

        except subprocess.TimeoutExpired:
            duration = time.time() - start_time
            logger.error(
                "Agent '%s' timed out on %s after %ds", self.config.name, ticket_identifier, self.config.timeout_seconds
            )
            return ExecutionResult(
                success=False,
                agent_name=self.config.name,
                ticket_identifier=ticket_identifier,
                output="Agent execution timed out.",
                exit_code=-1,
                duration_seconds=duration,
                stderr=f"Timeout after {self.config.timeout_seconds}s",
            )
        except Exception as e:
            duration = time.time() - start_time
            logger.exception("Error executing agent '%s' on %s: %s", self.config.name, ticket_identifier, e)
            return ExecutionResult(
                success=False,
                agent_name=self.config.name,
                ticket_identifier=ticket_identifier,
                output=f"Execution error: {e}",
                exit_code=-1,
                duration_seconds=duration,
                stderr=str(e),
            )
        finally:
            if os.path.exists(prompt_file):
                with contextlib.suppress(Exception):
                    os.remove(prompt_file)


def get_agent_adapter(config: AgentConfig) -> AgentAdapter:
    """Factory creating appropriate adapter for agent configuration."""
    if "eve" in config.name.lower() or (config.cmd and "eve" in config.cmd[0].lower()):
        from tools.agent_runner.eve_adapter import EveAgentAdapter
        return EveAgentAdapter(config)
    return GenericCLIAdapter(config)

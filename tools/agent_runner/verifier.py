"""Automated verification and test execution gate with self-healing feedback."""

from __future__ import annotations

import logging
import subprocess
import time
from dataclasses import dataclass, field
from typing import Any

from tools.agent_runner.models import VerificationConfig

logger = logging.getLogger("agent_runner.verifier")


@dataclass
class VerificationOutcome:
    passed: bool
    summary: str
    command_results: list[dict[str, Any]] = field(default_factory=list)
    duration_seconds: float = 0.0


class VerificationEngine:
    """Runs test and lint commands to verify agent changes before completion."""

    def __init__(self, config: VerificationConfig | None = None):
        self.config = config or VerificationConfig()

    def _detect_dynamic_checks(self, workdir: str) -> list[str]:
        """Infer target verification commands based on modified file types in workdir."""
        checks: list[str] = []
        try:
            status_res = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=workdir,
                capture_output=True,
                text=True,
                check=False,
                timeout=10,
            )
            files = [line.strip().split()[-1] for line in status_res.stdout.splitlines() if line.strip()]

            # Auto-format modified files with prettier before linting
            ts_files = [f for f in files if f.endswith((".ts", ".tsx", ".astro", ".js", ".jsx", ".json"))]
            if ts_files:
                subprocess.run(
                    ["pnpm", "exec", "prettier", "--write", *ts_files],
                    cwd=workdir,
                    capture_output=True,
                    check=False,
                )
                ts_args = " ".join(ts_files)
                checks.append(f"pnpm exec oxlint --type-aware -c .oxlintrc.json {ts_args}")
                checks.append("pnpm lint:no-suppressions")

            test_ts_files = [f for f in files if f.endswith((".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"))]
            for tf in test_ts_files:
                checks.append(f"pnpm vitest run --coverage.enabled=false -c config/vitest.config.ts {tf}")

            # Target only the modified Python files for ruff
            py_files = [f for f in files if f.endswith(".py")]
            if py_files:
                py_args = " ".join(py_files)
                checks.append(f"uv run ruff check {py_args}")

            test_py_files = [f for f in files if f.endswith(".py") and ("test" in f or "tests" in f)]
            for pf in test_py_files:
                checks.append(f"uv run pytest {pf} -q")

        except Exception as e:
            logger.debug("Error detecting dynamic checks: %s", e)
        return checks

    def verify(self, workdir: str, extra_commands: list[str] | None = None) -> VerificationOutcome:
        """Alias for run_checks to support state graph Reviewer interface."""
        return self.run_checks(workdir, extra_commands)

    def run_checks(self, workdir: str, extra_commands: list[str] | None = None) -> VerificationOutcome:
        """Run all configured verification commands in workdir."""
        if not self.config.enabled:
            return VerificationOutcome(passed=True, summary="Verification disabled in config.", duration_seconds=0.0)

        commands = list(self.config.commands)
        if extra_commands:
            commands.extend(extra_commands)

        if workdir != ".":
            for dc in self._detect_dynamic_checks(workdir):
                if dc not in commands:
                    commands.append(dc)

        if not commands:
            return VerificationOutcome(
                passed=True, summary="No verification commands configured.", duration_seconds=0.0
            )

        start_time = time.time()
        results: list[dict[str, Any]] = []
        all_passed = True
        summary_lines: list[str] = []

        for cmd_str in commands:
            cmd_start = time.time()
            try:
                proc = subprocess.run(
                    cmd_str,
                    shell=True,
                    cwd=workdir,
                    capture_output=True,
                    text=True,
                    timeout=self.config.timeout_seconds,
                    check=False,
                )
                duration = time.time() - cmd_start
                passed = proc.returncode == 0
                if not passed:
                    all_passed = False

                output = proc.stdout if passed else f"{proc.stdout}\n{proc.stderr}".strip()
                # Truncate large outputs
                if len(output) > 2000:
                    output = output[:1000] + "\n... [truncated] ...\n" + output[-1000:]

                results.append(
                    {
                        "command": cmd_str,
                        "passed": passed,
                        "exit_code": proc.returncode,
                        "duration": duration,
                        "output": output,
                    }
                )

                status_icon = "✅" if passed else "❌"
                summary_lines.append(f"{status_icon} `{cmd_str}` (Exit: {proc.returncode} in {duration:.1f}s)")
                if not passed:
                    summary_lines.append(f"```text\n{output}\n```")

            except subprocess.TimeoutExpired:
                all_passed = False
                summary_lines.append(f"❌ `{cmd_str}` (TIMED OUT after {self.config.timeout_seconds}s)")
                results.append(
                    {
                        "command": cmd_str,
                        "passed": False,
                        "exit_code": -1,
                        "duration": self.config.timeout_seconds,
                        "output": "Command timed out.",
                    }
                )
            except Exception as e:
                all_passed = False
                summary_lines.append(f"❌ `{cmd_str}` (ERROR: {e})")
                results.append(
                    {
                        "command": cmd_str,
                        "passed": False,
                        "exit_code": -1,
                        "duration": 0.0,
                        "output": str(e),
                    }
                )

        total_duration = time.time() - start_time
        return VerificationOutcome(
            passed=all_passed,
            summary="\n".join(summary_lines),
            command_results=results,
            duration_seconds=total_duration,
        )

    def generate_repair_prompt(self, agent_name: str, ticket_identifier: str, outcome: VerificationOutcome) -> str:
        """Generate targeted repair prompt for self-healing loop."""
        failed_commands = [r for r in outcome.command_results if not r["passed"]]
        failure_details = []
        for r in failed_commands:
            failure_details.append(
                f"### FAILED COMMAND: `{r['command']}` (Exit Code: {r['exit_code']})\n```text\n{r['output']}\n```"
            )

        failures_str = "\n\n".join(failure_details)
        return (
            f"You are agent '{agent_name}'. The verification test gate FAILED for ticket {ticket_identifier}.\n\n"
            f"DIAGNOSTIC FAILURE LOGS:\n"
            f"{failures_str}\n\n"
            f"YOUR REPAIR MISSION:\n"
            f"1. Analyze the exact error messages, stack traces, and failing assertions above.\n"
            f"2. Fix the underlying root cause in the codebase. STRICT ANTI-SUPPRESSION: Do not hide errors with @ts-ignore, @ts-nocheck, # noqa, or type suppressions.\n"
            f"3. Verify your fix passes before responding.\n"
            f"4. Conclude with RESULT: <summary of the fix>."
        )

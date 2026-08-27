"""Pre-Flight Feedforward and Post-Flight Feedback Sensor Hooks (inspired by Better Harness)."""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
from dataclasses import dataclass, field

from tools.agent_runner.models import AgentConfig, LinearIssue

logger = logging.getLogger("agent_runner.sensors")


@dataclass
class PreFlightCheckResult:
    passed: bool
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    environment_info: dict[str, str] = field(default_factory=dict)


@dataclass
class PostFlightSensorReport:
    passed: bool
    modified_files: list[str] = field(default_factory=list)
    untracked_files: list[str] = field(default_factory=list)
    diff_line_count: int = 0
    warnings: list[str] = field(default_factory=list)


class SensorHookEngine:
    """Runs pre-flight feedforward validation and post-flight feedback diagnostics."""

    @staticmethod
    def run_pre_flight_checks(
        workdir: str,
        agent: AgentConfig,
        _issue: LinearIssue | None = None,
    ) -> PreFlightCheckResult:
        """Validate environment, toolchain binaries, and directory health before agent runs."""
        errors: list[str] = []
        warnings: list[str] = []
        env_info: dict[str, str] = {}

        # 1. Check directory validity
        if not os.path.exists(workdir):
            errors.append(f"Working directory does not exist: {workdir}")
            return PreFlightCheckResult(passed=False, errors=errors)

        # 2. Check required toolchains
        required_tools = ["git", "pnpm", "uv"]
        for tool in required_tools:
            tool_path = shutil.which(tool)
            if tool_path:
                env_info[tool] = tool_path
            else:
                warnings.append(f"Toolchain binary '{tool}' not found in system PATH.")

        # 3. Check agent binary availability
        if agent.cmd:
            primary_bin = agent.cmd[0]
            bin_path = shutil.which(primary_bin)
            if bin_path:
                env_info["agent_binary"] = bin_path
            else:
                errors.append(f"Agent executable '{primary_bin}' not found in PATH.")

        # 4. Check git repo status
        try:
            res = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=workdir,
                capture_output=True,
                text=True,
                check=False,
                timeout=10,
            )
            dirty_lines = [line for line in res.stdout.splitlines() if line.strip()]
            if dirty_lines:
                warnings.append(f"Working tree has {len(dirty_lines)} dirty/uncommitted files before task start.")
        except Exception as e:
            warnings.append(f"Could not inspect git repository status: {e}")

        passed = len(errors) == 0
        return PreFlightCheckResult(
            passed=passed,
            warnings=warnings,
            errors=errors,
            environment_info=env_info,
        )

    @staticmethod
    def run_post_flight_sensors(workdir: str) -> PostFlightSensorReport:
        """Inspect git diff, untracked artifacts, and workspace state after agent execution."""
        modified_files: list[str] = []
        untracked_files: list[str] = []
        warnings: list[str] = []
        diff_lines = 0

        try:
            stat_res = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=workdir,
                capture_output=True,
                text=True,
                check=False,
                timeout=15,
            )
            for line in stat_res.stdout.splitlines():
                clean = line.strip()
                if clean.startswith("??"):
                    untracked_files.append(clean[3:].strip())
                elif clean:
                    modified_files.append(clean[2:].strip())

            diff_lines = len(stat_res.stdout.splitlines())

            suspicious_extensions = (".tmp", ".scratch", ".bak", ".swp")
            for f in untracked_files:
                if any(f.endswith(ext) for ext in suspicious_extensions):
                    warnings.append(f"Leftover temporary file detected in workspace: {f}")

        except Exception as e:
            warnings.append(f"Post-flight sensor check encountered error: {e}")

        return PostFlightSensorReport(
            passed=True,
            modified_files=modified_files,
            untracked_files=untracked_files,
            diff_line_count=diff_lines,
            warnings=warnings,
        )

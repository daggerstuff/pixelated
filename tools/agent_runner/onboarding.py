"""Interactive User Setup, Guided Onboarding & Agent Discovery Wizard."""

from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from typing import Any

from tools.agent_runner.models import AgentConfig, ProjectConfig, RunnerConfig, VerificationConfig

logger = logging.getLogger("agent_runner.onboarding")


@dataclass
class DiscoveredAgent:
    name: str
    cli_command: str
    path: str
    available: bool
    version: str = ""
    suggested_role: str = "general_coder"


class OnboardingWizard:
    """Guided wizard that inspects local tooling, auto-configures agents, and writes production configs."""

    KNOWN_AGENT_CLIS: list[tuple[str, str, str]] = [
        ("opencode", "opencode run --auto {prompt_file}", "backend_engineer"),
        ("claude", "claude --print {prompt_file}", "lead_architect"),
        ("mastracode", "mastracode run {prompt_file}", "frontend_engineer"),
        ("cursor", "cursor --agent {prompt_file}", "general_coder"),
        ("agy", "agy exec {prompt_file}", "security_sentinel"),
        ("eve", "pnpm --dir agents/eve-agent start -- {prompt_file}", "lead_architect"),
        ("fx", "fx run {prompt_file}", "qa_automator"),
    ]

    def __init__(self, workspace_root: str | None = None):
        self.workspace_root = os.path.abspath(workspace_root or os.getcwd())

    def discover_tools(self) -> dict[str, bool]:
        """Check availability of mandatory host toolchains."""
        return {
            "git": shutil.which("git") is not None,
            "node": shutil.which("node") is not None,
            "pnpm": shutil.which("pnpm") is not None,
            "uv": shutil.which("uv") is not None,
            "python": shutil.which("python3") is not None or shutil.which("python") is not None,
            "docker": shutil.which("docker") is not None,
        }

    def discover_installed_agents(self) -> list[DiscoveredAgent]:
        """Scan system PATH and local repo for installed AI agent CLIs."""
        discovered: list[DiscoveredAgent] = []

        # Check native eve agents in repo
        eve_path = os.path.join(self.workspace_root, "agents", "eve-agent")
        if os.path.exists(eve_path):
            discovered.append(
                DiscoveredAgent(
                    name="eve_architect",
                    cli_command="pnpm --dir agents/eve-agent start -- {prompt_file}",
                    path=eve_path,
                    available=True,
                    version="Eve GLM-5.2 (1M ctx)",
                    suggested_role="lead_architect",
                )
            )

        for binary, cmd_template, role in self.KNOWN_AGENT_CLIS:
            bin_path = shutil.which(binary)
            if bin_path:
                version_str = "Installed"
                try:
                    res = subprocess.run([binary, "--version"], capture_output=True, text=True, timeout=3)
                    if res.returncode == 0 and res.stdout.strip():
                        version_str = res.stdout.strip().splitlines()[0]
                except Exception:
                    pass

                discovered.append(
                    DiscoveredAgent(
                        name=binary,
                        cli_command=cmd_template,
                        path=bin_path,
                        available=True,
                        version=version_str,
                        suggested_role=role,
                    )
                )

        # Fallback if no specific agent CLIs found
        if not discovered:
            discovered.append(
                DiscoveredAgent(
                    name="claude_code",
                    cli_command="claude --print {prompt_file}",
                    path="simulated",
                    available=True,
                    version="Claude 3.7 Sonnet",
                    suggested_role="general_coder",
                )
            )

        return discovered

    def generate_preset_config(
        self,
        preset: str = "autonomous-full",
        team_key: str = "PIX",
        project_name: str = "Pixelated Health",
        agents: list[DiscoveredAgent] | None = None,
    ) -> RunnerConfig:
        """Construct a complete, production-grade RunnerConfig instance."""
        discovered = agents or self.discover_installed_agents()

        agent_configs: list[AgentConfig] = []
        for a in discovered:
            parts = a.cli_command.split()
            agent_configs.append(
                AgentConfig(
                    name=a.name,
                    label=f"agent:{a.name}",
                    cmd=parts,
                )
            )

        project = ProjectConfig(
            team_key=team_key,
            default_repo=self.workspace_root,
        )

        return RunnerConfig(
            server_label=f"node-{os.uname().nodename.split('.')[0]}",
            poll_seconds=15,
            langchain_project=os.environ.get("LANGCHAIN_PROJECT", "pixelated-multi-agent"),
            verification=VerificationConfig(
                enabled=True,
                auto_repair=True,
                max_repair_attempts=3,
            ),
            projects=[project],
            agents=agent_configs,
        )

    def run_interactive_setup(self, output_file: str | None = None) -> str:
        """Run interactive CLI onboarding session."""
        print("=" * 70)
        print("🚀 Pixelated Multi-Agent Coordinator — Interactive Setup Wizard")
        print("=" * 70)

        # 1. System toolchain verification
        tools = self.discover_tools()
        print("\n🔍 1. Inspecting Host Toolchains:")
        for t, ok in tools.items():
            status = "✅ PASS" if ok else "⚠️  MISSING (Optional/Recommended)"
            print(f"   • {t:<10}: {status}")

        # 2. Agent discovery
        agents = self.discover_installed_agents()
        print(f"\n🤖 2. Discovered AI Coding Agents ({len(agents)} found):")
        for a in agents:
            print(f"   • {a.name:<15} [{a.suggested_role}]: {a.version} ({a.cli_command})")

        # 3. Target config generation
        target_path = output_file or os.path.join(self.workspace_root, "config", "agent_runner_config.json")
        os.makedirs(os.path.dirname(target_path), exist_ok=True)

        cfg = self.generate_preset_config(agents=agents)
        cfg_dict = {
            "server_label": cfg.server_label,
            "poll_seconds": cfg.poll_seconds,
            "langchain_project": cfg.langchain_project,
            "verification": asdict(cfg.verification),
            "guardrails": asdict(cfg.guardrails),
            "projects": [asdict(p) for p in cfg.projects],
            "agents": [asdict(a) for a in cfg.agents],
        }

        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(cfg_dict, f, indent=2)

        print(f"\n✅ 3. Configuration written successfully to:\n   {target_path}")
        print("=" * 70)
        return target_path

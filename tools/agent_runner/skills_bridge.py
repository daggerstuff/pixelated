"""Local and global skills discovery bridge for autonomous agents."""

from __future__ import annotations

import logging
import os
import re

logger = logging.getLogger("agent_runner.skills")


class SkillsBridge:
    """Discovers available skills in project and global directories."""

    def __init__(self, workspace_root: str | None = None):
        self.workspace_root = workspace_root or os.getcwd()
        self.skills_dirs = [
            os.path.join(self.workspace_root, ".agents", "skills"),
            os.path.join(self.workspace_root, ".gemini", "skills"),
            os.path.expanduser("~/.agents/skills"),
            os.path.expanduser("~/.gemini/skills"),
        ]

    def list_available_skills(self) -> list[tuple[str, str, str]]:
        """List all discovered skills as (name, description, path)."""
        discovered: dict[str, tuple[str, str, str]] = {}

        for base_dir in self.skills_dirs:
            if not os.path.exists(base_dir):
                continue

            for root, _, files in os.walk(base_dir):
                for f in files:
                    if f.endswith(("SKILL.md", ".skill.md")):
                        skill_path = os.path.join(root, f)
                        name, desc = self._parse_skill_metadata(skill_path)
                        if name and name not in discovered:
                            discovered[name] = (name, desc, skill_path)

        return list(discovered.values())

    def _parse_skill_metadata(self, skill_file: str) -> tuple[str, str]:
        try:
            with open(skill_file, encoding="utf-8") as fp:
                content = fp.read(1000)
            name_match = re.search(r"name:\s*([^\n]+)", content, re.IGNORECASE)
            desc_match = re.search(r"description:\s*([^\n]+)", content, re.IGNORECASE)

            name = name_match.group(1).strip() if name_match else os.path.basename(os.path.dirname(skill_file))
            desc = desc_match.group(1).strip() if desc_match else "No description provided."
            return name, desc
        except Exception:
            return "", ""

    def find_matching_skills(self, task_description: str) -> list[tuple[str, str]]:
        """Find relevant skills for a given task description."""
        all_skills = self.list_available_skills()
        task_lower = task_description.lower()
        matched: list[tuple[str, str]] = []

        for name, desc, _ in all_skills:
            if name.lower() in task_lower or any(word in task_lower for word in name.lower().split("-")):
                matched.append((name, desc))

        return matched

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
BUILDER_PATH = REPO_ROOT / ".agent" / "scripts" / "build_compressed_index.py"


def load_builder(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    spec = importlib.util.spec_from_file_location(f"build_compressed_index_{tmp_path.name}", BUILDER_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)

    agent_root = tmp_path / ".agent"
    monkeypatch.setattr(module, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(module, "AGENT_ROOT", agent_root)
    monkeypatch.setattr(module, "SKILLS_DIR", agent_root / "skills")
    monkeypatch.setattr(module, "COMPRESSED_INDEX", agent_root / "skills-index-compressed.json")
    monkeypatch.setattr(module, "GLOBAL_SKILLS_DIR", tmp_path / "global-skills")
    monkeypatch.setattr(module, "GLOBAL_RELAY_DIR", tmp_path / "global-relay")
    return module


def test_scan_skills_skips_package_directories_without_skill_markdown(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    module = load_builder(tmp_path, monkeypatch)

    skills_dir = tmp_path / ".agent" / "skills"
    real_skill_dir = skills_dir / "demo-skill"
    real_skill_dir.mkdir(parents=True)
    (real_skill_dir / "SKILL.md").write_text("# Demo Skill\n\nShort description.", encoding="utf-8")

    package_skill_dir = skills_dir / "skills"
    package_skill_dir.mkdir()
    (package_skill_dir / "package.json").write_text('{"name":"skills"}', encoding="utf-8")

    hidden_dir = skills_dir / ".cache"
    hidden_dir.mkdir()

    monkeypatch.setattr(module, "list_global_skill_dirs", list)
    monkeypatch.setattr(module, "list_skill_dirs", lambda: module._iter_skill_dirs(skills_dir))

    skills, totals = module.scan_skills()

    assert list(skills.keys()) == ["demo-skill"]
    assert totals == {"total": 1, "populated": 1, "missing": 0, "errors": 0}

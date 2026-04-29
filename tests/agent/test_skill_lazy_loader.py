from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
LOADER_PATH = REPO_ROOT / ".agent" / "scripts" / "skill_lazy_loader.py"


def load_loader(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, *, path_value: str | None = None):
    agent_root = tmp_path / ".agent"
    skill_dir = agent_root / "skills" / "demo-skill"
    skill_dir.mkdir(parents=True)
    skill_file = skill_dir / "SKILL.md"
    skill_file.write_text("# Demo Skill\n\nInitial content.", encoding="utf-8")

    index = {
        "version": "test",
        "stats": {"total": 1, "populated": 1, "missing": 0, "errors": 0},
        "skills": {
            "demo-skill": {
                "category": "ai",
                "summary": "Demo skill",
                "path": path_value or ".agents/skills/demo-skill/SKILL.md",
                "status": "populated",
            }
        },
    }
    (agent_root / "skills-index-compressed.json").write_text(
        json.dumps(index), encoding="utf-8"
    )

    monkeypatch.setenv("AGENT_ROOT", str(agent_root))

    spec = importlib.util.spec_from_file_location(
        f"skill_lazy_loader_{tmp_path.name}", LOADER_PATH
    )
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module, skill_file


def test_loader_loads_skills_on_demand_and_caches(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    module, skill_file = load_loader(tmp_path, monkeypatch)
    loader = module.get_loader()

    assert loader.list_available_skills() == ["demo-skill"]
    assert loader.get_skill_metadata("demo-skill")["category"] == "ai"
    assert loader.get_skill_handle("demo-skill").metadata["summary"] == "Demo skill"

    first = module.get_skill_content("demo-skill")
    assert first == "# Demo Skill\n\nInitial content."

    skill_file.write_text("# Demo Skill\n\nUpdated content.", encoding="utf-8")
    assert module.get_skill_content("demo-skill") == "# Demo Skill\n\nInitial content."

    loader.clear_cache()
    assert module.get_skill_content("demo-skill") == "# Demo Skill\n\nUpdated content."


def test_loader_ignores_escape_paths_and_uses_canonical_location(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    outside_file = tmp_path.parent / "outside" / "SKILL.md"
    outside_file.parent.mkdir(parents=True)
    outside_file.write_text("# Outside\n\nShould not be used.", encoding="utf-8")

    module, skill_file = load_loader(
        tmp_path,
        monkeypatch,
        path_value=str(outside_file),
    )

    assert module.get_skill_content("demo-skill") == skill_file.read_text(encoding="utf-8")


def test_missing_skill_returns_none_and_handle_raises(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    module, _ = load_loader(tmp_path, monkeypatch)

    assert module.get_skill_content("missing-skill") is None
    assert not module.get_skill_handle("missing-skill")

    handle = module.get_skill_handle("missing-skill")
    with pytest.raises(FileNotFoundError):
        handle.load()

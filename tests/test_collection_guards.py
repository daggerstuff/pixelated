from __future__ import annotations

from pathlib import Path

from tests._collection_guards import INTERNAL_SCRIPTS_DIR, ROOT_OVERRIDE_ENV_VAR, should_ignore_optional_test


def test_missing_optional_agent_script_test_is_ignored(tmp_path: Path) -> None:
    test_path = tmp_path / "tests" / "agent" / "test_skill_lazy_loader.py"
    test_path.parent.mkdir(parents=True)
    test_path.write_text("", encoding="utf-8")

    assert should_ignore_optional_test(test_path, tmp_path) is True


def test_existing_optional_agent_script_test_is_collected(tmp_path: Path) -> None:
    test_path = tmp_path / "tests" / "python" / "test_write_s3cmd_config.py"
    script_path = tmp_path / INTERNAL_SCRIPTS_DIR / "write_s3cmd_config.py"
    test_path.parent.mkdir(parents=True)
    script_path.parent.mkdir(parents=True)
    test_path.write_text("", encoding="utf-8")
    script_path.write_text("", encoding="utf-8")

    assert should_ignore_optional_test(test_path, tmp_path) is False


def test_optional_agent_script_respects_root_override(tmp_path: Path, monkeypatch) -> None:
    repo_root = tmp_path / "repo"
    asset_root = tmp_path / "assets"
    test_path = repo_root / "tests" / "python" / "test_write_s3cmd_config.py"
    script_path = asset_root / INTERNAL_SCRIPTS_DIR / "write_s3cmd_config.py"
    test_path.parent.mkdir(parents=True)
    script_path.parent.mkdir(parents=True)
    test_path.write_text("", encoding="utf-8")
    script_path.write_text("", encoding="utf-8")
    monkeypatch.setenv(ROOT_OVERRIDE_ENV_VAR, str(asset_root))

    assert should_ignore_optional_test(test_path, repo_root) is False


def test_missing_legacy_training_corpus_module_test_is_ignored(tmp_path: Path) -> None:
    test_path = tmp_path / "tests" / "unit" / "ai" / "test_training_corpus_compare.py"
    test_path.parent.mkdir(parents=True)
    test_path.write_text("", encoding="utf-8")

    assert should_ignore_optional_test(test_path, tmp_path) is True


def test_restored_training_corpus_module_test_is_collected(tmp_path: Path) -> None:
    test_path = tmp_path / "tests" / "unit" / "ai" / "test_training_corpus_compare.py"
    module_path = tmp_path / "ai" / "training_corpus" / "compare.py"
    test_path.parent.mkdir(parents=True)
    module_path.parent.mkdir(parents=True)
    test_path.write_text("", encoding="utf-8")
    module_path.write_text("", encoding="utf-8")

    assert should_ignore_optional_test(test_path, tmp_path) is False


def test_partial_training_corpus_restore_keeps_unrestored_tests_ignored(tmp_path: Path) -> None:
    test_path = tmp_path / "tests" / "unit" / "ai" / "test_training_corpus_builder.py"
    restored_module = tmp_path / "ai" / "training_corpus" / "compare.py"
    test_path.parent.mkdir(parents=True)
    restored_module.parent.mkdir(parents=True)
    test_path.write_text("", encoding="utf-8")
    restored_module.write_text("", encoding="utf-8")

    assert should_ignore_optional_test(test_path, tmp_path) is True


def test_unrelated_test_is_collected(tmp_path: Path) -> None:
    test_path = tmp_path / "tests" / "unit" / "test_utilities.py"
    test_path.parent.mkdir(parents=True)
    test_path.write_text("", encoding="utf-8")

    assert should_ignore_optional_test(test_path, tmp_path) is False

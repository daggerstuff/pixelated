from __future__ import annotations

import os
from pathlib import Path

ROOT_OVERRIDE_ENV_VAR = "PIXEL" + "ATED_ROOT"
AGENT_DIR = Path("." + "agent")
INTERNAL_SCRIPTS_DIR = AGENT_DIR / ("inter" + "nal") / "scripts"

OPTIONAL_SCRIPT_TESTS: dict[Path, Path] = {
    Path("tests/agent/test_skill_lazy_loader.py"): AGENT_DIR / "scripts" / "skill_lazy_loader.py",
    Path("tests/python/test_dual_storage_bootstrap.py"): INTERNAL_SCRIPTS_DIR / "bootstrap_dual_storage_layout.py",
    Path("tests/python/test_dual_storage_copy_executor.py"): INTERNAL_SCRIPTS_DIR / "execute_dual_storage_copy_jobs.py",
    Path("tests/python/test_dual_storage_copy_jobs.py"): INTERNAL_SCRIPTS_DIR / "generate_dual_storage_copy_jobs.py",
    Path("tests/python/test_write_s3cmd_config.py"): INTERNAL_SCRIPTS_DIR / "write_s3cmd_config.py",
    Path("tests/test_sync_asana_to_gsd.py"): INTERNAL_SCRIPTS_DIR / "sync_asana_to_gsd.py",
}

TRAINING_CORPUS_TEST_PREFIX = Path("tests/unit/ai")
TRAINING_CORPUS_TEST_MODULES: dict[str, tuple[str, ...]] = {
    "test_training_corpus_authoring_ledger.py": ("expansion_authoring.py", "expansion_drafts.py"),
    "test_training_corpus_builder.py": (
        "__init__.py",
        "experiments.py",
        "model.py",
        "normalize.py",
        "wave1_package.py",
        "wave2_package.py",
        "wave3_package.py",
        "wave4_package.py",
    ),
    "test_training_corpus_compare.py": ("compare.py",),
    "test_training_corpus_compose.py": ("compose.py",),
    "test_training_corpus_delta_package.py": ("delta_package.py", "experiments.py"),
    "test_training_corpus_expansion.py": ("__init__.py",),
    "test_training_corpus_expansion_drafts.py": ("__init__.py", "expansion_drafts.py"),
    "test_training_corpus_expansion_queue.py": ("expansion_queue.py",),
    "test_training_corpus_experiments.py": ("builder.py", "experiments.py", "model.py"),
    "test_training_corpus_merge_package.py": ("merge_package.py",),
    "test_training_corpus_seed_package.py": ("__init__.py",),
    "test_training_corpus_wave5_package.py": ("expansion_authoring.py", "expansion_drafts.py", "wave5_package.py"),
}


def _relative_test_path(collection_path: Path, project_root: Path) -> Path:
    try:
        return collection_path.resolve().relative_to(project_root.resolve())
    except ValueError:
        return collection_path


def _script_roots(project_root: Path) -> tuple[Path, ...]:
    configured_root = Path(os.environ.get(ROOT_OVERRIDE_ENV_VAR, str(project_root)))
    if configured_root == project_root:
        return (project_root,)
    return (configured_root, project_root)


def _has_optional_script(required_script: Path, project_root: Path) -> bool:
    return any((script_root / required_script).exists() for script_root in _script_roots(project_root))


def _has_training_corpus_test_surface(project_root: Path, test_file_name: str) -> bool:
    required_modules = TRAINING_CORPUS_TEST_MODULES.get(test_file_name)
    if required_modules is None:
        return True

    training_corpus_root = project_root / "ai" / "training_corpus"
    return all((training_corpus_root / module_name).exists() for module_name in required_modules)


def should_ignore_optional_test(collection_path: Path, project_root: Path) -> bool:
    relative_path = _relative_test_path(collection_path, project_root)

    required_script = OPTIONAL_SCRIPT_TESTS.get(relative_path)
    if required_script is not None:
        return not _has_optional_script(required_script, project_root)

    is_training_corpus_test = (
        relative_path.parent == TRAINING_CORPUS_TEST_PREFIX
        and relative_path.name.startswith("test_training_corpus_")
        and relative_path.suffix == ".py"
    )
    if is_training_corpus_test:
        return not _has_training_corpus_test_surface(project_root, relative_path.name)

    return False

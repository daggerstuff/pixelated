from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent


def test_hackathon_module_entrypoints_run_from_repo_root() -> None:
    commands = (
        ("hackathon.monthly_llm_jobs", "--help"),
        ("hackathon.monthly_auditor", "--help"),
    )

    for module_name, arg in commands:
        result = subprocess.run(
            [sys.executable, "-m", module_name, arg],
            capture_output=True,
            check=False,
            cwd=REPO_ROOT,
            text=True,
        )

        assert result.returncode == 0, (
            f"{module_name} should run from repo root.\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )


def test_colab_run_month_script_imports_from_repo_root() -> None:
    result = subprocess.run(
        [sys.executable, "hackathon/colab_run_month.py"],
        capture_output=True,
        check=False,
        cwd=REPO_ROOT,
        text=True,
    )

    assert result.returncode == 1, (
        "colab_run_month.py should fail on missing month argument, not on package imports.\n"
        f"stdout:\n{result.stdout}\n"
        f"stderr:\n{result.stderr}"
    )
    assert "Usage: colab_run_month.py <YYYY-MM>" in result.stderr

"""Run the repo's offline test suite in a clean Modal container.

    uv run modal run -m infra.modal.apps.test_suite
    uv run modal run -m infra.modal.apps.test_suite --paths tests/infra --pytest-args "-x -q"

This is the "testing" option target: the same suite CI runs, executed on a
machine with no local venv, no checkout and no Modal credentials — only the
sources baked into the image. Cheap CPU, no GPU and no secrets.

The image carries `infra/`, `tests/infra/` and `pyproject.toml`. Point `--paths`
at anything else inside those trees; to test a different directory, add it to
the image below.
"""

from __future__ import annotations

import logging
import shlex
from pathlib import Path
from typing import Any, cast

import modal
from infra.modal.shared.gpu import app_name
from infra.modal.shared.paths import REPO_DIR

APP_NAME = app_name("test")

REPO_ROOT = Path(__file__).resolve().parents[3]

image = (
    modal.Image.debian_slim(python_version="3.12")
    .uv_pip_install("pytest>=8", "pytest-asyncio>=0.24", "modal>=1.6.4")
    .add_local_dir(str(REPO_ROOT / "infra"), f"{REPO_DIR}/infra", ignore=["**/__pycache__/**"])
    .add_local_dir(str(REPO_ROOT / "tests" / "infra"), f"{REPO_DIR}/tests/infra")
    .add_local_file(str(REPO_ROOT / "pyproject.toml"), f"{REPO_DIR}/pyproject.toml")
)

app = modal.App(APP_NAME)

logger = logging.getLogger(__name__)


def _tail(text: str, limit: int = 80) -> str:
    """Return the last `limit` lines, so a long pytest log still fits the result."""
    lines = text.rstrip().splitlines()
    return "\n".join(lines[-limit:])


def pytest_command(paths: list[str], extra: list[str]) -> list[str]:
    """Build the pytest invocation used inside the container."""
    return ["-m", "pytest", *paths, "-q", "-p", "no:cacheprovider", *extra]


@app.function(image=image, timeout=1800)
def run_suite(paths: list[str], extra: list[str]) -> dict[str, Any]:
    """Run pytest inside the container and return its tail plus the exit code."""
    import subprocess
    import sys

    command = [sys.executable, *pytest_command(paths, extra)]
    completed = subprocess.run(
        command,
        cwd=REPO_DIR,
        capture_output=True,
        text=True,
        check=False,
    )
    return {
        "command": " ".join(command),
        "returncode": completed.returncode,
        "stdout": _tail(completed.stdout),
        "stderr": _tail(completed.stderr),
    }


@app.local_entrypoint()
def main(paths: str = "tests/infra", pytest_args: str = "") -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    selected = [part.strip() for part in paths.split(",") if part.strip()]
    if not selected:
        raise SystemExit("nothing to test: pass --paths with one or more test paths")

    result = run_suite.remote(selected, shlex.split(pytest_args))
    logger.info("$ %s", result["command"])
    logger.info("%s", result["stdout"])
    if result["stderr"]:
        logger.warning("%s", result["stderr"])

    returncode = cast(int, result["returncode"])
    if returncode != 0:
        raise SystemExit(f"pytest failed inside the container (exit {returncode})")
    logger.info("suite passed in a clean container")

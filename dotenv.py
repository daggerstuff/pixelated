"""Tiny dotenv compatibility shim.

Loads key-value pairs from a ``.env`` file when ``python-dotenv`` is unavailable.
"""

from __future__ import annotations

import os
import re
from pathlib import Path


def _load_dotenv_lines(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        if not key:
            continue
        values[key] = value
    return values


def dotenv_values(
    dotenv_path: str | Path | None = None,
    *,
    encoding: str = "utf-8",
    interpolate: bool = True,
    verbose: bool | None = None,
) -> dict[str, str]:
    """Return environment variables from a `.env` file as a dictionary."""
    if dotenv_path is None:
        dotenv_path = Path(".env")
    else:
        dotenv_path = Path(dotenv_path)

    env_path = dotenv_path.expanduser()
    if not env_path.exists():
        return {}

    values = _load_dotenv_lines(env_path)
    if not interpolate:
        return values

    # Basic variable interpolation: ${VAR} and $VAR
    pattern = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)")
    interpolated: dict[str, str] = {}
    for key, value in values.items():
        out = value
        changed = True
        while changed:
            new_out = pattern.sub(
                lambda m: os.environ.get(m.group(1) or m.group(2), ""),
                out,
            )
            changed = new_out != out
            out = new_out
        interpolated[key] = out
    return interpolated


def find_dotenv(
    filename: str = ".env",
    *,
    raise_error_if_not_found: bool = False,
) -> str:
    candidate = Path(filename).expanduser()
    if candidate.exists():
        return str(candidate)
    if raise_error_if_not_found:
        raise FileNotFoundError(filename)
    return ""


def load_dotenv(
    dotenv_path: str | Path | None = None,
    *_,  # ignore legacy positional flags for compatibility
    verbose: bool = False,
    override: bool = False,
    **__,
) -> bool:
    if dotenv_path is None:
        env_path = Path(find_dotenv(".env") or ".env")
    else:
        env_path = Path(dotenv_path).expanduser()

    _ = verbose
    # Dependency-free fallback for environments without `python-dotenv`.
    if not env_path.exists():
        return False

    values = _load_dotenv_lines(env_path)
    updated = False
    for key, value in values.items():
        if key and (override or key not in os.environ):
            os.environ[key] = value
            updated = True
    return updated


__all__ = [
    "dotenv_values",
    "find_dotenv",
    "load_dotenv",
]

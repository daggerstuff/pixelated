#!/usr/bin/env python3
"""Compatibility shim for legacy ui-ux-pro-max search path."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[3]
TARGETS = [
    ROOT_DIR / ".agents" / "skills" / "ui-ux-pro-max" / "scripts" / "search.py",
    ROOT_DIR / ".claude" / "skills" / "ui-ux-pro-max" / "scripts" / "search.py",
]


def main() -> int:
    target = next((candidate for candidate in TARGETS if candidate.is_file()), None)
    if target is None:
        print("Error: ui-ux-pro-max search backend script not found.", file=sys.stderr)
        return 1

    cmd = [sys.executable, str(target), *sys.argv[1:]]
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Build standalone skillreducer binary with PyInstaller."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parent
    spec = root / "skillreducer.spec"
    dist = root / "dist"
    build = root / "build"

    print("Building skillreducer binary...")
    subprocess.run(
        [sys.executable, "-m", "PyInstaller", "--clean", "--noconfirm", str(spec)],
        check=True,
        cwd=root,
    )

    binary = dist / ("skillreducer.exe" if sys.platform == "win32" else "skillreducer")
    if binary.exists():
        print(f"\nBinary ready: {binary}")
        print("\nUsage:")
        print(f"  {binary} audit path/to/skill")
        print(f"  {binary} agent path/to/skill")
    else:
        print("Build finished but binary not found at expected path.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

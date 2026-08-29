#!/usr/bin/env python3
"""Standalone script entrypoint for Linear Multi-Agent Coordination Runner."""

import importlib
import os
import sys

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)


def main() -> int:
    mod = importlib.import_module("tools.agent_runner.cli")
    return int(mod.main())


if __name__ == "__main__":
    sys.exit(main())

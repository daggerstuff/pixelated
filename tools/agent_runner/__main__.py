"""Executable module entrypoint for python -m tools.agent_runner."""

import sys

from tools.agent_runner.cli import main

if __name__ == "__main__":
    sys.exit(main())

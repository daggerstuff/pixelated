"""Test configuration to ensure local packages resolve during isolated runs."""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
project_root_str = str(PROJECT_ROOT)

# Ensure project root is first on sys.path so local packages win over similarly named site-packages
if project_root_str not in sys.path:
    sys.path.insert(0, project_root_str)

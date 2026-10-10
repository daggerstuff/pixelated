"""Test configuration and environment bootstrapping."""

from __future__ import annotations

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT_STR = str(PROJECT_ROOT)
# The `src` Python package (apps/web/src) is imported by tests under tests/pe
# and tests/video_emotion; it only resolves when apps/web is on sys.path.
APPS_WEB_STR = str(PROJECT_ROOT / "apps" / "web")

if PROJECT_ROOT_STR not in sys.path:
    sys.path.insert(0, PROJECT_ROOT_STR)
if APPS_WEB_STR not in sys.path:
    sys.path.insert(0, APPS_WEB_STR)


# In CI and local test runs we keep expensive local ML/model stacks disabled by default.
os.environ.setdefault("AI_DISABLE_SAFETY_ML_MODELS", "1")
os.environ.setdefault("BIAS_DETECTION_DISABLE_LOCAL_ML_SERVICES", "1")
os.environ.setdefault("BIAS_DETECTION_DISABLE_SENTRY", "1")

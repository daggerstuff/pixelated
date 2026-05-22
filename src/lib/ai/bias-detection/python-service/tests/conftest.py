"""Pytest configuration for bias-detection service tests."""

import os

os.environ.setdefault("BIAS_DETECTION_DISABLE_SENTRY", "1")
os.environ.setdefault("BIAS_DETECTION_DISABLE_LOCAL_ML_SERVICES", "1")
os.environ.setdefault("AI_DISABLE_SAFETY_ML_MODELS", "1")

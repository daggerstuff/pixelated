#!/usr/bin/env python3
"""
Startup script for the Pixelated Empathy Bias Detection Service

This script provides a WSGI entry point for Gunicorn to run the Flask service.
It simply imports and re-exports the Flask app from the python-service module.
"""

import os
import sys

# Add python-service directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
python_service_dir = os.path.join(current_dir, "python-service")
sys.path.insert(0, python_service_dir)

# Import the Flask app from the bias detection service
from bias_detection_service import app

# The app is now available for Gunicorn
__all__ = ["app"]

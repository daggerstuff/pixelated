"""
Bias Detection Service - AI-powered bias detection with TensorFlow/PyTorch integration
"""

__version__ = "1.0.0"
__author__ = "Pixelated Team"
__email__ = "team@pixelatedempathy.com"

from .app import create_app
from .config import Settings
from .models import BiasAnalysisRequest, BiasAnalysisResponse
from .services import BiasDetectionService

__all__ = [
    "Settings",
    "BiasAnalysisRequest",
    "BiasAnalysisResponse",
    "BiasDetectionService",
    "create_app",
]

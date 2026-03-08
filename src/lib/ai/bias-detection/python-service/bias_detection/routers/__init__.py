"""
API route modules.
"""

from .health import router as health_router
from .bias_analysis import router as bias_analysis_router
from .analytics import router as analytics_router
from .models_info import router as models_router
from .errors import router as errors_router

__all__ = [
    "health_router",
    "bias_analysis_router",
    "analytics_router",
    "models_router",
    "errors_router",
]

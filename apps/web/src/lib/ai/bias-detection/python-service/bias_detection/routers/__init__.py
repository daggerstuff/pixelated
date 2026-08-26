"""
API route modules.
"""

from .analytics import router as analytics_router
from .bias_analysis import router as bias_analysis_router
from .errors import router as errors_router
from .health import router as health_router
from .models_info import router as models_router

__all__ = [
    "analytics_router",
    "bias_analysis_router",
    "errors_router",
    "health_router",
    "models_router",
]

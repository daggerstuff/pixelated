"""
MCP Server Routers Package

This package contains all API routers for the MCP server following
the Pixelated platform's established patterns.
"""

from .agents import router as agents_router
from .tasks import router as tasks_router
from .pipelines import router as pipelines_router
from .health import router as health_router
from .discovery import router as discovery_router

__all__ = [
    "agents_router",
    "tasks_router", 
    "pipelines_router",
    "health_router",
    "discovery_router"
]
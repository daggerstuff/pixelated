"""
MCP Server - Management Control Panel for AI Agent Orchestration

This package provides the core functionality for managing AI agents,
task delegation, and pipeline orchestration for the Pixelated platform.
"""

__version__ = "1.0.0"
__author__ = "Pixelated Team"
__email__ = "team@pixelatedempathy.com"

from .app_factory import create_mcp_app
from .config import MCPConfig

__all__ = ["create_mcp_app", "MCPConfig"]
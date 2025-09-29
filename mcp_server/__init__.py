"""
MCP Server - Management Control Panel for AI Agent Orchestration

This package provides the core functionality for managing AI agents,
task delegation, and pipeline orchestration for the Pixelated platform.
"""

__version__ = "1.0.0"
__author__ = "Pixelated Team"
__email__ = "team@pixelatedempathy.com"
__all__ = []


def create_mcp_app(*args, **kwargs):
	"""Lazily import and call the real create_mcp_app from app_factory.

	This avoids importing heavy optional dependencies during test collection.
	"""
	from .app_factory import create_mcp_app as _create
	return _create(*args, **kwargs)


def get_MCPConfig():
	from .config import MCPConfig
	return MCPConfig

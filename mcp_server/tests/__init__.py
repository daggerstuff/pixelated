"""Test package marker for mcp_server.tests

This file makes the `tests` directory a package so tests can use
relative imports like `from ..models.dataset import ...` during pytest
collection when running from the repository root.
"""

__all__ = []

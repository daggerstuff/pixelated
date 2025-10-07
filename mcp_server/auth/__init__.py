"""Compatibility package for auth dependencies.

Some modules import from `mcp_server.auth.dependencies`. Provide a thin
package that forwards to the middleware-based implementations to avoid
rewriting many imports in tests and routers.
"""

from . import dependencies

__all__ = ["dependencies"]

"""Auth dependency shims expected by older import paths.

This module re-exports the auth dependency helpers from
`mcp_server.middleware.auth` so code importing
`mcp_server.auth.dependencies` continues to work.
"""

from mcp_server.middleware.auth import (
    AuthMiddleware,
    RateLimitMiddleware,
    create_auth_dependency,
    get_current_agent,
    get_optional_current_agent,
    require_active_admin_auth,
    require_active_agent,
    require_active_auth,
    require_admin_agent,
    require_admin_auth,
    require_auth,
    validate_api_key,
)

__all__ = [
    "AuthMiddleware",
    "RateLimitMiddleware",
    "create_auth_dependency",
    "get_current_agent",
    "get_optional_current_agent",
    "require_active_admin_auth",
    "require_active_agent",
    "require_active_auth",
    "require_admin_agent",
    "require_admin_auth",
    "require_auth",
    "validate_api_key",
]

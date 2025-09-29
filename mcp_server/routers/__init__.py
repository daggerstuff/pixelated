"""mcp_server.routers package.

This package intentionally avoids importing submodules at package import
time to keep test collection and lightweight imports safe. Import the
individual router modules directly (for example ``from
mcp_server.routers.websocket import router``).
"""

# No eager imports here; submodules are imported on demand by consumers.
__all__ = []

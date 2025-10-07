"""
MCP Server Main Entry Point

Main application entry point for the MCP server following the
established patterns from the Pixelated platform.
"""

import asyncio
import os
import signal
import sys
from contextlib import asynccontextmanager
from typing import Optional

import structlog
import uvicorn
from fastapi import FastAPI

from .app_factory import create_mcp_app
from .config import get_config, MCPConfig

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)


class MCPServer:
    """MCP Server application runner."""
    
    def __init__(self, config: Optional[MCPConfig] = None) -> None:
        """
        Initialize MCP server.
        
        Args:
            config: MCPConfig instance. If None, uses get_config()
        """
        self.config = config or get_config()
        self.app: Optional[FastAPI] = None
        self.server: Optional[uvicorn.Server] = None
        
    def create_app(self) -> FastAPI:
        """
        Create FastAPI application.
        
        Returns:
            FastAPI: Configured FastAPI application
        """
        logger.info("Creating MCP server application")
        self.app = create_mcp_app(self.config)
        return self.app
    
    async def run(self, host: str = "0.0.0.0", port: int = 8080) -> None:
        """
        Run the MCP server.
        
        Args:
            host: Host to bind to
            port: Port to bind to
        """
        logger.info(
            "Starting MCP server",
            host=host,
            port=port,
            environment=self.config.environment,
            version=self.config.api_version
        )
        
        # Create application if not already created
        if not self.app:
            self.create_app()
        
        # Configure Uvicorn
        config = uvicorn.Config(
            self.app,
            host=host,
            port=port,
            log_level=self.config.logging_config.level.lower(),
            access_log=self.config.logging_config.enable_request_logging,
            loop="uvloop" if hasattr(asyncio, "uvloop") else "asyncio",
            lifespan="on"
        )
        
        self.server = uvicorn.Server(config)
        
        # Setup signal handlers for graceful shutdown
        def signal_handler(signum: int, frame) -> None:
            logger.info(f"Received signal {signum}, shutting down gracefully")
            if self.server:
                self.server.should_exit = True
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        try:
            # Run the server
            await self.server.serve()
        except KeyboardInterrupt:
            logger.info("Server interrupted by user")
        except Exception as e:
            logger.error("Server error", error=str(e), error_type=type(e).__name__)
            raise
        finally:
            logger.info("MCP server stopped")
    
    def run_sync(self, host: str = "0.0.0.0", port: int = 8080) -> None:
        """
        Run the MCP server synchronously.
        
        Args:
            host: Host to bind to
            port: Port to bind to
        """
        asyncio.run(self.run(host, port))


def main() -> None:
    """Main entry point."""
    try:
        # Get configuration
        config = get_config()
        
        # Create and run server
        server = MCPServer(config)
        
        # Get host and port from environment or use defaults
        host = os.getenv("MCP_HOST", "0.0.0.0")
        port = int(os.getenv("MCP_PORT", "8080"))
        
        # Run server
        server.run_sync(host, port)
        
    except KeyboardInterrupt:
        logger.info("Server interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error("Fatal server error", error=str(e), error_type=type(e).__name__)
        sys.exit(1)


if __name__ == "__main__":
    main()
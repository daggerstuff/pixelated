"""
MCP Server Application Factory

Creates and configures FastAPI application instances with proper middleware,
routers, and error handling following the established patterns from the
Pixelated platform.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from redis.asyncio import Redis

from .config import MCPConfig, get_config
from .middleware.auth import AuthenticationMiddleware
from .middleware.rate_limit import RateLimitMiddleware
from .middleware.logging import LoggingMiddleware
from .middleware.request_id import RequestIDMiddleware
from .routers.agents import router as agents_router
from .routers.tasks import router as tasks_router
from .routers.pipelines import router as pipelines_router
from .routers.health import router as health_router
from .routers.websocket import router as websocket_router
from .services.auth import init_auth_service
from .services.database import DatabaseManager
from .services.redis_manager import RedisManager
from .services.audit_logger import AuditLogger
from .services.metrics_collector import MetricsCollector
from .services.websocket_manager import WebSocketManager
from .services.websocket_asgi import SocketIOEventHandlers, create_websocket_middleware
from .services.token_manager import init_token_manager
from .services.security_lockdown import init_security_lockdown_manager
from .exceptions import (
    MCPException,
    AuthenticationError,
    AuthorizationError,
    ValidationError,
    NotFoundError,
    ConflictError,
    RateLimitExceededError,
    ServiceUnavailableError
)

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Handle application lifecycle events.
    
    Preconditions:
    - Configuration must be loaded
    - Environment variables must be set
    
    Postconditions:
    - Database connection pool is created
    - Redis connection is established
    - Service dependencies are initialized
    - All connections are properly closed on shutdown
    """
    config = get_config()
    
    try:
        # Initialize database connection
        logger.info("Initializing database connection")
        app.state.db_client = AsyncIOMotorClient(
            config.database_config.uri,
            maxPoolSize=config.database_config.max_pool_size,
            minPoolSize=config.database_config.min_pool_size,
            serverSelectionTimeoutMS=config.database_config.timeout * 1000
        )
        app.state.database = app.state.db_client.get_database()
        
        # Initialize Redis connection
        logger.info("Initializing Redis connection")
        app.state.redis_client = Redis.from_url(
            config.redis_config.url,
            max_connections=config.redis_config.max_connections,
            socket_timeout=config.redis_config.socket_timeout,
            socket_connect_timeout=config.redis_config.socket_connect_timeout,
            decode_responses=True
        )
        
        # Test connections
        await _test_connections(app)
        
        # Initialize service managers
        logger.info("Initializing service managers")
        app.state.db_manager = DatabaseManager(app.state.database)
        app.state.redis_manager = RedisManager(app.state.redis_client)
        app.state.audit_logger = AuditLogger(config.audit_config)
        app.state.metrics_collector = MetricsCollector()
        
        # Initialize auth service
        auth_service = init_auth_service(app.state.database, app.state.redis_client)
        app.state.auth_service = auth_service
        logger.info("Auth service initialized")
        
        # Initialize token manager
        token_manager = init_token_manager(app.state.redis_client)
        app.state.token_manager = token_manager
        logger.info("Token manager initialized")
        
        # Initialize security lockdown manager
        security_lockdown_manager = init_security_lockdown_manager(app.state.redis_client, auth_service)
        app.state.security_lockdown_manager = security_lockdown_manager
        logger.info("Security lockdown manager initialized")
        
        # Initialize WebSocket manager if enabled
        if config.websocket_config.enabled:
            logger.info("Initializing WebSocket manager")
            websocket_manager = WebSocketManager(config, app.state.database, app.state.redis_client)
            await websocket_manager.initialize()
            app.state.websocket_manager = websocket_manager
            
            # Register Socket.IO event handlers
            event_handlers = SocketIOEventHandlers(websocket_manager)
            event_handlers.register_handlers()
            
            logger.info("WebSocket manager initialized successfully")
        else:
            logger.info("WebSocket support disabled")
            app.state.websocket_manager = None
        
        # Initialize service registry
        logger.info("Initializing service registry")
        app.state.service_registry = {}
        
        logger.info("MCP Server startup completed successfully")
        
        yield
        
    except Exception as e:
        logger.error("Failed to initialize MCP server", error=str(e))
        raise
    finally:
        # Cleanup resources
        logger.info("Shutting down MCP server")
        
        # Close database connection
        if hasattr(app.state, 'db_client'):
            app.state.db_client.close()
            logger.info("Database connection closed")
        
        # Close Redis connection
        if hasattr(app.state, 'redis_client'):
            await app.state.redis_client.close()
            logger.info("Redis connection closed")
        
        # Shutdown WebSocket manager
        if hasattr(app.state, 'websocket_manager') and app.state.websocket_manager:
            logger.info("Shutting down WebSocket manager")
            await app.state.websocket_manager.shutdown()
            logger.info("WebSocket manager shutdown completed")
        
        logger.info("MCP Server shutdown completed successfully")


async def _test_connections(app: FastAPI) -> None:
    """
    Test database and Redis connections.
    
    Raises:
        ServiceUnavailableError: If connections fail
    """
    try:
        # Test database connection
        await app.state.database.command("ping")
        logger.info("Database connection test successful")
    except Exception as e:
        logger.error("Database connection test failed", error=str(e))
        raise ServiceUnavailableError("Database connection failed") from e
    
    try:
        # Test Redis connection
        await app.state.redis_client.ping()
        logger.info("Redis connection test successful")
    except Exception as e:
        logger.error("Redis connection test failed", error=str(e))
        raise ServiceUnavailableError("Redis connection failed") from e


def create_mcp_app(config: Optional[MCPConfig] = None) -> FastAPI:
    """
    Create and configure MCP server FastAPI application.
    
    Preconditions:
    - config must be valid MCPConfig instance
    - Database connections must be available
    - Redis connection must be available
    
    Postconditions:
    - FastAPI app is properly configured
    - All middleware is initialized
    - All routers are registered
    - Exception handlers are configured
    
    Args:
        config: MCPConfig instance. If None, uses get_config()
        
    Returns:
        FastAPI: Configured FastAPI application
        
    Raises:
        ValueError: If configuration is invalid
        ServiceUnavailableError: If required services are unavailable
    """
    if config is None:
        config = get_config()
    
    # Create FastAPI application
    app = FastAPI(
        title="MCP Server",
        version=config.api_version,
        description="Management Control Panel for AI Agent Orchestration",
        docs_url="/docs" if config.enable_docs else None,
        redoc_url="/redoc" if config.enable_redoc else None,
        openapi_url="/openapi.json" if config.enable_openapi else None,
        lifespan=lifespan
    )
    
    # Configure CORS middleware
    if config.cors_enabled:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=config.allowed_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allow_headers=["*"],
            expose_headers=["X-Request-ID", "X-Rate-Limit-Remaining", "X-Rate-Limit-Reset"]
        )
    
    # Add request ID middleware for tracing
    app.add_middleware(RequestIDMiddleware, header_name=config.request_id_header)
    
    # Add rate limiting middleware
    app.add_middleware(RateLimitMiddleware, config.rate_limit_config)
    
    # Add authentication middleware
    app.add_middleware(AuthenticationMiddleware, config.auth_config)
    
    # Add logging middleware
    app.add_middleware(LoggingMiddleware, config.logging_config)
    
    # Add exception handlers
    app.add_exception_handler(MCPException, mcp_exception_handler)
    app.add_exception_handler(AuthenticationError, authentication_exception_handler)
    app.add_exception_handler(AuthorizationError, authorization_exception_handler)
    app.add_exception_handler(ValidationError, validation_exception_handler)
    app.add_exception_handler(NotFoundError, not_found_exception_handler)
    app.add_exception_handler(ConflictError, conflict_exception_handler)
    app.add_exception_handler(RateLimitExceededError, rate_limit_exception_handler)
    app.add_exception_handler(ServiceUnavailableError, service_unavailable_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)
    
    # Include API routers with proper prefixes
    app.include_router(
        health_router,
        prefix="/api/v1/health",
        tags=["health"]
    )
    
    app.include_router(
        agents_router,
        prefix="/api/v1/agents",
        tags=["agents"]
    )
    
    app.include_router(
        tasks_router,
        prefix="/api/v1/tasks",
        tags=["tasks"]
    )
    
    app.include_router(
        pipelines_router,
        prefix="/api/v1/pipelines",
        tags=["pipelines"]
    )
    

    
    # Include WebSocket router
    app.include_router(
        websocket_router,
        prefix="/api/v1/websocket",
        tags=["websocket"]
    )
    
    # Add root endpoint
    @app.get("/")
    async def root():
        """Root endpoint providing basic API information."""
        return {
            "name": "MCP Server",
            "version": config.api_version,
            "description": "Management Control Panel for AI Agent Orchestration",
            "status": "operational",
            "environment": config.environment
        }
    
    # Add health check endpoint
    @app.get("/health")
    async def health_check():
        """Basic health check endpoint."""
        return {"status": "healthy", "service": "mcp-server"}
    
    return app


# Exception handlers
async def mcp_exception_handler(request: Request, exc: MCPException) -> JSONResponse:
    """Handle MCP-specific exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "details": exc.details
            }
        },
        headers=exc.headers
    )


async def authentication_exception_handler(request: Request, exc: AuthenticationError) -> JSONResponse:
    """Handle authentication errors."""
    return JSONResponse(
        status_code=401,
        content={
            "error": {
                "code": "AUTHENTICATION_FAILED",
                "message": str(exc)
            }
        }
    )


async def authorization_exception_handler(request: Request, exc: AuthorizationError) -> JSONResponse:
    """Handle authorization errors."""
    return JSONResponse(
        status_code=403,
        content={
            "error": {
                "code": "AUTHORIZATION_FAILED",
                "message": str(exc)
            }
        }
    )


async def validation_exception_handler(request: Request, exc: ValidationError) -> JSONResponse:
    """Handle validation errors."""
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Validation failed",
                "details": str(exc)
            }
        }
    )


async def not_found_exception_handler(request: Request, exc: NotFoundError) -> JSONResponse:
    """Handle not found errors."""
    return JSONResponse(
        status_code=404,
        content={
            "error": {
                "code": "NOT_FOUND",
                "message": str(exc)
            }
        }
    )


async def conflict_exception_handler(request: Request, exc: ConflictError) -> JSONResponse:
    """Handle conflict errors."""
    return JSONResponse(
        status_code=409,
        content={
            "error": {
                "code": "CONFLICT",
                "message": str(exc)
            }
        }
    )


async def rate_limit_exception_handler(request: Request, exc: RateLimitExceededError) -> JSONResponse:
    """Handle rate limit exceeded errors."""
    return JSONResponse(
        status_code=429,
        content={
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": str(exc)
            }
        },
        headers={
            "Retry-After": str(exc.retry_after) if hasattr(exc, 'retry_after') else "60"
        }
    )


async def service_unavailable_exception_handler(request: Request, exc: ServiceUnavailableError) -> JSONResponse:
    """Handle service unavailable errors."""
    return JSONResponse(
        status_code=503,
        content={
            "error": {
                "code": "SERVICE_UNAVAILABLE",
                "message": str(exc)
            }
        }
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions."""
    logger.error(
        "Unhandled exception",
        error=str(exc),
        error_type=type(exc).__name__,
        request_id=getattr(request.state, 'request_id', 'unknown')
    )
    
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An internal server error occurred"
            }
        }
    )
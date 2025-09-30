# Phase 03: MCP Server FastAPI Application Structure

## Overview

This document provides modular pseudocode for the FastAPI application structure, including the main application setup, middleware configuration, router organization, and core service components with comprehensive TDD anchors.

## Main Application Structure

### 1. Application Factory Pattern

```python
# mcp_server/app_factory.py
"""
MCP Server Application Factory
Creates and configures FastAPI application instances
"""

// TEST: Create app factory with valid configuration
// INPUT: Valid configuration dictionary
// EXPECTED: FastAPI app instance with proper middleware and routers
function create_mcp_app(config: MCPConfig) -> FastAPI:
    """
    Create and configure MCP server FastAPI application
    
    Preconditions:
    - config must be valid MCPConfig instance
    - Database connections must be available
    - Redis connection must be available
    
    Postconditions:
    - FastAPI app is properly configured
    - All middleware is initialized
    - All routers are registered
    - Exception handlers are configured
    """
    
    // TEST: Initialize FastAPI with correct settings
    app = FastAPI(
        title="MCP Server",
        version=config.api_version,
        description="Management Control Panel for AI Agent Orchestration",
        docs_url="/docs" if config.enable_docs else None,
        redoc_url="/redoc" if config.enable_redoc else None,
        openapi_url="/openapi.json" if config.enable_openapi else None
    )
    
    // TEST: Configure CORS middleware with allowed origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Rate-Limit-Remaining"]
    )
    
    // TEST: Add request ID middleware for tracing
    app.add_middleware(RequestIDMiddleware)
    
    // TEST: Add rate limiting middleware per client
    app.add_middleware(RateLimitMiddleware, config.rate_limit_config)
    
    // TEST: Add authentication middleware
    app.add_middleware(AuthenticationMiddleware, config.auth_config)
    
    // TEST: Add logging middleware with structured logging
    app.add_middleware(LoggingMiddleware, config.logging_config)
    
    // TEST: Add error handling middleware
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)
    
    // TEST: Include API routers with proper prefixes
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
    
    app.include_router(
        health_router,
        prefix="/api/v1/health",
        tags=["health"]
    )
    
    app.include_router(
        discovery_router,
        prefix="/api/v1/discovery",
        tags=["discovery"]
    )
    
    // TEST: Add startup and shutdown event handlers
    app.add_event_handler("startup", startup_event_handler)
    app.add_event_handler("shutdown", shutdown_event_handler)
    
    return app


// TEST: Startup event handler initializes connections
// INPUT: FastAPI application instance
// EXPECTED: Database and Redis connections established
async function startup_event_handler(app: FastAPI) -> None:
    """
    Handle application startup events
    
    Preconditions:
    - Configuration must be loaded
    - Environment variables must be set
    
    Postconditions:
    - Database connection pool is created
    - Redis connection is established
    - Service dependencies are initialized
    """
    
    // TEST: Initialize database connection pool
    app.state.db_pool = await create_database_pool(config.database_config)
    
    // TEST: Initialize Redis connection
    app.state.redis_client = await create_redis_client(config.redis_config)
    
    // TEST: Initialize service registry
    app.state.service_registry = ServiceRegistry()
    
    // TEST: Initialize metrics collection
    app.state.metrics_collector = MetricsCollector()
    
    // TEST: Initialize audit logger
    app.state.audit_logger = AuditLogger(config.audit_config)
    
    // TEST: Validate external service connections
    await validate_external_services(config.external_services)
    
    logger.info("MCP Server startup completed successfully")


// TEST: Shutdown event handler cleans up resources
// INPUT: FastAPI application instance
// EXPECTED: All connections closed gracefully
async function shutdown_event_handler(app: FastAPI) -> None:
    """
    Handle application shutdown events
    
    Preconditions:
    - Application is running
    - Resources are allocated
    
    Postconditions:
    - Database connections are closed
    - Redis connections are closed
    - Background tasks are cancelled
    """
    
    // TEST: Close database connections
    if hasattr(app.state, 'db_pool'):
        await app.state.db_pool.close()
    
    // TEST: Close Redis connections
    if hasattr(app.state, 'redis_client'):
        await app.state.redis_client.close()
    
    // TEST: Shutdown service registry
    if hasattr(app.state, 'service_registry'):
        await app.state.service_registry.shutdown()
    
    logger.info("MCP Server shutdown completed successfully")
```

### 2. Configuration Management

```python
# mcp_server/config.py
"""
MCP Server Configuration Management
Handles environment-based configuration with validation
"""

// TEST: Load configuration from environment variables
// INPUT: Environment variables set
// EXPECTED: Valid MCPConfig instance with all required fields
class MCPConfig:
    """
    MCP Server configuration container
    
    Validates configuration values and provides type safety
    """
    
    def __init__(self, env_vars: Dict[str, str]):
        // TEST: Validate required environment variables
        required_vars = [
            'MONGODB_URI',
            'REDIS_URL',
            'JWT_SECRET',
            'API_VERSION'
        ]
        
        for var in required_vars:
            if var not in env_vars:
                raise ConfigurationError(f"Missing required environment variable: {var}")
        
        // TEST: Parse and validate database configuration
        self.database_config = DatabaseConfig(
            uri=env_vars['MONGODB_URI'],
            max_pool_size=int(env_vars.get('DB_MAX_POOL_SIZE', '100')),
            min_pool_size=int(env_vars.get('DB_MIN_POOL_SIZE', '10')),
            timeout=int(env_vars.get('DB_TIMEOUT', '30'))
        )
        
        // TEST: Parse and validate Redis configuration
        self.redis_config = RedisConfig(
            url=env_vars['REDIS_URL'],
            max_connections=int(env_vars.get('REDIS_MAX_CONNECTIONS', '100')),
            socket_timeout=int(env_vars.get('REDIS_SOCKET_TIMEOUT', '30')),
            socket_connect_timeout=int(env_vars.get('REDIS_CONNECT_TIMEOUT', '10'))
        )
        
        // TEST: Parse and validate authentication configuration
        self.auth_config = AuthConfig(
            jwt_secret=env_vars['JWT_SECRET'],
            jwt_algorithm=env_vars.get('JWT_ALGORITHM', 'HS256'),
            token_expiration=int(env_vars.get('TOKEN_EXPIRATION', '3600')),
            refresh_token_expiration=int(env_vars.get('REFRESH_TOKEN_EXPIRATION', '86400'))
        )
        
        // TEST: Parse and validate rate limiting configuration
        self.rate_limit_config = RateLimitConfig(
            requests_per_minute=int(env_vars.get('RATE_LIMIT_RPM', '100')),
            burst_size=int(env_vars.get('RATE_LIMIT_BURST', '10')),
            window_seconds=int(env_vars.get('RATE_LIMIT_WINDOW', '60'))
        )
        
        // TEST: Parse and validate logging configuration
        self.logging_config = LoggingConfig(
            level=env_vars.get('LOG_LEVEL', 'INFO'),
            format=env_vars.get('LOG_FORMAT', 'json'),
            enable_request_logging=env_vars.get('ENABLE_REQUEST_LOGGING', 'true').lower() == 'true',
            enable_response_logging=env_vars.get('ENABLE_RESPONSE_LOGGING', 'true').lower() == 'true'
        )
        
        // TEST: Parse and validate audit configuration
        self.audit_config = AuditConfig(
            enabled=env_vars.get('AUDIT_ENABLED', 'true').lower() == 'true',
            retention_days=int(env_vars.get('AUDIT_RETENTION_DAYS', '2555')),
            encryption_key=env_vars.get('AUDIT_ENCRYPTION_KEY')
        )
        
        // TEST: Set API configuration
        self.api_version = env_vars['API_VERSION']
        self.enable_docs = env_vars.get('ENABLE_DOCS', 'true').lower() == 'true'
        self.enable_redoc = env_vars.get('ENABLE_REDOC', 'true').lower() == 'true'
        self.enable_openapi = env_vars.get('ENABLE_OPENAPI', 'true').lower() == 'true'
        
        // TEST: Parse allowed origins for CORS
        origins_str = env_vars.get('ALLOWED_ORIGINS', 'http://localhost:3000')
        self.allowed_origins = [origin.strip() for origin in origins_str.split(',')]
        
        // TEST: Parse external services configuration
        self.external_services = self._parse_external_services(env_vars)
    
    // TEST: Validate configuration values
    // INPUT: Configuration instance
    // EXPECTED: Validation passes or raises ConfigurationError
    def validate(self) -> None:
        """
        Validate configuration values
        
        Raises:
            ConfigurationError: If any configuration value is invalid
        """
        
        // TEST: Validate database URI format
        if not self.database_config.uri.startswith('mongodb://'):
            raise ConfigurationError("Invalid MongoDB URI format")
        
        // TEST: Validate Redis URL format
        if not self.redis_config.url.startswith('redis://'):
            raise ConfigurationError("Invalid Redis URL format")
        
        // TEST: Validate JWT secret length
        if len(self.auth_config.jwt_secret) < 32:
            raise ConfigurationError("JWT secret must be at least 32 characters")
        
        // TEST: Validate rate limiting values
        if self.rate_limit_config.requests_per_minute <= 0:
            raise ConfigurationError("Rate limit requests per minute must be positive")
        
        // TEST: Validate audit retention period
        if self.audit_config.retention_days <= 0:
            raise ConfigurationError("Audit retention days must be positive")
```

## Middleware Components

### 3. Authentication Middleware

```python
# mcp_server/middleware/auth.py
"""
Authentication Middleware for MCP Server
Handles JWT validation and agent authentication
"""

// TEST: Authenticate incoming requests with JWT
// INPUT: Request with Authorization header
// EXPECTED: Validated agent context or authentication error
class AuthenticationMiddleware:
    """
    Middleware for validating agent authentication tokens
    
    Validates JWT tokens and attaches agent context to requests
    """
    
    def __init__(self, auth_config: AuthConfig):
        self.auth_config = auth_config
        self.auth_service = AuthenticationService(auth_config)
    
    // TEST: Process incoming request authentication
    // INPUT: FastAPI request object
    // EXPECTED: Request with agent context or authentication error
    async def __call__(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """
        Process authentication for incoming requests
        
        Preconditions:
        - Request must have Authorization header for protected endpoints
        - JWT token must be valid and not expired
        
        Postconditions:
        - Request state includes agent context if authenticated
        - Response includes appropriate error if authentication fails
        """
        
        // TEST: Skip authentication for public endpoints
        if self._is_public_endpoint(request.url.path):
            response = await call_next(request)
            return response
        
        // TEST: Extract and validate Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            // TEST: Return 401 for missing authentication
            return JSONResponse(
                status_code=401,
                content={
                    "error": {
                        "code": "MISSING_AUTHENTICATION",
                        "message": "Authorization header is required"
                    }
                }
            )
        
        // TEST: Validate Bearer token format
        try:
            scheme, token = auth_header.split(' ', 1)
            if scheme.lower() != 'bearer':
                // TEST: Return 401 for invalid authentication scheme
                return JSONResponse(
                    status_code=401,
                    content={
                        "error": {
                            "code": "INVALID_AUTHENTICATION_SCHEME",
                            "message": "Authentication scheme must be Bearer"
                        }
                    }
                )
        except ValueError:
            // TEST: Return 401 for malformed authentication header
            return JSONResponse(
                status_code=401,
                content={
                    "error": {
                        "code": "MALFORMED_AUTHENTICATION_HEADER",
                        "message": "Authorization header must be in format 'Bearer <token>'"
                    }
                }
            )
        
        // TEST: Validate JWT token
        try:
            payload = self.auth_service.validate_token(token)
            agent_context = self.auth_service.extract_agent_context(payload)
            
            // TEST: Attach agent context to request state
            request.state.agent = agent_context
            request.state.agent_id = agent_context.agent_id
            request.state.permissions = agent_context.permissions
            
        except TokenExpiredError:
            // TEST: Return 401 for expired token
            return JSONResponse(
                status_code=401,
                content={
                    "error": {
                        "code": "TOKEN_EXPIRED",
                        "message": "Authentication token has expired"
                    }
                }
            )
        except InvalidTokenError as e:
            // TEST: Return 401 for invalid token
            return JSONResponse(
                status_code=401,
                content={
                    "error": {
                        "code": "INVALID_TOKEN",
                        "message": str(e)
                    }
                }
            )
        
        // TEST: Continue with authenticated request
        response = await call_next(request)
        return response
    
    // TEST: Identify public endpoints that skip authentication
    // INPUT: Request path string
    // EXPECTED: Boolean indicating if endpoint is public
    def _is_public_endpoint(self, path: str) -> bool:
        """
        Determine if endpoint requires authentication
        
        Public endpoints:
        - Health checks
        - Discovery endpoints
        - Agent registration (initial)
        - Documentation endpoints
        """
        public_patterns = [
            r'^/api/v1/health',
            r'^/api/v1/discovery',
            r'^/api/v1/agents/register$',
            r'^/docs',
            r'^/redoc',
            r'^/openapi.json'
        ]
        
        return any(re.match(pattern, path) for pattern in public_patterns)
```

### 4. Rate Limiting Middleware

```python
# mcp_server/middleware/rate_limit.py
"""
Rate Limiting Middleware for MCP Server
Implements token bucket algorithm for API rate limiting
"""

// TEST: Enforce rate limits using token bucket algorithm
// INPUT: Request from specific client
// EXPECTED: Request allowed or rate limit error with headers
class RateLimitMiddleware:
    """
    Middleware for enforcing API rate limits
    
    Uses Redis-backed token bucket algorithm for distributed rate limiting
    """
    
    def __init__(self, config: RateLimitConfig, redis_client: Redis):
        self.config = config
        self.redis_client = redis_client
        self.rate_limiter = TokenBucketRateLimiter(config, redis_client)
    
    // TEST: Process request with rate limiting
    // INPUT: FastAPI request object
    // EXPECTED: Request processed or rate limit error
    async def __call__(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """
        Apply rate limiting to incoming requests
        
        Preconditions:
        - Redis connection must be available
        - Rate limit configuration must be valid
        
        Postconditions:
        - Request is processed if within rate limits
        - Appropriate rate limit headers are added to response
        - Request is rejected with 429 if rate limit exceeded
        """
        
        // TEST: Extract client identifier
        client_id = self._extract_client_id(request)
        
        // TEST: Check rate limit for client
        try:
            allowed, remaining, reset_time = await self.rate_limiter.check_rate_limit(
                client_id=client_id,
                endpoint=request.url.path,
                method=request.method
            )
            
            if not allowed:
                // TEST: Return 429 with rate limit headers
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": {
                            "code": "RATE_LIMIT_EXCEEDED",
                            "message": "Rate limit exceeded. Please try again later."
                        }
                    },
                    headers={
                        "X-RateLimit-Limit": str(self.config.requests_per_minute),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(reset_time),
                        "Retry-After": str(reset_time - int(time.time()))
                    }
                )
            
            // TEST: Continue with rate-limited request
            response = await call_next(request)
            
            // TEST: Add rate limit headers to successful response
            response.headers["X-RateLimit-Limit"] = str(self.config.requests_per_minute)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            response.headers["X-RateLimit-Reset"] = str(reset_time)
            
            return response
            
        except RedisConnectionError:
            // TEST: Allow request if Redis unavailable (fail open)
            logger.warning("Redis unavailable for rate limiting, allowing request")
            response = await call_next(request)
            return response
    
    // TEST: Extract unique client identifier
    // INPUT: FastAPI request object
    // EXPECTED: String client identifier
    def _extract_client_id(self, request: Request) -> str:
        """
        Extract unique client identifier for rate limiting
        
        Priority order:
        1. Authenticated agent ID
        2. API key (if present)
        3. IP address (fallback)
        """
        
        // TEST: Use authenticated agent ID if available
        if hasattr(request.state, 'agent_id'):
            return f"agent:{request.state.agent_id}"
        
        // TEST: Use API key if present
        api_key = request.headers.get('X-API-Key')
        if api_key:
            return f"api_key:{api_key[:8]}"  // Use first 8 chars for privacy
        
        // TEST: Fall back to IP address
        client_ip = request.client.host
        forwarded_for = request.headers.get('X-Forwarded-For')
        if forwarded_for:
            client_ip = forwarded_for.split(',')[0].strip()
        
        return f"ip:{client_ip}"
```

## Router Organization

### 5. Agents Router

```python
# mcp_server/routers/agents.py
"""
Agents Router for MCP Server
Handles agent registration, management, and lifecycle operations
"""

// TEST: Create agents router with all endpoints
// INPUT: Router configuration
// EXPECTED: Router with registered agent endpoints
router = APIRouter(prefix="/api/v1/agents", tags=["agents"])

// TEST: Register new agent with valid data
// INPUT: Agent registration request
// EXPECTED: Created agent with authentication token
@router.post("/register", response_model=AgentRegistrationResponse)
async def register_agent(
    request: AgentRegistrationRequest,
    db: Database = Depends(get_database),
    redis: Redis = Depends(get_redis),
    audit_logger: AuditLogger = Depends(get_audit_logger)
) -> AgentRegistrationResponse:
    """
    Register a new agent with the MCP server
    
    Preconditions:
    - Agent ID must not already exist
    - Agent type must be valid
    - Endpoint URLs must be reachable
    - Request must include required fields
    
    Postconditions:
    - Agent is created in database
    - Agent is registered in Redis cache
    - Authentication token is generated
    - Audit log entry is created
    
    // TEST: Validate request data
    // INPUT: Agent registration request
    // EXPECTED: Validated data or validation error
    """
    
    // TEST: Validate agent registration request
    try:
        validated_data = validate_agent_registration(request)
    except ValidationError as e:
        // TEST: Return 400 for validation errors
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid agent registration data",
                    "details": e.errors()
                }
            }
        )
    
    // TEST: Check for duplicate agent ID
    existing_agent = await db.agents.find_one({"agent_id": request.agent_id})
    if existing_agent:
        // TEST: Return 409 for duplicate agent ID
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "AGENT_ALREADY_REGISTERED",
                    "message": f"Agent with ID '{request.agent_id}' already exists"
                }
            }
        )
    
    // TEST: Validate agent capabilities
    if not await validate_capabilities(request.capabilities):
        // TEST: Return 400 for invalid capabilities
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "INVALID_CAPABILITIES",
                    "message": "One or more capabilities are not recognized"
                }
            }
        )
    
    // TEST: Validate endpoint URLs are reachable
    try:
        await validate_agent_endpoints(request.endpoint_url, request.health_check_url)
    except EndpointValidationError as e:
        // TEST: Return 400 for unreachable endpoints
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "INVALID_ENDPOINTS",
                    "message": str(e)
                }
            }
        )
    
    // TEST: Generate secure authentication token
    auth_token = generate_secure_token()
    refresh_token = generate_secure_token()
    
    // TEST: Create agent entity
    agent = Agent(
        agent_id=request.agent_id,
        name=request.name,
        type=request.type,
        capabilities=request.capabilities,
        endpoint_url=request.endpoint_url,
        health_check_url=request.health_check_url,
        websocket_url=request.websocket_url,
        auth_token_hash=hash_token(auth_token),
        refresh_token_hash=hash_token(refresh_token),
        status=AgentStatus.ACTIVE,
        registered_at=datetime.utcnow(),
        metadata=request.metadata or {},
        tags=request.tags or []
    )
    
    // TEST: Store agent in database
    try:
        await db.agents.insert_one(agent.dict())
    except Exception as e:
        // TEST: Handle database errors
        logger.error(f"Failed to store agent in database: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": {
                    "code": "DATABASE_ERROR",
                    "message": "Failed to register agent"
                }
            }
        )
    
    // TEST: Register agent in Redis cache
    try:
        await register_agent_in_cache(redis, agent)
    except Exception as e:
        // TEST: Log cache errors but don't fail registration
        logger.warning(f"Failed to cache agent: {e}")
    
    // TEST: Create audit log entry
    await audit_logger.log_agent_registered(
        agent_id=agent.agent_id,
        agent_type=agent.type,
        capabilities=agent.capabilities
    )
    
    // TEST: Return successful registration response
    return AgentRegistrationResponse(
        agent_id=agent.agent_id,
        status=agent.status,
        registered_at=agent.registered_at,
        auth_token=auth_token,
        refresh_token=refresh_token,
        permissions=agent.permissions
    )


// TEST: Get agent details by ID
// INPUT: Agent ID path parameter
// EXPECTED: Agent details or not found error
@router.get("/{agent_id}", response_model=AgentDetailsResponse)
async def get_agent(
    agent_id: str = Path(..., regex=r'^[a-zA-Z0-9_-]+$'),
    db: Database = Depends(get_database),
    current_agent: AgentContext = Depends(get_current_agent)
) -> AgentDetailsResponse:
    """
    Get detailed information about a specific agent
    
    Preconditions:
    - Agent ID must exist
    - Requesting agent must have read permissions
    
    Postconditions:
    - Agent details are returned
    - Performance metrics are included
    - Last heartbeat timestamp is included
    """
    
    // TEST: Check permissions
    if not current_agent.has_permission(Permission.AGENT_READ):
        // TEST: Return 403 for insufficient permissions
        raise HTTPException(
            status_code=403,
            detail={
                "error": {
                    "code": "INSUFFICIENT_PERMISSIONS",
                    "message": "Agent does not have read permissions"
                }
            }
        )
    
    // TEST: Retrieve agent from database
    agent = await db.agents.find_one({"agent_id": agent_id})
    if not agent:
        // TEST: Return 404 for non-existent agent
        raise HTTPException(
            status_code=404,
            detail={
                "error": {
                    "code": "AGENT_NOT_FOUND",
                    "message": f"Agent with ID '{agent_id}' not found"
                }
            }
        )
    
    // TEST: Calculate performance metrics
    performance_metrics = await calculate_agent_metrics(agent_id, db)
    
    // TEST: Get current task count
    current_tasks = await db.tasks.count_documents({
        "assigned_agent_id": agent_id,
        "status": {"$in": [TaskStatus.ASSIGNED, TaskStatus.RUNNING]}
    })
    
    // TEST: Return agent details with metrics
    return AgentDetailsResponse(
        agent_id=agent['agent_id'],
        name=agent['name'],
        type=agent['type'],
        status=agent['status'],
        capabilities=agent['capabilities'],
        version=agent['version'],
        endpoint_url=agent['endpoint_url'],
        health_check_url=agent['health_check_url'],
        registered_at=agent['registered_at'],
        last_heartbeat=agent['last_heartbeat'],
        current_tasks=current_tasks,
        performance_metrics=performance_metrics,
        metadata=agent.get('metadata', {}),
        permissions=agent['permissions']
    )


// TEST: Update agent information
// INPUT: Agent ID and update request
// EXPECTED: Updated agent or error
@router.put("/{agent_id}", response_model=AgentUpdateResponse)
async def update_agent(
    agent_id: str = Path(..., regex=r'^[a-zA-Z0-9_-]+$'),
    request: AgentUpdateRequest,
    db: Database = Depends(get_database),
    redis: Redis = Depends(get_redis),
    current_agent: AgentContext = Depends(get_current_agent),
    audit_logger: AuditLogger = Depends(get_audit_logger)
) -> AgentUpdateResponse:
    """
    Update agent configuration and metadata
    
    Preconditions:
    - Agent ID must exist
    - Requesting agent must have update permissions
    - Update data must be valid
    
    Postconditions:
    - Agent data is updated in database
    - Agent cache is updated
    - Audit log entry is created
    """
    
    // TEST: Check permissions
    if not current_agent.has_permission(Permission.AGENT_UPDATE):
        // TEST: Return 403 for insufficient permissions
        raise HTTPException(
            status_code=403,
            detail={
                "error": {
                    "code": "INSUFFICIENT_PERMISSIONS",
                    "message": "Agent does not have update permissions"
                }
            }
        )
    
    // TEST: Retrieve existing agent
    agent = await db.agents.find_one({"agent_id": agent_id})
    if not agent:
        // TEST: Return 404 for non-existent agent
        raise HTTPException(
            status_code=404,
            detail={
                "error": {
                    "code": "AGENT_NOT_FOUND",
                    "message": f"Agent with ID '{agent_id}' not found"
                }
            }
        )
    
    // TEST: Validate update request
    update_data = request.dict(exclude_unset=True)
    if not update_data:
        // TEST: Return 400 for empty update
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "EMPTY_UPDATE",
                    "message": "No fields provided for update"
                }
            }
        )
    
    // TEST: Validate capabilities if being updated
    if 'capabilities' in update_data:
        if not await validate_capabilities(update_data['capabilities']):
            // TEST: Return 400 for invalid capabilities
            raise HTTPException(
                status_code=400,
                detail={
                    "error": {
                        "code": "INVALID_CAPABILITIES",
                        "message": "One or more capabilities are not recognized"
                    }
                }
            )
    
    // TEST: Validate endpoint URLs if being updated
    if 'endpoint_url' in update_data or 'health_check_url' in update_data:
        endpoint_url = update_data.get('endpoint_url', agent['endpoint_url'])
        health_check_url = update_data.get('health_check_url', agent['health_check_url'])
        
        try:
            await validate_agent_endpoints(endpoint_url, health_check_url)
        except EndpointValidationError as e:
            // TEST: Return 400 for invalid endpoints
            raise HTTPException(
                status_code=400,
                detail={
                    "error": {
                        "code": "INVALID_ENDPOINTS",
                        "message": str(e)
                    }
                }
            )
    
    // TEST: Update agent in database
    update_data['updated_at'] = datetime.utcnow()
    
    try:
        result = await db.agents.update_one(
            {"agent_id": agent_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            // TEST: Return 404 if agent not found during update
            raise HTTPException(
                status_code=404,
                detail={
                    "error": {
                        "code": "AGENT_NOT_FOUND",
                        "message": f"Agent with ID '{agent_id}' not found"
                    }
                }
            )
            
    except Exception as e:
        // TEST: Handle database errors
        logger.error(f"Failed to update agent in database: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": {
                    "code": "DATABASE_ERROR",
                    "message": "Failed to update agent"
                }
            }
        )
    
    // TEST: Update agent in Redis cache
    try:
        await update_agent_in_cache(redis, agent_id, update_data)
    except Exception as e:
        // TEST: Log cache errors but don't fail update
        logger.warning(f"Failed to update agent cache: {e}")
    
    // TEST: Create audit log entry
    await audit_logger.log_agent_updated(
        agent_id=agent_id,
        updated_fields=list(update_data.keys())
    )
    
    // TEST: Return successful update response
    return AgentUpdateResponse(
        agent_id=agent_id,
        updated_at=update_data['updated_at']
    )


// TEST: Agent heartbeat endpoint
// INPUT: Agent ID and heartbeat request
// EXPECTED: Acknowledged heartbeat or error
@router.post("/{agent_id}/heartbeat", response_model=HeartbeatResponse)
async def agent_heartbeat(
    agent_id: str = Path(..., regex=r'^[a-zA-Z0-9_-]+$'),
    request: HeartbeatRequest,
    db: Database = Depends(get_database),
    redis: Redis = Depends(get_redis),
    current_agent: AgentContext = Depends(get_current_agent)
) -> HeartbeatResponse:
    """
    Process agent heartbeat for health monitoring
    
    Preconditions:
    - Agent ID must exist
    - Requesting agent must be the same as heartbeat agent
    - Heartbeat data must be valid
    
    Postconditions:
    - Agent last heartbeat is updated
    - Agent status may be updated based on health
    - Next heartbeat time is calculated
    """
    
    // TEST: Verify agent identity
    if current_agent.agent_id != agent_id:
        // TEST: Return 403 for unauthorized heartbeat
        raise HTTPException(
            status_code=403,
            detail={
                "error": {
                    "code": "UNAUTHORIZED_HEARTBEAT",
                    "message": "Agent can only send heartbeat for itself"
                }
            }
        )
    
    // TEST: Update agent heartbeat timestamp
    heartbeat_time = datetime.utcnow()
    
    try:
        result = await db.agents.update_one(
            {"agent_id": agent_id},
            {
                "$set": {
                    "last_heartbeat": heartbeat_time,
                    "status": request.status,
                    "current_tasks": request.current_tasks,
                    "updated_at": heartbeat_time
                }
            }
        )
        
        if result.modified_count == 0:
            // TEST: Return 404 if agent not found
            raise HTTPException(
                status_code=404,
                detail={
                    "error": {
                        "code": "AGENT_NOT_FOUND",
                        "message": f"Agent with ID '{agent_id}' not found"
                    }
                }
            )
            
    except Exception as e:
        // TEST: Handle database errors
        logger.error(f"Failed to update agent heartbeat: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": {
                    "code": "DATABASE_ERROR",
                    "message": "Failed to process heartbeat"
                }
            }
        )
    
    // TEST: Update agent status in cache
    try:
        await update_agent_status_in_cache(redis, agent_id, request.status)
    except Exception as e:
        // TEST: Log cache errors but don't fail heartbeat
        logger.warning(f"Failed to update agent status in cache: {e}")
    
    // TEST: Calculate next heartbeat time
    next_heartbeat = heartbeat_time + timedelta(seconds=30)  // 30 second interval
    
    // TEST: Return heartbeat acknowledgment
    return HeartbeatResponse(
        status="acknowledged",
        next_heartbeat=next_heartbeat
    )
```

## Service Layer Components

### 6. Agent Management Service

```python
# mcp_server/services/agent_service.py
"""
Agent Management Service
Handles agent lifecycle, registration, and capability management
"""

// TEST: Create agent service with dependency injection
// INPUT: Service dependencies (database, Redis, etc.)
// EXPECTED: Initialized agent service instance
class AgentService:
    """
    Service for managing agent lifecycle and operations
    
    Provides business logic for agent registration, updates, and monitoring
    """
    
    def __init__(self, db: Database, redis: Redis, audit_logger: AuditLogger):
        self.db = db
        self.redis = redis
        self.audit_logger = audit_logger
        self.cache_ttl = 300  // 5 minutes
    
    // TEST: Register new agent with validation
    // INPUT: Agent registration data
    // EXPECTED: Registered agent with authentication credentials
    async def register_agent(self, registration_data: AgentRegistrationData) -> RegisteredAgent:
        """
        Register a new agent with the system
        
        Preconditions:
        - Agent ID must be unique
        - Agent type must be valid
        - Capabilities must be recognized
        - Endpoint URLs must be reachable
        
        Postconditions:
        - Agent is stored in database
        - Agent is cached in Redis
        - Authentication credentials are generated
        - Audit log entry is created
        
        // TEST: Validate agent registration data
        // INPUT: Registration data
        // EXPECTED: Validated data or validation error
        """
        
        // TEST: Generate unique agent ID if not provided
        if not registration_data.agent_id:
            registration_data.agent_id = generate_uuid()
        
        // TEST: Validate agent type
        if registration_data.type not in AgentType:
            raise ValidationError(f"Invalid agent type: {registration_data.type}")
        
        // TEST: Validate capabilities
        valid_capabilities = await self._get_valid_capabilities()
        invalid_capabilities = set(registration_data.capabilities) - set(valid_capabilities)
        if invalid_capabilities:
            raise ValidationError(f"Invalid capabilities: {invalid_capabilities}")
        
        // TEST: Check for duplicate agent ID
        existing_agent = await self.db.agents.find_one({"agent_id": registration_data.agent_id})
        if existing_agent:
            raise DuplicateAgentError(f"Agent {registration_data.agent_id} already exists")
        
        // TEST: Validate endpoint reachability
        await self._validate_endpoints(registration_data.endpoint_url, registration_data.health_check_url)
        
        // TEST: Generate authentication credentials
        auth_token = generate_secure_token(32)
        refresh_token = generate_secure_token(32)
        
        // TEST: Create agent entity
        agent = Agent(
            agent_id=registration_data.agent_id,
            name=registration_data.name,
            type=registration_data.type,
            capabilities=registration_data.capabilities,
            endpoint_url=registration_data.endpoint_url,
            health_check_url=registration_data.health_check_url,
            websocket_url=registration_data.websocket_url,
            auth_token_hash=hash_token(auth_token),
            refresh_token_hash=hash_token(refresh_token),
            status=AgentStatus.ACTIVE,
            registered_at=datetime.utcnow(),
            last_heartbeat=datetime.utcnow(),
            metadata=registration_data.metadata or {},
            tags=registration_data.tags or [],
            permissions=self._get_default_permissions(registration_data.type)
        )
        
        // TEST: Store agent in database
        try:
            await self.db.agents.insert_one(agent.dict())
        except Exception as e:
            logger.error(f"Failed to store agent: {e}")
            raise DatabaseError("Failed to register agent")
        
        // TEST: Cache agent in Redis
        try:
            await self._cache_agent(agent)
        except Exception as e:
            logger.warning(f"Failed to cache agent: {e}")
        
        // TEST: Create audit log entry
        await self.audit_logger.log_agent_registered(
            agent_id=agent.agent_id,
            agent_type=agent.type,
            capabilities=agent.capabilities
        )
        
        // TEST: Return registered agent with credentials
        return RegisteredAgent(
            agent_id=agent.agent_id,
            status=agent.status,
            registered_at=agent.registered_at,
            auth_token=auth_token,
            refresh_token=refresh_token,
            permissions=agent.permissions
        )
    
    // TEST: Get agent by ID with caching
    // INPUT: Agent ID
    // EXPECTED: Agent details or not found error
    async def get_agent(self, agent_id: str) -> Optional[Agent]:
        """
        Retrieve agent by ID with caching
        
        Preconditions:
        - Agent ID must be valid format
        
        Postconditions:
        - Agent is returned if found
        - Cache is updated with agent data
        """
        
        // TEST: Check Redis cache first
        cached_agent = await self._get_cached_agent(agent_id)
        if cached_agent:
            return cached_agent
        
        // TEST: Query database if not in cache
        agent_data = await self.db.agents.find_one({"agent_id": agent_id})
        if not agent_data:
            return None
        
        // TEST: Convert to Agent entity
        agent = Agent(**agent_data)
        
        // TEST: Cache agent for future requests
        await self._cache_agent(agent)
        
        return agent
    
    // TEST: Update agent information
    // INPUT: Agent ID and update data
    // EXPECTED: Updated agent or error
    async def update_agent(self, agent_id: str, update_data: Dict[str, Any]) -> Agent:
        """
        Update agent configuration and metadata
        
        Preconditions:
        - Agent must exist
        - Update data must be valid
        - Requesting agent must have update permissions
        
        Postconditions:
        - Agent data is updated in database
        - Agent cache is updated
        - Audit log entry is created
        """
        
        // TEST: Retrieve existing agent
        agent = await self.get_agent(agent_id)
        if not agent:
            raise AgentNotFoundError(f"Agent {agent_id} not found")
        
        // TEST: Validate update data
        validated_updates = await self._validate_agent_updates(update_data)
        
        // TEST: Apply updates to agent
        for field, value in validated_updates.items():
            setattr(agent, field, value)
        
        agent.updated_at = datetime.utcnow()
        
        // TEST: Update agent in database
        try:
            result = await self.db.agents.update_one(
                {"agent_id": agent_id},
                {"$set": agent.dict()}
            )
            
            if result.modified_count == 0:
                raise DatabaseError("Failed to update agent")
                
        except Exception as e:
            logger.error(f"Failed to update agent: {e}")
            raise DatabaseError("Failed to update agent")
        
        // TEST: Update agent cache
        try:
            await self._update_cached_agent(agent_id, validated_updates)
        except Exception as e:
            logger.warning(f"Failed to update agent cache: {e}")
        
        // TEST: Create audit log entry
        await self.audit_logger.log_agent_updated(
            agent_id=agent_id,
            updated_fields=list(validated_updates.keys())
        )
        
        return agent
    
    // TEST: Process agent heartbeat
    // INPUT: Agent ID and heartbeat data
    // EXPECTED: Updated agent status and next heartbeat time
    async def process_heartbeat(self, agent_id: str, heartbeat_data: HeartbeatData) -> HeartbeatResult:
        """
        Process agent heartbeat for health monitoring
        
        Preconditions:
        - Agent must exist
        - Heartbeat data must be valid
        
        Postconditions:
        - Agent last heartbeat is updated
        - Agent status may be updated
        - Next heartbeat time is calculated
        """
        
        // TEST: Retrieve agent
        agent = await self.get_agent(agent_id)
        if not agent:
            raise AgentNotFoundError(f"Agent {agent_id} not found")
        
        // TEST: Validate heartbeat data
        if heartbeat_data.status not in AgentStatus:
            raise ValidationError(f"Invalid status: {heartbeat_data.status}")
        
        // TEST: Update agent heartbeat information
        update_data = {
            "last_heartbeat": datetime.utcnow(),
            "status": heartbeat_data.status,
            "current_tasks": heartbeat_data.current_tasks,
            "system_metrics": heartbeat_data.system_metrics,
            "updated_at": datetime.utcnow()
        }
        
        // TEST: Update agent in database
        try:
            await self.db.agents.update_one(
                {"agent_id": agent_id},
                {"$set": update_data}
            )
        except Exception as e:
            logger.error(f"Failed to update heartbeat: {e}")
            raise DatabaseError("Failed to process heartbeat")
        
        // TEST: Update agent cache
        try:
            await self._update_cached_agent(agent_id, update_data)
        except Exception as e:
            logger.warning(f"Failed to update agent cache: {e}")
        
        // TEST: Calculate next heartbeat time
        next_heartbeat = datetime.utcnow() + timedelta(seconds=30)
        
        return HeartbeatResult(
            status="acknowledged",
            next_heartbeat=next_heartbeat
        )
    
    // TEST: Find agents by capabilities
    // INPUT: Required capabilities and filters
    // EXPECTED: List of matching agents
    async def find_agents_by_capabilities(
        self,
        required_capabilities: List[str],
        status: Optional[AgentStatus] = None,
        max_tasks: Optional[int] = None
    ) -> List[Agent]:
        """
        Find agents that match specified capabilities
        
        Preconditions:
        - Capabilities must be valid
        - Status filter must be valid if provided
        
        Postconditions:
        - Returns list of matching agents
        - Agents are sorted by availability and performance
        """
        
        // TEST: Build query filter
        query = {
            "capabilities": {"$all": required_capabilities}
        }
        
        if status:
            query["status"] = status
        
        if max_tasks is not None:
            query["$expr"] = {"$lt": ["$current_tasks", "$max_concurrent_tasks"]}
        
        // TEST: Query database for matching agents
        cursor = self.db.agents.find(query).sort("last_heartbeat", -1)
        agents = []
        
        async for agent_data in cursor:
            agents.append(Agent(**agent_data))
        
        // TEST: Sort agents by availability and performance
        agents = await self._sort_agents_by_availability(agents)
        
        return agents
    
    // TEST: Private method to cache agent in Redis
    // INPUT: Agent entity
    // EXPECTED: Agent cached with appropriate TTL
    async def _cache_agent(self, agent: Agent) -> None:
        """
        Cache agent data in Redis for fast retrieval
        
        Preconditions:
        - Redis connection must be available
        - Agent must have valid ID
        
        Postconditions:
        - Agent data is cached with TTL
        - Agent is added to capability indexes
        """
        
        // TEST: Cache agent data
        cache_key = f"agent:{agent.agent_id}"
        agent_data = agent.dict()
        
        await self.redis.setex(
            cache_key,
            self.cache_ttl,
            json.dumps(agent_data)
        )
        
        // TEST: Update capability indexes
        for capability in agent.capabilities:
            capability_key = f"agents:capability:{capability}"
            await self.redis.sadd(capability_key, agent.agent_id)
            await self.redis.expire(capability_key, self.cache_ttl)
        
        // TEST: Update status index
        status_key = f"agents:status:{agent.status}"
        await self.redis.sadd(status_key, agent.agent_id)
        await self.redis.expire(status_key, self.cache_ttl)
        
        // TEST: Update active agents set
        if agent.status == AgentStatus.ACTIVE:
            await self.redis.sadd("agents:active", agent.agent_id)
            await self.redis.expire("agents:active", self.cache_ttl)
```

This pseudocode provides a comprehensive foundation for the MCP server FastAPI application structure with extensive TDD anchors covering all major components including application factory, middleware, routers, and service layer. The design emphasizes modularity, error handling, validation, and testability while maintaining clear separation of concerns.
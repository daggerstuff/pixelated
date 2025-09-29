# Phase 06: MCP Server Error Handling and API Contracts

## Overview

This document provides comprehensive error handling strategies, retry mechanisms, and API contracts for the MCP server, including structured error responses, circuit breaker patterns, and detailed API specifications with TDD anchors.

## Error Handling Architecture

### 1. Structured Error System

```python
# mcp_server/errors/structured_errors.py
"""
Structured Error System
Provides consistent error handling with categorization and retry logic
"""

// TEST: Create structured error with metadata
// INPUT: Error code and context
// EXPECTED: Structured error with retry information
class MCPError(Exception):
    """
    Base class for all MCP server errors
    
    Provides structured error information with categorization and retry logic
    """
    
    def __init__(
        self,
        code: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        retryable: bool = False,
        retry_after: Optional[int] = None,
        error_type: ErrorType = ErrorType.SYSTEM
    ):
        self.code = code
        self.message = message
        self.details = details or {}
        self.retryable = retryable
        self.retry_after = retry_after
        self.error_type = error_type
        self.timestamp = datetime.utcnow()
        self.error_id = generate_uuid()
        
        super().__init__(self.message)
    
    // TEST: Convert error to API response format
    // INPUT: Error instance
    // EXPECTED: JSON-serializable error response
    def to_api_response(self) -> Dict[str, Any]:
        """
        Convert error to API response format
        
        Preconditions:
        - Error must be properly initialized
        
        Postconditions:
        - Returns JSON-serializable error response
        - Includes all relevant error information
        - Follows API error response schema
        """
        
        response = {
            "error": {
                "code": self.code,
                "message": self.message,
                "error_id": self.error_id,
                "timestamp": self.timestamp.isoformat(),
                "type": self.error_type.value,
                "retryable": self.retryable
            }
        }
        
        // TEST: Add details if available
        if self.details:
            response["error"]["details"] = self.details
        
        // TEST: Add retry information if applicable
        if self.retryable and self.retry_after:
            response["error"]["retry_after"] = self.retry_after
        
        return response


// TEST: Define specific error types
// INPUT: Error context and parameters
// EXPECTED: Appropriate error subclass
class AgentNotFoundError(MCPError):
    """Error when requested agent is not found"""
    
    def __init__(self, agent_id: str):
        super().__init__(
            code="AGENT_NOT_FOUND",
            message=f"Agent with ID '{agent_id}' not found",
            details={"agent_id": agent_id},
            retryable=False,
            error_type=ErrorType.NOT_FOUND
        )


class TaskAssignmentError(MCPError):
    """Error when task assignment fails"""
    
    def __init__(self, task_id: str, reason: str):
        super().__init__(
            code="TASK_ASSIGNMENT_FAILED",
            message=f"Failed to assign task {task_id}: {reason}",
            details={"task_id": task_id, "reason": reason},
            retryable=True,
            retry_after=30,  // Retry after 30 seconds
            error_type=ErrorType.BUSINESS_LOGIC
        )


class AuthenticationError(MCPError):
    """Error when authentication fails"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            code="AUTHENTICATION_FAILED",
            message=message,
            details=details,
            retryable=False,
            error_type=ErrorType.AUTHENTICATION
        )


class RateLimitExceededError(MCPError):
    """Error when rate limit is exceeded"""
    
    def __init__(self, limit: int, window: int, retry_after: int):
        super().__init__(
            code="RATE_LIMIT_EXCEEDED",
            message=f"Rate limit exceeded. Limit: {limit} requests per {window} seconds",
            details={"limit": limit, "window": window},
            retryable=True,
            retry_after=retry_after,
            error_type=ErrorType.RATE_LIMIT
        )


class ExternalServiceError(MCPError):
    """Error when external service call fails"""
    
    def __init__(self, service_name: str, status_code: Optional[int] = None):
        details = {"service": service_name}
        if status_code:
            details["status_code"] = status_code
            
        super().__init__(
            code="EXTERNAL_SERVICE_ERROR",
            message=f"External service '{service_name}' returned an error",
            details=details,
            retryable=True,
            retry_after=60,  // Retry after 1 minute
            error_type=ErrorType.EXTERNAL_SERVICE
        )


class ValidationError(MCPError):
    """Error when input validation fails"""
    
    def __init__(self, message: str, field_errors: Optional[List[Dict[str, Any]]] = None):
        details = {}
        if field_errors:
            details["field_errors"] = field_errors
            
        super().__init__(
            code="VALIDATION_ERROR",
            message=message,
            details=details,
            retryable=False,
            error_type=ErrorType.VALIDATION
        )


// TEST: Define error type enumeration
// INPUT: Error categorization needs
// EXPECTED: Comprehensive error type classification
class ErrorType(Enum):
    """Error type categorization for handling and monitoring"""
    
    VALIDATION = "validation"                    # Input validation errors
    AUTHENTICATION = "authentication"            # Authentication failures
    AUTHORIZATION = "authorization"              # Permission/authorization errors
    NOT_FOUND = "not_found"                      # Resource not found
    CONFLICT = "conflict"                        # Resource conflicts
    RATE_LIMIT = "rate_limit"                    # Rate limiting errors
    BUSINESS_LOGIC = "business_logic"            # Business rule violations
    EXTERNAL_SERVICE = "external_service"        # External service errors
    NETWORK = "network"                          # Network-related errors
    TIMEOUT = "timeout"                          # Operation timeout
    SYSTEM = "system"                            # Internal system errors
```

### 2. Error Handler Middleware

```python
# mcp_server/middleware/error_handler.py
"""
Error Handler Middleware
Provides centralized error handling for FastAPI application
"""

// TEST: Create error handler middleware
// INPUT: Application configuration
// EXPECTED: Configured error handler
class ErrorHandlerMiddleware:
    """
    Middleware for centralized error handling and response formatting
    
    Catches all exceptions and converts to structured error responses
    """
    
    def __init__(self, config: ErrorConfig):
        self.config = config
        self.error_logger = ErrorLogger(config.logging_config)
        self.circuit_breaker = CircuitBreakerManager(config.circuit_breaker_config)
    
    // TEST: Handle HTTP exceptions
    // INPUT: HTTP exception and request context
    // EXPECTED: Structured error response
    async def handle_http_exception(self, request: Request, exc: HTTPException) -> JSONResponse:
        """
        Handle FastAPI HTTP exceptions
        
        Preconditions:
        - Exception must be HTTPException instance
        - Request context must be available
        
        Postconditions:
        - Returns structured error response
        - Error is logged for monitoring
        - Appropriate HTTP status is set
        """
        
        // TEST: Map HTTP status to error code
        error_code = self._map_http_status_to_code(exc.status_code)
        
        // TEST: Create structured error
        error = MCPError(
            code=error_code,
            message=exc.detail or "HTTP error occurred",
            error_type=self._get_error_type_from_status(exc.status_code)
        )
        
        // TEST: Log error for monitoring
        await self.error_logger.log_error(error, request)
        
        // TEST: Return structured response
        return JSONResponse(
            status_code=exc.status_code,
            content=error.to_api_response(),
            headers=self._get_error_headers(error)
        )
    
    // TEST: Handle validation errors
    // INPUT: Validation error and request context
    // EXPECTED: Structured validation error response
    async def handle_validation_error(self, request: Request, exc: RequestValidationError) -> JSONResponse:
        """
        Handle request validation errors
        
        Preconditions:
        - Exception must be RequestValidationError
        - Request context must be available
        
        Postconditions:
        - Returns structured validation error
        - Field errors are included in details
        - 400 status is returned
        """
        
        // TEST: Extract field errors
        field_errors = []
        for error in exc.errors():
            field_errors.append({
                "field": ".".join(str(loc) for loc in error["loc"]),
                "message": error["msg"],
                "type": error["type"]
            })
        
        // TEST: Create validation error
        error = ValidationError(
            message="Request validation failed",
            field_errors=field_errors
        )
        
        // TEST: Log validation error
        await self.error_logger.log_error(error, request)
        
        // TEST: Return validation error response
        return JSONResponse(
            status_code=400,
            content=error.to_api_response(),
            headers=self._get_error_headers(error)
        )
    
    // TEST: Handle general exceptions
    // INPUT: General exception and request context
    // EXPECTED: Structured system error response
    async def handle_general_exception(self, request: Request, exc: Exception) -> JSONResponse:
        """
        Handle unexpected exceptions
        
        Preconditions:
        - Exception must be Exception instance
        - Request context must be available
        
        Postconditions:
        - Returns generic error response (security)
        - Error is logged with full details
        - 500 status is returned
        """
        
        // TEST: Check if exception is known MCP error
        if isinstance(exc, MCPError):
            await self.error_logger.log_error(exc, request)
            return JSONResponse(
                status_code=self._get_http_status_for_error(exc),
                content=exc.to_api_response(),
                headers=self._get_error_headers(exc)
            )
        
        // TEST: Log detailed error for debugging
        error_details = {
            "exception_type": type(exc).__name__,
            "exception_message": str(exc),
            "traceback": traceback.format_exc()
        }
        
        await self.error_logger.log_system_error(exc, request, error_details)
        
        // TEST: Create generic system error (hide internal details)
        system_error = MCPError(
            code="INTERNAL_ERROR",
            message="An internal error occurred. Please try again later.",
            error_type=ErrorType.SYSTEM
        )
        
        return JSONResponse(
            status_code=500,
            content=system_error.to_api_response(),
            headers=self._get_error_headers(system_error)
        )
    
    // TEST: Handle external service errors with circuit breaker
    // INPUT: External service error and request context
    // EXPECTED: Circuit breaker response or error
    async def handle_external_service_error(
        self,
        request: Request,
        service_name: str,
        error: Exception
    ) -> JSONResponse:
        """
        Handle external service errors with circuit breaker logic
        
        Preconditions:
        - Service name must be valid
        - Error must be external service related
        
        Postconditions:
        - Circuit breaker state is updated
        - Fallback response may be returned
        - Error is logged and monitored
        """
        
        // TEST: Record error in circuit breaker
        circuit_state = await self.circuit_breaker.record_error(service_name)
        
        // TEST: Check circuit breaker state
        if circuit_state == CircuitState.OPEN:
            // TEST: Return circuit breaker error
            circuit_error = MCPError(
                code="CIRCUIT_BREAKER_OPEN",
                message=f"Service '{service_name}' is currently unavailable",
                retryable=True,
                retry_after=60,  // Retry after 1 minute
                error_type=ErrorType.EXTERNAL_SERVICE
            )
            
            return JSONResponse(
                status_code=503,  // Service Unavailable
                content=circuit_error.to_api_response(),
                headers={"Retry-After": "60"}
            )
        
        // TEST: Handle based on error type
        if isinstance(error, aiohttp.ClientError):
            external_error = ExternalServiceError(
                service_name=service_name,
                status_code=getattr(error, 'status', None)
            )
        else:
            external_error = ExternalServiceError(service_name=service_name)
        
        await self.error_logger.log_error(external_error, request)
        
        return JSONResponse(
            status_code=502,  // Bad Gateway
            content=external_error.to_api_response(),
            headers=self._get_error_headers(external_error)
        )
    
    // TEST: Map HTTP status codes to error codes
    // INPUT: HTTP status code
    // EXPECTED: MCP error code
    def _map_http_status_to_code(self, status_code: int) -> str:
        """
        Map HTTP status codes to MCP error codes
        
        Preconditions:
        - Status code must be valid HTTP status
        
        Postconditions:
        - Returns appropriate MCP error code
        - Mapping follows REST conventions
        """
        
        status_mapping = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
            422: "UNPROCESSABLE_ENTITY",
            429: "TOO_MANY_REQUESTS",
            500: "INTERNAL_SERVER_ERROR",
            502: "BAD_GATEWAY",
            503: "SERVICE_UNAVAILABLE"
        }
        
        return status_mapping.get(status_code, "UNKNOWN_ERROR")
    
    // TEST: Get error headers for response
    // INPUT: Error instance
    // EXPECTED: Appropriate HTTP headers
    def _get_error_headers(self, error: MCPError) -> Dict[str, str]:
        """
        Get HTTP headers for error response
        
        Preconditions:
        - Error must be valid MCPError instance
        
        Postconditions:
        - Returns appropriate headers
        - Includes retry information if applicable
        """
        
        headers = {
            "Content-Type": "application/json",
            "X-Error-ID": error.error_id,
            "X-Error-Type": error.error_type.value
        }
        
        // TEST: Add retry header if retryable
        if error.retryable and error.retry_after:
            headers["Retry-After"] = str(error.retry_after)
        
        return headers
```

### 3. Retry Mechanism with Exponential Backoff

```python
# mcp_server/utils/retry_mechanism.py
"""
Retry Mechanism with Exponential Backoff
Provides configurable retry logic with circuit breaker integration
"""

// TEST: Create retry configuration
// INPUT: Retry parameters
// EXPECTED: Valid retry configuration
@dataclass
class RetryConfig:
    """
    Configuration for retry mechanism
    
    Defines retry behavior including delays and limits
    """
    max_attempts: int = 3
    initial_delay: float = 1.0  // seconds
    max_delay: float = 60.0     // seconds
    backoff_factor: float = 2.0  // exponential backoff multiplier
    retryable_errors: List[ErrorType] = None
    circuit_breaker_enabled: bool = True
    
    def __post_init__(self):
        if self.retryable_errors is None:
            self.retryable_errors = [
                ErrorType.NETWORK,
                ErrorType.EXTERNAL_SERVICE,
                ErrorType.TIMEOUT
            ]


// TEST: Create retry decorator with circuit breaker
// INPUT: Function and retry configuration
// EXPECTED: Retried function with backoff
class RetryDecorator:
    """
    Decorator for adding retry logic to functions
    
    Supports exponential backoff and circuit breaker integration
    """
    
    def __init__(self, config: RetryConfig, circuit_breaker: Optional[CircuitBreaker] = None):
        self.config = config
        self.circuit_breaker = circuit_breaker
    
    // TEST: Execute function with retry logic
    // INPUT: Function and arguments
    // EXPECTED: Function result or final failure
    async def __call__(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function with retry logic
        
        Preconditions:
        - Function must be callable
        - Retry configuration must be valid
        
        Postconditions:
        - Function is retried on failure if appropriate
        - Final result or exception is returned
        - Circuit breaker is updated
        """
        
        last_exception = None
        
        for attempt in range(1, self.config.max_attempts + 1):
            try:
                // TEST: Execute function
                result = await func(*args, **kwargs)
                
                // TEST: Success - reset circuit breaker if applicable
                if self.circuit_breaker:
                    await self.circuit_breaker.record_success()
                
                return result
                
            except Exception as e:
                last_exception = e
                
                // TEST: Check if error is retryable
                if not self._is_retryable_error(e):
                    logger.info(f"Non-retryable error in {func.__name__}: {e}")
                    raise
                
                // TEST: Check if this is the last attempt
                if attempt == self.config.max_attempts:
                    logger.error(f"Final attempt failed for {func.__name__}: {e}")
                    
                    // TEST: Record failure in circuit breaker
                    if self.circuit_breaker:
                        await self.circuit_breaker.record_failure()
                    
                    raise
                
                // TEST: Calculate delay with exponential backoff
                delay = min(
                    self.config.initial_delay * (self.config.backoff_factor ** (attempt - 1)),
                    self.config.max_delay
                )
                
                logger.warning(
                    f"Attempt {attempt} failed for {func.__name__}: {e}. "
                    f"Retrying in {delay:.1f} seconds..."
                )
                
                // TEST: Wait before retry
                await asyncio.sleep(delay)
        
        // TEST: Should not reach here, but handle edge case
        raise last_exception or Exception("Retry mechanism failed unexpectedly")
    
    // TEST: Check if error is retryable
    // INPUT: Exception instance
    // EXPECTED: Boolean indicating retryability
    def _is_retryable_error(self, error: Exception) -> bool:
        """
        Determine if error should trigger retry
        
        Preconditions:
        - Error must be Exception instance
        
        Postconditions:
        - Returns True if error is retryable
        - Considers error type and configuration
        """
        
        // TEST: Check if it's an MCP error
        if isinstance(error, MCPError):
            return error.retryable and error.error_type in self.config.retryable_errors
        
        // TEST: Check for specific exception types
        retryable_exceptions = (
            aiohttp.ClientError,
            asyncio.TimeoutError,
            ConnectionError,
            OSError
        )
        
        return isinstance(error, retryable_exceptions)


// TEST: Apply retry decorator to function
// INPUT: Function and optional configuration
// EXPECTED: Decorated function with retry capability
def retryable(
    max_attempts: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    backoff_factor: float = 2.0,
    retryable_errors: Optional[List[ErrorType]] = None,
    circuit_breaker_enabled: bool = True
):
    """
    Decorator for making functions retryable
    
    Preconditions:
    - Function must be async callable
    - Parameters must be valid
    
    Postconditions:
    - Function gains retry capability
    - Circuit breaker is integrated if enabled
    """
    
    def decorator(func: Callable) -> Callable:
        // TEST: Create retry configuration
        config = RetryConfig(
            max_attempts=max_attempts,
            initial_delay=initial_delay,
            max_delay=max_delay,
            backoff_factor=backoff_factor,
            retryable_errors=retryable_errors,
            circuit_breaker_enabled=circuit_breaker_enabled
        )
        
        // TEST: Create retry wrapper
        retry_wrapper = RetryDecorator(config)
        
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await retry_wrapper(func, *args, **kwargs)
        
        return wrapper
    
    return decorator


// TEST: Retry external service call with circuit breaker
// INPUT: Service function and parameters
// EXPECTED: Service result or circuit breaker error
@retryable(
    max_attempts=3,
    initial_delay=2.0,
    circuit_breaker_enabled=True
)
async def call_external_service(
    service_name: str,
    endpoint: str,
    method: str = "GET",
    **kwargs
) -> Dict[str, Any]:
    """
    Call external service with retry and circuit breaker protection
    
    Preconditions:
    - Service name must be valid
    - Endpoint must be accessible
    - Circuit breaker must be configured
    
    Postconditions:
    - Returns service response
    - Retries on failure with backoff
    - Circuit breaker protects against cascading failures
    """
    
    // TEST: Check circuit breaker state
    circuit_breaker = get_circuit_breaker(service_name)
    if circuit_breaker and await circuit_breaker.is_open():
        raise CircuitBreakerOpenError(f"Circuit breaker open for {service_name}")
    
    try:
        // TEST: Make HTTP request
        async with aiohttp.ClientSession() as session:
            async with session.request(method, endpoint, **kwargs) as response:
                
                // TEST: Check response status
                if response.status >= 500:
                    // TEST: Server error - retryable
                    raise ExternalServiceError(service_name, response.status)
                elif response.status >= 400:
                    // TEST: Client error - not retryable
                    error_text = await response.text()
                    raise ExternalServiceError(service_name, response.status)
                
                // TEST: Parse successful response
                return await response.json()
                
    except Exception as e:
        // TEST: Record failure in circuit breaker
        if circuit_breaker:
            await circuit_breaker.record_failure()
        
        // TEST: Re-raise for retry logic
        raise
    
    // TEST: Record success in circuit breaker
    if circuit_breaker:
        await circuit_breaker.record_success()
```

### 4. Circuit Breaker Pattern

```python
# mcp_server/utils/circuit_breaker.py
"""
Circuit Breaker Pattern
Protects against cascading failures in distributed systems
"""

// TEST: Define circuit breaker states
// INPUT: State transition requirements
// EXPECTED: Valid state machine
class CircuitState(Enum):
    """Circuit breaker states"""
    CLOSED = "closed"        // Normal operation
    OPEN = "open"            // Failing fast
    HALF_OPEN = "half_open"  // Testing recovery


// TEST: Create circuit breaker with configuration
// INPUT: Service name and configuration
// EXPECTED: Initialized circuit breaker
class CircuitBreaker:
    """
    Circuit breaker for protecting against cascading failures
    
    Monitors failure rate and opens circuit when threshold is exceeded
    """
    
    def __init__(self, service_name: str, config: CircuitBreakerConfig):
        self.service_name = service_name
        self.config = config
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        self.last_state_change = datetime.utcnow()
        self.half_open_test_count = 0
        self.redis_key = f"circuit_breaker:{service_name}"
    
    // TEST: Check if circuit is open
    // INPUT: Current time
    // EXPECTED: Circuit state boolean
    async def is_open(self) -> bool:
        """
        Check if circuit breaker is open (failing fast)
        
        Preconditions:
        - Circuit breaker must be initialized
        
        Postconditions:
        - Returns True if circuit is open
        - Returns False if circuit is closed or half-open
        """
        
        // TEST: Check current state
        if self.state == CircuitState.OPEN:
            // TEST: Check if recovery time has passed
            if self._should_attempt_reset():
                await self._transition_to_half_open()
                return False  // Allow test request
            return True  // Circuit is open
        
        return False  // Circuit is closed or half-open
    
    // TEST: Record successful call
    // INPUT: Success context
    // EXPECTED: Circuit state updated
    async def record_success(self) -> None:
        """
        Record successful service call
        
        Preconditions:
        - Service call must have succeeded
        
        Postconditions:
        - Success count is incremented
        - Circuit state may be updated
        - Metrics are updated
        """
        
        // TEST: Update based on current state
        if self.state == CircuitState.HALF_OPEN:
            // TEST: Increment half-open success count
            self.success_count += 1
            self.half_open_test_count += 1
            
            // TEST: Check if circuit should close
            if self.success_count >= self.config.success_threshold:
                await self._transition_to_closed()
                logger.info(f"Circuit breaker closed for {self.service_name}")
        
        elif self.state == CircuitState.CLOSED:
            // TEST: Reset failure count on success
            if self.failure_count > 0:
                self.failure_count = max(0, self.failure_count - 1)
        
        // TEST: Store updated state
        await self._persist_state()
    
    // TEST: Record failed call
    // INPUT: Failure context
    // EXPECTED: Circuit state updated
    async def record_failure(self) -> None:
        """
        Record failed service call
        
        Preconditions:
        - Service call must have failed
        
        Postconditions:
        - Failure count is incremented
        - Circuit may open if threshold exceeded
        - Metrics are updated
        """
        
        self.failure_count += 1
        self.last_failure_time = datetime.utcnow()
        
        // TEST: Update based on current state
        if self.state == CircuitState.HALF_OPEN:
            // TEST: Circuit failed in half-open state, reopen
            await self._transition_to_open()
            logger.warning(f"Circuit breaker reopened for {self.service_name}")
        
        elif self.state == CircuitState.CLOSED:
            // TEST: Check if failure threshold is exceeded
            if self.failure_count >= self.config.failure_threshold:
                await self._transition_to_open()
                logger.warning(f"Circuit breaker opened for {self.service_name}")
        
        // TEST: Store updated state
        await self._persist_state()
    
    // TEST: Transition to open state
    // INPUT: State change reason
    // EXPECTED: Circuit opened with timing
    async def _transition_to_open(self) -> None:
        """
        Transition circuit to open state
        
        Preconditions:
        - Failure threshold must be exceeded
        
        Postconditions:
        - Circuit is opened
        - State change is recorded
        - Timer is started for recovery
        """
        
        self.state = CircuitState.OPEN
        self.last_state_change = datetime.utcnow()
        self.half_open_test_count = 0
        self.success_count = 0
        
        // TEST: Schedule automatic transition to half-open
        asyncio.create_task(self._schedule_half_open_transition())
    
    // TEST: Transition to half-open state
    // INPUT: Recovery timing
    // EXPECTED: Circuit in testing state
    async def _transition_to_half_open(self) -> None:
        """
        Transition circuit to half-open state for testing
        
        Preconditions:
        - Recovery time must have passed
        
        Postconditions:
        - Circuit is half-open
        - Test counters are reset
        - Limited requests are allowed
        """
        
        self.state = CircuitState.HALF_OPEN
        self.last_state_change = datetime.utcnow()
        self.success_count = 0
        self.half_open_test_count = 0
    
    // TEST: Transition to closed state
    // INPUT: Success criteria met
    // EXPECTED: Circuit closed for normal operation
    async def _transition_to_closed(self) -> None:
        """
        Transition circuit to closed state (normal operation)
        
        Preconditions:
        - Success threshold must be met in half-open state
        
        Postconditions:
        - Circuit is closed
        - Counters are reset
        - Normal operation resumes
        """
        
        self.state = CircuitState.CLOSED
        self.last_state_change = datetime.utcnow()
        self.failure_count = 0
        self.success_count = 0
        self.half_open_test_count = 0
    
    // TEST: Check if reset should be attempted
    // INPUT: Current time
    // EXPECTED: Boolean reset decision
    def _should_attempt_reset(self) -> bool:
        """
        Check if enough time has passed to attempt reset
        
        Preconditions:
        - Circuit must be in open state
        
        Postconditions:
        - Returns True if recovery time has passed
        - Returns False if still in timeout period
        """
        
        if self.state != CircuitState.OPEN:
            return False
        
        if not self.last_state_change:
            return True
        
        elapsed = (datetime.utcnow() - self.last_state_change).total_seconds()
        return elapsed >= self.config.recovery_timeout
    
    // TEST: Schedule automatic half-open transition
    // INPUT: Recovery timeout
    // EXPECTED: Timed state transition
    async def _schedule_half_open_transition(self) -> None:
        """
        Schedule automatic transition to half-open after recovery timeout
        
        Preconditions:
        - Circuit must be in open state
        
        Postconditions:
        - Circuit transitions to half-open after timeout
        - Transition is logged
        """
        
        await asyncio.sleep(self.config.recovery_timeout)
        
        // TEST: Check if still in open state
        if self.state == CircuitState.OPEN:
            await self._transition_to_half_open()
            logger.info(f"Circuit breaker {self.service_name} transitioned to half-open after recovery timeout")
    
    // TEST: Persist circuit breaker state
    // INPUT: Current state data
    // EXPECTED: State stored in Redis
    async def _persist_state(self) -> None:
        """
        Persist circuit breaker state to Redis
        
        Preconditions:
        - Redis connection must be available
        
        Postconditions:
        - State is stored with TTL
        - State can be recovered on restart
        """
        
        try:
            state_data = {
                "state": self.state.value,
                "failure_count": self.failure_count,
                "success_count": self.success_count,
                "last_failure_time": self.last_failure_time.isoformat() if self.last_failure_time else None,
                "last_state_change": self.last_state_change.isoformat(),
                "half_open_test_count": self.half_open_test_count
            }
            
            // TEST: Store with TTL
            await self.redis.setex(
                self.redis_key,
                3600,  // 1 hour TTL
                json.dumps(state_data)
            )
            
        except Exception as e:
            logger.warning(f"Failed to persist circuit breaker state: {e}")


// TEST: Create circuit breaker manager
// INPUT: Configuration for multiple services
// EXPECTED: Manager with service-specific breakers
class CircuitBreakerManager:
    """
    Manages circuit breakers for multiple services
    """
    
    def __init__(self, config: CircuitBreakerConfig):
        self.config = config
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
    
    // TEST: Get circuit breaker for service
    // INPUT: Service name
    // EXPECTED: Circuit breaker instance
    async def get_circuit_breaker(self, service_name: str) -> CircuitBreaker:
        """
        Get circuit breaker for specific service
        
        Preconditions:
        - Service name must be valid
        
        Postconditions:
        - Returns existing or new circuit breaker
        - Circuit breaker is configured
        """
        
        if service_name not in self.circuit_breakers:
            self.circuit_breakers[service_name] = CircuitBreaker(service_name, self.config)
        
        return self.circuit_breakers[service_name]
    
    // TEST: Check all circuit breaker states
    // INPUT: Service filter
    // EXPECTED: Health status report
    async def get_health_status(self) -> Dict[str, Any]:
        """
        Get health status of all circuit breakers
        
        Preconditions:
        - Circuit breakers must be initialized
        
        Postconditions:
        - Returns health status for all services
        - Includes open circuit count
        - Provides overall health score
        """
        
        health_status = {
            "services": {},
            "summary": {
                "total_services": len(self.circuit_breakers),
                "open_circuits": 0,
                "half_open_circuits": 0,
                "closed_circuits": 0
            }
        }
        
        for service_name, breaker in self.circuit_breakers.items():
            health_status["services"][service_name] = {
                "state": breaker.state.value,
                "failure_count": breaker.failure_count,
                "success_count": breaker.success_count,
                "last_state_change": breaker.last_state_change.isoformat()
            }
            
            // TEST: Update summary counts
            if breaker.state == CircuitState.OPEN:
                health_status["summary"]["open_circuits"] += 1
            elif breaker.state == CircuitState.HALF_OPEN:
                health_status["summary"]["half_open_circuits"] += 1
            else:
                health_status["summary"]["closed_circuits"] += 1
        
        return health_status
```

## API Contracts and Data Flow

### 5. RESTful API Contract Specification

```python
# mcp_server/contracts/api_contracts.py
"""
API Contract Specifications
Defines request/response contracts for all API endpoints
"""

// TEST: Define API response wrapper
// INPUT: Response data and metadata
// EXPECTED: Standardized API response
class APIResponse(Generic[T]):
    """
    Standardized API response wrapper
    
    Provides consistent response format across all endpoints
    """
    
    def __init__(
        self,
        data: Optional[T] = None,
        message: str = "Success",
        status: str = "success",
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.data = data
        self.message = message
        self.status = status
        self.metadata = metadata or {}
        self.timestamp = datetime.utcnow().isoformat()
    
    // TEST: Convert to JSON response
    // INPUT: Response instance
    // EXPECTED: JSON-serializable response
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert response to dictionary format
        
        Preconditions:
        - Response must be properly initialized
        
        Postconditions:
        - Returns JSON-serializable dictionary
        - Follows API response schema
        """
        
        response = {
            "status": self.status,
            "message": self.message,
            "timestamp": self.timestamp
        }
        
        // TEST: Add data if present
        if self.data is not None:
            response["data"] = self.data
        
        // TEST: Add metadata if present
        if self.metadata:
            response["metadata"] = self.metadata
        
        return response


// TEST: Define paginated response contract
// INPUT: Paginated data and pagination info
// EXPECTED: Standardized paginated response
class PaginatedResponse(APIResponse[List[T]]):
    """
    Paginated API response with metadata
    
    Provides consistent pagination across list endpoints
    """
    
    def __init__(
        self,
        data: List[T],
        total: int,
        page: int,
        page_size: int,
        has_next: bool,
        has_previous: bool
    ):
        pagination_metadata = {
            "total": total,
            "page": page,
            "page_size": page_size,
            "has_next": has_next,
            "has_previous": has_previous,
            "total_pages": (total + page_size - 1) // page_size
        }
        
        super().__init__(
            data=data,
            metadata={"pagination": pagination_metadata}
        )


// TEST: Define agent registration contract
// INPUT: Agent registration request
// EXPECTED: Validated registration data
class AgentRegistrationRequest(BaseModel):
    """
    Request contract for agent registration
    
    Validates all required fields for agent registration
    """
    
    agent_id: Optional[str] = Field(None, description="Optional custom agent ID")
    name: str = Field(..., min_length=1, max_length=100, description="Agent display name")
    type: str = Field(..., description="Agent type (bias-detector, emotion-analyzer, etc.)")
    capabilities: List[str] = Field(..., min_items=1, description="Agent capabilities")
    version: str = Field(..., pattern=r'^\d+\.\d+\.\d+$', description="Semantic version")
    endpoint_url: HttpUrl = Field(..., description="Agent API endpoint URL")
    health_check_url: HttpUrl = Field(..., description="Agent health check URL")
    websocket_url: Optional[HttpUrl] = Field(None, description="Agent WebSocket URL")
    max_concurrent_tasks: int = Field(5, ge=1, le=20, description="Maximum concurrent tasks")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    tags: List[str] = Field(default_factory=list, description="Classification tags")
    
    // TEST: Validate agent type
    // INPUT: Agent type string
    // EXPECTED: Valid type or validation error
    @validator('type')
    def validate_agent_type(cls, v):
        valid_types = ['bias-detector', 'emotion-analyzer', 'therapist', 'text-processor', 'report-generator']
        if v not in valid_types:
            raise ValueError(f"Invalid agent type. Must be one of: {valid_types}")
        return v
    
    // TEST: Validate capabilities
    // INPUT: Capabilities list
    // EXPECTED: Valid capabilities or error
    @validator('capabilities')
    def validate_capabilities(cls, v):
        valid_capabilities = [
            'bias_detection', 'emotion_analysis', 'text_processing',
            'sentiment_analysis', 'empathy_scoring', 'therapeutic_recommendations',
            'report_generation', 'language_detection'
        ]
        
        invalid_caps = set(v) - set(valid_capabilities)
        if invalid_caps:
            raise ValueError(f"Invalid capabilities: {invalid_caps}")
        
        return v
    
    // TEST: Validate URL accessibility
    // INPUT: Endpoint URLs
    // EXPECTED: Valid reachable URLs or error
    @root_validator
    def validate_urls(cls, values):
        endpoint_url = values.get('endpoint_url')
        health_check_url = values.get('health_check_url')
        
        if endpoint_url and health_check_url:
            // TEST: Ensure health check is reachable from endpoint
            if not str(health_check_url).startswith(str(endpoint_url)):
                raise ValueError("Health check URL must be reachable from endpoint URL")
        
        return values


// TEST: Define task creation contract
// INPUT: Task creation request
// EXPECTED: Validated task data
class TaskCreateRequest(BaseModel):
    """
    Request contract for task creation
    
    Validates task creation parameters and constraints
    """
    
    pipeline_id: Optional[str] = Field(None, description="Associated pipeline ID")
    stage: Optional[int] = Field(None, ge=1, le=6, description="Pipeline stage (1-6)")
    task_type: str = Field(..., description="Type of task to create")
    parameters: Dict[str, Any] = Field(..., description="Task input parameters")
    priority: int = Field(5, ge=1, le=10, description="Task priority (1-10)")
    deadline: Optional[datetime] = Field(None, description="Task deadline")
    dependencies: List[str] = Field(default_factory=list, description="Dependent task IDs")
    max_retries: int = Field(3, ge=0, le=5, description="Maximum retry attempts")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    
    // TEST: Validate task type
    // INPUT: Task type string
    // EXPECTED: Valid task type or error
    @validator('task_type')
    def validate_task_type(cls, v):
        valid_types = [
            'text_preprocessing', 'bias_detection', 'emotion_analysis',
            'empathy_scoring', 'therapeutic_recommendations', 'report_generation'
        ]
        
        if v not in valid_types:
            raise ValueError(f"Invalid task type. Must be one of: {valid_types}")
        
        return v
    
    // TEST: Validate stage and pipeline consistency
    // INPUT: Stage and pipeline ID
    // EXPECTED: Valid combination or error
    @root_validator
    def validate_pipeline_stage(cls, values):
        pipeline_id = values.get('pipeline_id')
        stage = values.get('stage')
        
        if pipeline_id and not stage:
            raise ValueError("Stage is required when pipeline_id is provided")
        
        if stage and not pipeline_id:
            raise ValueError("pipeline_id is required when stage is provided")
        
        return values


// TEST: Define task delegation contract
// INPUT: Task assignment request
// EXPECTED: Validated assignment parameters
class TaskAssignmentRequest(BaseModel):
    """
    Request contract for task assignment
    
    Validates task assignment parameters and strategy
    """
    
    agent_id: Optional[str] = Field(None, description="Specific agent to assign to")
    priority: Optional[int] = Field(None, ge=1, le=10, description="Override task priority")
    strategy: str = Field("capability_match", description="Assignment strategy")
    timeout: int = Field(30, ge=10, le=300, description="Assignment timeout in seconds")
    
    // TEST: Validate assignment strategy
    // INPUT: Strategy name
    // EXPECTED: Valid strategy or error
    @validator('strategy')
    def validate_strategy(cls, v):
        valid_strategies = ['round_robin', 'least_loaded', 'best_performance', 'capability_match']
        
        if v not in valid_strategies:
            raise ValueError(f"Invalid strategy. Must be one of: {valid_strategies}")
        
        return v


// TEST: Define WebSocket event contracts
// INPUT: Event type and payload
// EXPECTED: Validated WebSocket event
class WebSocketEvent(BaseModel):
    """
    Contract for WebSocket events
    
    Validates event structure and payload
    """
    
    event_type: str = Field(..., description="Type of WebSocket event")
    payload: Dict[str, Any] = Field(..., description="Event payload data")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat(), description="Event timestamp")
    event_id: str = Field(default_factory=generate_uuid, description="Unique event ID")
    correlation_id: Optional[str] = Field(None, description="Correlation ID for tracing")
    
    // TEST: Validate event type
    // INPUT: Event type string
    // EXPECTED: Valid event type or error
    @validator('event_type')
    def validate_event_type(cls, v):
        valid_events = [
            'agent:register', 'agent:heartbeat', 'agent:status_update',
            'task:delegate', 'task:result', 'task:progress', 'task:failed',
            'task:accepted', 'task:rejected', 'system:health_check'
        ]
        
        if v not in valid_events:
            raise ValueError(f"Invalid event type. Must be one of: {valid_events}")
        
        return v
    
    // TEST: Validate payload structure
    // INPUT: Event payload
    // EXPECTED: Valid payload or error
    @validator('payload')
    def validate_payload(cls, v, values):
        event_type = values.get('event_type')
        
        if event_type and v:
            // TEST: Validate payload based on event type
            cls._validate_payload_for_event_type(event_type, v)
        
        return v
    
    // TEST: Validate payload for specific event type
    // INPUT: Event type and payload
    // EXPECTED: Valid payload structure or error
    @staticmethod
    def _validate_payload_for_event_type(event_type: str, payload: Dict[str, Any]) -> None:
        """
        Validate payload structure based on event type
        
        Preconditions:
        - Event type must be valid
        - Payload must be provided
        
        Postconditions:
        - Validates payload structure
        - Raises ValidationError if invalid
        """
        
        validation_rules = {
            'task:delegate': {
                'required': ['task_id', 'task_type', 'parameters'],
                'types': {
                    'task_id': str,
                    'task_type': str,
                    'parameters': dict
                }
            },
            'task:result': {
                'required': ['task_id', 'success', 'data'],
                'types': {
                    'task_id': str,
                    'success': bool,
                    'data': dict
                }
            },
            'agent:register': {
                'required': ['agent_id', 'capabilities'],
                'types': {
                    'agent_id': str,
                    'capabilities': list
                }
            }
        }
        
        if event_type in validation_rules:
            rules = validation_rules[event_type]
            
            // TEST: Check required fields
            for field in rules['required']:
                if field not in payload:
                    raise ValueError(f"Missing required field '{field}' for event '{event_type}'")
            
            // TEST: Check field types
            for field, expected_type in rules['types'].items():
                if field in payload and not isinstance(payload[field], expected_type):
                    raise ValueError(f"Field '{field}' must be of type {expected_type.__name__}")
```

### 6. Data Flow and Integration Patterns

```python
# mcp_server/contracts/data_flow.py
"""
Data Flow and Integration Patterns
Defines data transformation and integration patterns between services
"""

// TEST: Define data transformation pipeline
// INPUT: Raw data and transformation steps
// EXPECTED: Transformed data or error
class DataTransformationPipeline:
    """
    Pipeline for transforming data between different formats and services
    
    Supports validation, enrichment, and format conversion
    """
    
    def __init__(self, steps: List[DataTransformationStep]):
        self.steps = steps
        self.validation_enabled = True
    
    // TEST: Execute transformation pipeline
    // INPUT: Raw data and context
    // EXPECTED: Transformed data or pipeline error
    async def transform(self, data: Any, context: Dict[str, Any]) -> Any:
        """
        Execute transformation pipeline with validation
        
        Preconditions:
        - Data must be valid input for first step
        - Context must contain required information
        
        Postconditions:
        - Data is transformed through all steps
        - Validation is performed at each step
        - Final transformed data is returned
        """
        
        current_data = data
        
        for step_index, step in enumerate(self.steps):
            try:
                // TEST: Validate input data for step
                if self.validation_enabled:
                    await step.validate_input(current_data, context)
                
                // TEST: Execute transformation step
                current_data = await step.transform(current_data, context)
                
                // TEST: Validate output data from step
                if self.validation_enabled:
                    await step.validate_output(current_data, context)
                
            except Exception as e:
                // TEST: Handle transformation error
                logger.error(f"Transformation step {step_index} failed: {e}")
                raise DataTransformationError(
                    f"Failed at transformation step {step.name}: {e}"
                )
        
        return current_data


// TEST: Define Flask service adapter
// INPUT: Flask service configuration
// EXPECTED: Service adapter with retry logic
class FlaskServiceAdapter:
    """
    Adapter for integrating with Flask-based services
    
    Provides retry logic, circuit breaker protection, and data transformation
    """
    
    def __init__(self, config: FlaskServiceConfig, circuit_breaker: CircuitBreaker):
        self.config = config
        self.circuit_breaker = circuit_breaker
        self.http_client = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=config.timeout)
        )
    
    // TEST: Analyze text with Flask service
    // INPUT: Text and analysis parameters
    // EXPECTED: Analysis result or adapter error
    @retryable(max_attempts=3, initial_delay=1.0)
    async def analyze_text(self, text: str, context: Dict[str, Any]) -> AnalysisResult:
        """
        Send text to Flask service for analysis
        
        Preconditions:
        - Text must be valid string
        - Context must contain required parameters
        - Circuit breaker must allow request
        
        Postconditions:
        - Returns analysis result
        - Result is validated and transformed
        - Errors are handled with retry logic
        """
        
        // TEST: Check circuit breaker
        if await self.circuit_breaker.is_open():
            raise CircuitBreakerOpenError(f"Circuit breaker open for {self.config.service_name}")
        
        // TEST: Prepare request payload
        payload = {
            "text": text,
            "context": context,
            "analysis_type": context.get("analysis_type", "general"),
            "options": context.get("options", {})
        }
        
        try:
            // TEST: Make HTTP request to Flask service
            async with self.http_client.post(
                f"{self.config.base_url}/analyze",
                json=payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                
                // TEST: Handle response
                if response.status == 200:
                    // TEST: Parse successful response
                    result = await response.json()
                    
                    // TEST: Validate result structure
                    validated_result = await self._validate_analysis_result(result)
                    
                    // TEST: Transform to standard format
                    transformed_result = await self._transform_analysis_result(validated_result)
                    
                    // TEST: Record success in circuit breaker
                    await self.circuit_breaker.record_success()
                    
                    return transformed_result
                    
                elif response.status >= 500:
                    // TEST: Server error - retryable
                    error_text = await response.text()
                    raise ExternalServiceError(
                        self.config.service_name,
                        response.status,
                        error_text
                    )
                    
                else:
                    // TEST: Client error - not retryable
                    error_text = await response.text()
                    raise ExternalServiceError(
                        self.config.service_name,
                        response.status,
                        error_text
                    )
                    
        except Exception as e:
            // TEST: Record failure in circuit breaker
            await self.circuit_breaker.record_failure()
            
            // TEST: Re-raise for retry logic
            raise
    
    // TEST: Validate analysis result structure
    // INPUT: Raw analysis result
    // EXPECTED: Validated result or error
    async def _validate_analysis_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate Flask service analysis result
        
        Preconditions:
        - Result must be dictionary
        
        Postconditions:
        - Returns validated result
        - Raises error if validation fails
        """
        
        required_fields = ["analysis", "confidence", "processing_time"]
        
        // TEST: Check required fields
        for field in required_fields:
            if field not in result:
                raise ValidationError(f"Missing required field '{field}' in analysis result")
        
        // TEST: Validate field types and ranges
        if not isinstance(result["confidence"], (int, float)) or not (0 <= result["confidence"] <= 1):
            raise ValidationError("Confidence must be a number between 0 and 1")
        
        if not isinstance(result["processing_time"], (int, float)) or result["processing_time"] < 0:
            raise ValidationError("Processing time must be a non-negative number")
        
        return result
    
    // TEST: Transform result to standard format
    // INPUT: Validated Flask result
    // EXPECTED: Standardized analysis result
    async def _transform_analysis_result(self, result: Dict[str, Any]) -> AnalysisResult:
        """
        Transform Flask result to standard MCP format
        
        Preconditions:
        - Result must be validated
        
        Postconditions:
        - Returns standardized AnalysisResult
        - Data is properly formatted and typed
        """
        
        return AnalysisResult(
            success=True,
            processing_time=result["processing_time"],
            agent_id="flask-service",  // Flask service identifier
            data={
                "analysis": result["analysis"],
                "confidence": result["confidence"],
                "details": result.get("details", {})
            },
            confidence_scores=[
                ConfidenceScore(
                    metric="overall",
                    score=result["confidence"],
                    explanation="Confidence score from Flask analysis service"
                )
            ]
        )


// TEST: Define pipeline orchestration data flow
// INPUT: Pipeline configuration and input data
// EXPECTED: Orchestrated pipeline execution
class PipelineOrchestrationFlow:
    """
    Data flow for 6-stage pipeline orchestration
    
    Coordinates data flow between stages and manages dependencies
    """
    
    def __init__(self, pipeline_service: PipelineService, task_service: TaskService):
        self.pipeline_service = pipeline_service
        self.task_service = task_service
        self.stage_flows = {
            1: TextPreprocessingFlow(),
            2: BiasDetectionFlow(),
            3: EmotionAnalysisFlow(),
            4: EmpathyScoringFlow(),
            5: TherapeuticRecommendationsFlow(),
            6: ReportGenerationFlow()
        }
    
    // TEST: Execute pipeline with data flow
    // INPUT: Pipeline input and configuration
    // EXPECTED: Pipeline result or orchestration error
    async def execute_pipeline(self, pipeline_input: PipelineInput) -> PipelineResult:
        """
        Execute 6-stage pipeline with proper data flow
        
        Preconditions:
        - Pipeline input must be valid
        - All required services must be available
        
        Postconditions:
        - Pipeline stages are executed in order
        - Data flows correctly between stages
        - Final result is compiled and returned
        """
        
        // TEST: Create pipeline instance
        pipeline = await self.pipeline_service.create_pipeline(pipeline_input)
        
        // TEST: Execute stages in dependency order
        stage_results = {}
        
        for stage_num in range(1, 7):
            // TEST: Check if stage is ready (dependencies satisfied)
            if await self._is_stage_ready(pipeline, stage_num, stage_results):
                
                // TEST: Execute stage with input from previous stages
                stage_input = await self._prepare_stage_input(
                    pipeline,
                    stage_num,
                    stage_results
                )
                
                // TEST: Execute stage tasks
                stage_result = await self._execute_stage(
                    pipeline,
                    stage_num,
                    stage_input
                )
                
                stage_results[stage_num] = stage_result
                
                // TEST: Update pipeline progress
                await self.pipeline_service.update_stage_progress(
                    pipeline.pipeline_id,
                    stage_num,
                    100  // Stage completed
                )
            
            else:
                // TEST: Stage not ready, skip for now
                logger.info(f"Stage {stage_num} not ready, skipping")
        
        // TEST: Compile final results
        final_result = await self._compile_pipeline_results(
            pipeline,
            stage_results
        )
        
        // TEST: Mark pipeline as completed
        await self.pipeline_service.complete_pipeline(
            pipeline.pipeline_id,
            final_result
        )
        
        return final_result
    
    // TEST: Prepare stage input from previous results
    // INPUT: Pipeline and previous stage results
    // EXPECTED: Consolidated stage input
    async def _prepare_stage_input(
        self,
        pipeline: Pipeline,
        stage_num: int,
        previous_results: Dict[int, Any]
    ) -> Dict[str, Any]:
        """
        Prepare input data for pipeline stage
        
        Preconditions:
        - Stage number must be valid (1-6)
        - Previous results must be available
        
        Postconditions:
        - Returns consolidated input for stage
        - Includes original pipeline input
        - Includes results from dependency stages
        """
        
        stage_input = {
            "original_input": pipeline.input_data,
            "stage": stage_num,
            "pipeline_id": pipeline.pipeline_id
        }
        
        // TEST: Add results from dependency stages
        stage_config = pipeline.stages[stage_num - 1]  // 0-indexed
        for dep_stage in stage_config.dependencies:
            if dep_stage in previous_results:
                stage_input[f"stage_{dep_stage}_result"] = previous_results[dep_stage]
        
        return stage_input
```

This comprehensive specification provides error handling strategies, retry mechanisms, circuit breaker patterns, and detailed API contracts with extensive TDD anchors. The design ensures reliability, scalability, and maintainability while providing clear integration patterns and data flow specifications for the MCP server architecture.
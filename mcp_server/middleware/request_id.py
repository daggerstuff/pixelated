"""
Request ID Middleware

Adds unique request identifiers for tracing and debugging.
Follows the established patterns from the Pixelated platform.
"""

import re
import uuid

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

logger = structlog.get_logger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware for adding unique request identifiers.
    
    Adds a unique request ID to each incoming request for tracing and debugging.
    The request ID is generated if not provided by the client and is included
    in the response headers.
    """

    def __init__(self, app, header_name: str = "X-Request-ID") -> None:
        """
        Initialize the request ID middleware.
        
        Args:
            app: The FastAPI application
            header_name: The name of the request ID header
        """
        super().__init__(app)
        self.header_name = header_name

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """
        Process incoming request and add request ID.
        
        Preconditions:
        - Request must be a valid FastAPI Request object
        - call_next must be a valid RequestResponseEndpoint
        
        Postconditions:
        - Request ID is generated if not provided
        - Request ID is attached to request state
        - Request ID is included in response headers
        - Request is logged with request ID
        
        Args:
            request: The incoming request
            call_next: The next middleware or endpoint
            
        Returns:
            Response: The response with request ID header
        """
        # Extract or generate request ID
        request_id = self._get_request_id(request)

        # Attach request ID to request state
        request.state.request_id = request_id

        # Create structured logger with request ID
        request_logger = logger.bind(request_id=request_id)

        # Log request start
        request_logger.info(
            "Request started",
            method=request.method,
            url=str(request.url),
            client_host=request.client.host if request.client else None
        )

        try:
            # Process request
            response = await call_next(request)

            # Add request ID to response headers
            response.headers[self.header_name] = request_id

            # Log request completion
            request_logger.info(
                "Request completed",
                status_code=response.status_code
            )

            return response

        except Exception as e:
            # Log request failure
            request_logger.error(
                "Request failed",
                error=str(e),
                error_type=type(e).__name__
            )
            raise

    def _get_request_id(self, request: Request) -> str:
        """
        Extract or generate request ID.
        
        Args:
            request: The incoming request
            
        Returns:
            str: The request ID
        """
        # Check if request ID is provided in headers
        provided_id = request.headers.get(self.header_name)

        if provided_id and self._is_valid_request_id(provided_id):
            return provided_id

        # Generate new request ID
        return self._generate_request_id()

    def _is_valid_request_id(self, request_id: str) -> bool:
        """
        Validate request ID format.
        
        Args:
            request_id: The request ID to validate
            
        Returns:
            bool: True if valid, False otherwise
        """
        if not request_id:
            return False

        # Check length (should be reasonable)
        if len(request_id) > 128:
            return False

        # Check for valid characters (alphanumeric and common separators)
        if not re.match(r"^[a-zA-Z0-9\-_.]+$", request_id):
            return False

        return True

    def _generate_request_id(self) -> str:
        """
        Generate a new request ID.
        
        Returns:
            str: A new unique request ID
        """
        return str(uuid.uuid4())


# Import regex for validation

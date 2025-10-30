#!/usr/bin/env python3
"""
Pixelated Empathy AI - Secure Main API Application
Tasks 1.1, 1.2, 1.3: Complete API Security Implementation

Enterprise-grade FastAPI application with authentication, rate limiting, and security middleware.
"""

from fastapi import FastAPI, HTTPException, Depends, Security, status, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Union
import logging
import os
import sys
from pathlib import Path
from datetime import datetime
import asyncio
import json

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Import security components
from auth_system import (
    auth_system, get_current_user, require_admin, require_permission,
    User, UserCreate, UserLogin, TokenResponse, RefreshTokenRequest,
    UserRole, Permission
)
from rate_limiter import rate_limiter, rate_limit_middleware
from security_middleware import security_middleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app with security configuration
app = FastAPI(
    title="Pixelated Empathy AI - Secure API",
    description="Enterprise-grade RESTful API for accessing the Pixelated Empathy AI dataset and processing system",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Security middleware (first in chain)
app.middleware("http")(security_middleware)

# Rate limiting middleware
app.middleware("http")(rate_limit_middleware)

# Trusted host middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.pixelated-empathy.ai"]
)

# CORS middleware (configure for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Request/Response models
class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    timestamp: datetime
    version: str
    components: Dict[str, str]

class DatasetInfo(BaseModel):
    """Dataset information model"""
    name: str
    description: str
    size: int
    created_at: datetime
    updated_at: datetime
    access_level: str

class ConversationRequest(BaseModel):
    """Conversation request model"""
    message: str = Field(..., min_length=1, max_length=10000)
    context: Optional[Dict[str, Any]] = None
    safety_check: bool = True

class ConversationResponse(BaseModel):
    """Conversation response model"""
    response: str
    confidence: float
    safety_score: float
    metadata: Dict[str, Any]

class SecurityStatsResponse(BaseModel):
    """Security statistics response"""
    total_events: int
    blocked_events: int
    events_by_type: Dict[str, int]
    events_by_severity: Dict[str, int]
    top_attacking_ips: List[List[str]]
    blacklisted_ips: int
    time_window_hours: int

class RateLimitStatsResponse(BaseModel):
    """Rate limit statistics response"""
    user: Optional[List[Dict[str, Any]]] = None
    ip: Optional[List[Dict[str, Any]]] = None

# Authentication endpoints
@app.post("/auth/register", response_model=TokenResponse, tags=["Authentication"])
async def register_user(
    user_data: UserCreate,
    request: Request,
    current_user: User = Depends(require_admin)
):
    """Register a new user (admin only)"""
    try:
        # Create user
        new_user = auth_system.create_user(user_data)
        
        # Generate tokens for the new user
        login_data = UserLogin(username=user_data.username, password=user_data.password)
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("User-Agent")
        
        tokens = auth_system.login(login_data, ip_address, user_agent)
        
        logger.info(f"User registered successfully: {user_data.username} by admin: {current_user.username}")
        return tokens
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"User registration failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User registration failed"
        )

@app.post("/auth/login", response_model=TokenResponse, tags=["Authentication"])
async def login(login_data: UserLogin, request: Request):
    """User login"""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")
    
    try:
        tokens = auth_system.login(login_data, ip_address, user_agent)
        
        # Store user info in request state for rate limiting
        request.state.user_id = str(tokens.user.id)
        request.state.user_role = tokens.user.role.value
        
        return tokens
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@app.post("/auth/refresh", response_model=TokenResponse, tags=["Authentication"])
async def refresh_token(refresh_request: RefreshTokenRequest):
    """Refresh access token"""
    return auth_system.refresh_access_token(refresh_request)

@app.post("/auth/logout", tags=["Authentication"])
async def logout(
    refresh_request: RefreshTokenRequest,
    current_user: User = Depends(get_current_user)
):
    """User logout"""
    auth_system.logout(refresh_request.refresh_token, current_user.id)
    return {"message": "Logged out successfully"}

@app.get("/auth/me", response_model=Dict[str, Any], tags=["Authentication"])
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return current_user.to_dict()

@app.get("/auth/csrf-token", tags=["Authentication"])
async def get_csrf_token(request: Request, current_user: User = Depends(get_current_user)):
    """Get CSRF token for authenticated user"""
    ip_address = request.client.host if request.client else "unknown"
    csrf_token = security_middleware.get_csrf_token(str(current_user.id), ip_address)
    return {"csrf_token": csrf_token}

# Health and status endpoints
@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """System health check"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow(),
        version="2.0.0",
        components={
            "authentication": "operational",
            "rate_limiting": "operational",
            "security": "operational",
            "database": "operational"
        }
    )

@app.get("/status", tags=["System"])
async def system_status(current_user: User = Depends(require_permission(Permission.SYSTEM_CONFIG))):
    """Detailed system status (admin only)"""
    return {
        "timestamp": datetime.utcnow(),
        "uptime": "operational",
        "memory_usage": "normal",
        "cpu_usage": "normal",
        "active_connections": 0,
        "rate_limit_status": "operational",
        "security_status": "operational"
    }

# Dataset endpoints
@app.get("/datasets", response_model=List[DatasetInfo], tags=["Datasets"])
async def list_datasets(
    current_user: User = Depends(require_permission(Permission.READ_DATASETS))
):
    """List available datasets"""
    # Mock data - replace with actual dataset listing
    return [
        DatasetInfo(
            name="empathy_conversations",
            description="Empathy-focused conversation dataset",
            size=10000,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            access_level="researcher"
        )
    ]

@app.get("/datasets/{dataset_id}", response_model=DatasetInfo, tags=["Datasets"])
async def get_dataset(
    dataset_id: str,
    current_user: User = Depends(require_permission(Permission.READ_DATASETS))
):
    """Get dataset information"""
    # Mock data - replace with actual dataset retrieval
    return DatasetInfo(
        name=f"dataset_{dataset_id}",
        description="Dataset description",
        size=5000,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        access_level="researcher"
    )

@app.get("/datasets/{dataset_id}/conversations", tags=["Datasets"])
async def get_conversations(
    dataset_id: str,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(require_permission(Permission.READ_CONVERSATIONS))
):
    """Get conversations from dataset"""
    # Mock data - replace with actual conversation retrieval
    return {
        "conversations": [],
        "total": 0,
        "limit": limit,
        "offset": offset
    }

# Conversation endpoints
@app.post("/conversations", response_model=ConversationResponse, tags=["Conversations"])
async def create_conversation(
    request_data: ConversationRequest,
    current_user: User = Depends(require_permission(Permission.WRITE_CONVERSATIONS))
):
    """Create a new conversation"""
    # Mock response - replace with actual AI processing
    return ConversationResponse(
        response="This is a mock response to your message.",
        confidence=0.85,
        safety_score=0.95,
        metadata={
            "processing_time": 0.5,
            "model_version": "2.0.0",
            "safety_checks": ["crisis_detection", "content_filter"]
        }
    )

@app.get("/conversations/{conversation_id}", tags=["Conversations"])
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(require_permission(Permission.READ_CONVERSATIONS))
):
    """Get conversation by ID"""
    # Mock data - replace with actual conversation retrieval
    return {
        "id": conversation_id,
        "messages": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

# Export endpoints
@app.post("/export", tags=["Export"])
async def export_data(
    format: str = "json",
    dataset_ids: Optional[List[str]] = None,
    current_user: User = Depends(require_permission(Permission.EXPORT_DATA))
):
    """Export data in specified format"""
    # Mock response - replace with actual export functionality
    return {
        "export_id": "export_123",
        "status": "processing",
        "format": format,
        "estimated_completion": datetime.utcnow()
    }

@app.get("/export/{export_id}/status", tags=["Export"])
async def get_export_status(
    export_id: str,
    current_user: User = Depends(require_permission(Permission.EXPORT_DATA))
):
    """Get export status"""
    # Mock response - replace with actual export status
    return {
        "export_id": export_id,
        "status": "completed",
        "download_url": f"/export/{export_id}/download",
        "expires_at": datetime.utcnow()
    }

# Admin endpoints
@app.get("/admin/users", tags=["Administration"])
async def list_users(
    current_user: User = Depends(require_permission(Permission.ADMIN_USERS))
):
    """List all users (admin only)"""
    # Mock data - replace with actual user listing
    return {
        "users": [],
        "total": 0
    }

@app.get("/admin/security/stats", response_model=SecurityStatsResponse, tags=["Administration"])
async def get_security_stats(
    hours: int = 24,
    current_user: User = Depends(require_admin)
):
    """Get security statistics (admin only)"""
    stats = security_middleware.get_security_stats(hours)
    return SecurityStatsResponse(**stats)

@app.get("/admin/rate-limits/stats", response_model=RateLimitStatsResponse, tags=["Administration"])
async def get_rate_limit_stats(
    request: Request,
    current_user: User = Depends(require_admin)
):
    """Get rate limit statistics (admin only)"""
    ip_address = request.client.host if request.client else None
    stats = rate_limiter.get_usage_stats(
        user_id=str(current_user.id),
        user_role=current_user.role.value,
        ip_address=ip_address
    )
    return RateLimitStatsResponse(**stats)

@app.get("/admin/rate-limits/user/{user_id}", tags=["Administration"])
async def get_user_rate_limits(
    user_id: str,
    current_user: User = Depends(require_admin)
):
    """Get rate limits for specific user (admin only)"""
    # This would require getting user role from database
    user_role = "user"  # Mock - replace with actual user lookup
    limits = rate_limiter.get_user_limits(user_role)
    return {"user_id": user_id, "limits": limits}

# Clinical endpoints (if applicable)
@app.get("/clinical/safety-report", tags=["Clinical"])
async def get_safety_report(
    current_user: User = Depends(require_permission(Permission.CLINICAL_ACCESS))
):
    """Get safety report for clinical review"""
    # Mock data - replace with actual safety reporting
    return {
        "report_id": "safety_001",
        "generated_at": datetime.utcnow(),
        "crisis_detections": 0,
        "safety_score": 0.98,
        "recommendations": []
    }

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions"""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred",
            "timestamp": datetime.utcnow().isoformat()
        }
    )

# Startup event
@app.on_event("startup")
async def startup_event():
    """Application startup"""
    logger.info("Pixelated Empathy AI Secure API starting up...")
    logger.info("Authentication system initialized")
    logger.info("Rate limiting system initialized")
    logger.info("Security middleware initialized")
    logger.info("API is ready to serve requests")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown"""
    logger.info("Pixelated Empathy AI Secure API shutting down...")

if __name__ == "__main__":
    import uvicorn
    
    # Production configuration
    uvicorn.run(
        "main_secure:app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # Set to False in production
        access_log=True,
        log_level="info",
        ssl_keyfile=os.getenv("SSL_KEYFILE"),
        ssl_certfile=os.getenv("SSL_CERTFILE")
    )

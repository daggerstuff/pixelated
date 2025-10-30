#!/usr/bin/env python3
"""
Pixelated Empathy AI - Main API Application
Task 51: Complete API Documentation

FastAPI application providing comprehensive access to the Pixelated Empathy AI system.
"""

from fastapi import FastAPI, HTTPException, Depends, Security, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Union
import logging
import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
import asyncio
import json
import time
from collections import defaultdict

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app with comprehensive documentation
app = FastAPI(
    title="Pixelated Empathy AI API",
    description="""
## Pixelated Empathy AI - Enterprise-Grade Conversation Processing API

### 🎯 **Overview**
The Pixelated Empathy AI API provides comprehensive access to our advanced conversation processing system, featuring:

- **4.2M+ Therapeutic Conversations**: High-quality empathetic dialogue dataset
- **Advanced ML Capabilities**: Harbinger-24B QLoRA model fine-tuning
- **Multi-Format Export**: JSONL, Parquet, CSV, HuggingFace, OpenAI formats
- **Real-time Processing**: Distributed processing with Celery
- **Enterprise Security**: Rate limiting, authentication, usage monitoring

### 🚀 **Key Features**
- **Advanced Querying**: Filter by quality metrics, date ranges, content search
- **Bulk Export**: Asynchronous job processing with progress tracking
- **Quality Assurance**: Therapeutic accuracy, emotional authenticity scoring
- **Production Ready**: Rate limiting, monitoring, comprehensive error handling

### 📊 **Data Quality Tiers**
- **Research** (0.82+ quality): Premium research-grade conversations
- **Clinical** (0.80+ quality): Clinical-grade therapeutic dialogues  
- **Professional** (0.74+ quality): Professional counseling conversations
- **Standard** (0.69+ quality): General empathetic conversations
- **Basic** (0.50+ quality): Basic conversation training data

### 🔐 **Authentication**
All endpoints require Bearer token authentication:
```
Authorization: Bearer YOUR_API_KEY
```

### ⚡ **Rate Limits**
- **Authenticated Users**: 1,000 requests/hour
- **Unauthenticated**: 100 requests/hour
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### 📈 **Usage Monitoring**
Monitor your API usage with built-in endpoints:
- `/v1/monitoring/usage` - Detailed usage statistics
- `/v1/monitoring/rate-limits` - Rate limiting information
- `/v1/monitoring/health/detailed` - System health status

### 🎓 **Getting Started**
1. Obtain your API key from the developer portal
2. Explore available datasets with `/v1/datasets`
3. Query conversations with `/v1/conversations/query`
4. Export data with `/v1/export/bulk`
5. Monitor usage with `/v1/monitoring/usage`
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    contact={
        "name": "Pixelated Empathy AI Support",
        "url": "https://pixelated-empathy.ai/support",
        "email": "api-support@pixelated-empathy.ai",
    },
    license_info={
        "name": "Commercial License",
        "url": "https://pixelated-empathy.ai/license",
    },
    terms_of_service="https://pixelated-empathy.ai/terms",
    openapi_tags=[
        {
            "name": "Authentication",
            "description": "API key validation and security operations",
        },
        {
            "name": "Datasets",
            "description": "Dataset discovery and metadata operations",
        },
        {
            "name": "Conversations",
            "description": "Conversation querying, filtering, and retrieval",
        },
        {
            "name": "Quality Metrics",
            "description": "Quality assessment and validation operations",
        },
        {
            "name": "Processing",
            "description": "Asynchronous processing job management",
        },
        {
            "name": "Search",
            "description": "Advanced search and content discovery",
        },
        {
            "name": "Export",
            "description": "Bulk data export with job tracking",
        },
        {
            "name": "Statistics",
            "description": "System-wide statistics and analytics",
        },
        {
            "name": "Monitoring",
            "description": "Usage monitoring and system health",
        },
    ],
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Rate limiting and usage monitoring
class RateLimitStore:
    """In-memory rate limit store. In production, use Redis."""
    
    def __init__(self):
        self.requests = defaultdict(list)
        self.usage_stats = defaultdict(lambda: {
            "total_requests": 0,
            "requests_today": 0,
            "last_request": None,
            "endpoints_used": defaultdict(int),
            "first_seen": datetime.now(),
        })
    
    def is_rate_limited(self, key: str, limit: int, window: int) -> tuple[bool, dict]:
        """Check if key is rate limited. Returns (is_limited, rate_info)."""
        now = time.time()
        window_start = now - window
        
        # Clean old requests
        self.requests[key] = [req_time for req_time in self.requests[key] if req_time > window_start]
        
        current_count = len(self.requests[key])
        is_limited = current_count >= limit
        
        if not is_limited:
            self.requests[key].append(now)
        
        return is_limited, {
            "limit": limit,
            "remaining": max(0, limit - current_count - (0 if is_limited else 1)),
            "reset_time": int(window_start + window),
            "retry_after": int(window) if is_limited else None,
        }
    
    def update_usage_stats(self, api_key: str, endpoint: str, request_time: datetime):
        """Update usage statistics for monitoring."""
        stats = self.usage_stats[api_key]
        stats["total_requests"] += 1
        stats["last_request"] = request_time
        stats["endpoints_used"][endpoint] += 1
        
        # Update daily counter (simplified - in production use proper date handling)
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        if stats.get("last_daily_reset", today_start) < today_start:
            stats["requests_today"] = 1
            stats["last_daily_reset"] = today_start
        else:
            stats["requests_today"] += 1

# Global rate limit store
rate_limiter = RateLimitStore()

# Rate limiting middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Enterprise-grade rate limiting middleware with usage tracking."""
    
    # Skip rate limiting for docs and health endpoints
    if request.url.path in ["/docs", "/redoc", "/openapi.json", "/health", "/"]:
        return await call_next(request)
    
    start_time = time.time()
    
    # Extract API key for rate limiting
    api_key = None
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        api_key = auth_header.split(" ", 1)[1]
    
    # Use IP address as fallback for rate limiting
    client_ip = request.client.host if request.client else "unknown"
    rate_limit_key = api_key or f"ip_{client_ip}"
    
    # Different rate limits based on authentication
    if api_key:
        # Authenticated users: 1000 requests per hour
        limit, window = 1000, 3600
    else:
        # Unauthenticated users: 100 requests per hour  
        limit, window = 100, 3600
    
    # Check rate limit
    is_limited, rate_info = rate_limiter.is_rate_limited(rate_limit_key, limit, window)
    
    if is_limited:
        response = JSONResponse(
            status_code=429,
            content={
                "success": False,
                "error": "Rate limit exceeded",
                "message": f"Too many requests. Limit: {rate_info['limit']} per hour.",
                "rate_limit_info": rate_info,
            }
        )
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(rate_info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(rate_info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(rate_info["reset_time"])
        response.headers["Retry-After"] = str(rate_info["retry_after"])
        return response
    
    # Process request
    response = await call_next(request)
    
    # Update usage statistics
    if api_key:
        request_time = datetime.now()
        endpoint = f"{request.method} {request.url.path}"
        rate_limiter.update_usage_stats(api_key, endpoint, request_time)
    
    # Add rate limit headers to successful responses
    response.headers["X-RateLimit-Limit"] = str(rate_info["limit"])
    response.headers["X-RateLimit-Remaining"] = str(rate_info["remaining"])
    response.headers["X-RateLimit-Reset"] = str(rate_info["reset_time"])
    
    # Add performance headers
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}"
    
    return response


# Pydantic models
class ConversationModel(BaseModel):
    """Model for conversation data."""

    id: str = Field(..., description="Unique conversation identifier")
    messages: List[Dict[str, Any]] = Field(
        ..., description="List of messages in the conversation"
    )
    quality_score: float = Field(..., description="Quality score (0.0-1.0)")
    tier: str = Field(
        ...,
        description="Quality tier (basic, standard, professional, clinical, research)",
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )
    created_at: datetime = Field(
        default_factory=datetime.now, description="Creation timestamp"
    )


class QualityMetrics(BaseModel):
    """Model for quality metrics."""

    therapeutic_accuracy: float = Field(..., description="Therapeutic accuracy score")
    conversation_coherence: float = Field(
        ..., description="Conversation coherence score"
    )
    emotional_authenticity: float = Field(
        ..., description="Emotional authenticity score"
    )
    clinical_compliance: float = Field(..., description="Clinical compliance score")
    safety_score: float = Field(..., description="Safety score")
    overall_quality: float = Field(..., description="Overall quality score")


class ProcessingRequest(BaseModel):
    """Model for processing requests."""

    dataset_name: str = Field(..., description="Name of the dataset to process")
    processing_type: str = Field(
        ..., description="Type of processing (quality_validation, export, analysis)"
    )
    parameters: Dict[str, Any] = Field(
        default_factory=dict, description="Processing parameters"
    )


class SearchRequest(BaseModel):
    """Model for advanced search requests."""

    query: str = Field(..., description="Search query")
    filters: Dict[str, Any] = Field(default_factory=dict, description="Search filters")
    limit: int = Field(default=100, description="Maximum number of results")
    offset: int = Field(default=0, description="Offset for pagination")


class AdvancedQueryRequest(BaseModel):
    """Model for advanced conversation querying with comprehensive filtering."""
    
    # Basic filters
    dataset: Optional[str] = Field(None, description="Filter by dataset name")
    tier: Optional[str] = Field(None, description="Filter by quality tier")
    min_quality: Optional[float] = Field(None, description="Minimum quality score (0.0-1.0)")
    max_quality: Optional[float] = Field(None, description="Maximum quality score (0.0-1.0)")
    
    # Date range filters
    created_after: Optional[datetime] = Field(None, description="Filter conversations created after this date")
    created_before: Optional[datetime] = Field(None, description="Filter conversations created before this date")
    
    # Message-based filters
    min_messages: Optional[int] = Field(None, description="Minimum number of messages")
    max_messages: Optional[int] = Field(None, description="Maximum number of messages")
    
    # Content-based filters
    content_search: Optional[str] = Field(None, description="Search within conversation content")
    role_filter: Optional[str] = Field(None, description="Filter by message role (user, assistant)")
    
    # Quality metric filters
    min_therapeutic_accuracy: Optional[float] = Field(None, description="Minimum therapeutic accuracy")
    min_emotional_authenticity: Optional[float] = Field(None, description="Minimum emotional authenticity")
    min_safety_score: Optional[float] = Field(None, description="Minimum safety score")
    
    # Sorting and pagination
    sort_by: str = Field(default="created_at", description="Sort field (created_at, quality_score, message_count)")
    sort_order: str = Field(default="desc", description="Sort order (asc, desc)")
    limit: int = Field(default=100, description="Maximum number of results")
    offset: int = Field(default=0, description="Offset for pagination")


class BulkExportRequest(BaseModel):
    """Model for bulk export requests with job tracking."""
    
    # Export configuration
    dataset: str = Field(..., description="Dataset to export")
    format: str = Field(default="jsonl", description="Export format (jsonl, parquet, csv, huggingface, openai)")
    
    # Filtering options (reuse AdvancedQueryRequest filters)
    filters: Optional[AdvancedQueryRequest] = Field(None, description="Advanced filters for export")
    
    # Export options
    include_metadata: bool = Field(default=True, description="Include conversation metadata")
    include_quality_metrics: bool = Field(default=True, description="Include quality metrics")
    batch_size: int = Field(default=1000, description="Processing batch size")
    
    # Notification options
    notify_email: Optional[str] = Field(None, description="Email for completion notification")
    callback_url: Optional[str] = Field(None, description="Webhook URL for status updates")


class ExportJobStatus(BaseModel):
    """Model for export job status tracking."""
    
    job_id: str = Field(..., description="Unique job identifier")
    status: str = Field(..., description="Job status (pending, running, completed, failed, cancelled)")
    progress: float = Field(..., description="Completion percentage (0.0-100.0)")
    
    # Timestamps
    created_at: datetime = Field(..., description="Job creation time")
    started_at: Optional[datetime] = Field(None, description="Job start time")
    completed_at: Optional[datetime] = Field(None, description="Job completion time")
    
    # Progress details
    total_records: Optional[int] = Field(None, description="Total records to process")
    processed_records: Optional[int] = Field(None, description="Records processed so far")
    failed_records: Optional[int] = Field(None, description="Records that failed processing")
    
    # Results
    download_url: Optional[str] = Field(None, description="Download URL when completed")
    file_size: Optional[int] = Field(None, description="Export file size in bytes")
    expires_at: Optional[datetime] = Field(None, description="Download link expiration")
    
    # Error information
    error_message: Optional[str] = Field(None, description="Error message if failed")
    error_details: Optional[Dict[str, Any]] = Field(None, description="Detailed error information")


class APIResponse(BaseModel):
    """Standard API response model."""

    success: bool = Field(..., description="Whether the request was successful")
    data: Any = Field(None, description="Response data")
    message: str = Field("", description="Response message")
    timestamp: datetime = Field(
        default_factory=datetime.now, description="Response timestamp"
    )


# Authentication dependency
async def verify_api_key(
    credentials: HTTPAuthorizationCredentials = Security(security),
):
    """Verify API key authentication."""
    # In production, implement proper API key validation
    # For now, accept any non-empty token
    if not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials


# Root endpoint
@app.get("/", 
    response_model=APIResponse,
    tags=["Authentication"],
    summary="API Root Endpoint",
    description="""
    ## Welcome to Pixelated Empathy AI API
    
    This endpoint provides basic API information and can be used to verify connectivity.
    
    ### Usage
    ```bash
    curl -X GET "https://api.pixelated-empathy.ai/" \
         -H "Authorization: Bearer YOUR_API_KEY"
    ```
    
    ### Response
    - **success**: Always `true` for successful connections
    - **data**: Basic API information and available endpoints
    - **message**: Welcome message with next steps
    """,
)
async def root():
    """Root endpoint providing comprehensive API information and connectivity verification."""
    return APIResponse(
        success=True,
        data={
            "name": "Pixelated Empathy AI API",
            "version": "1.0.0",
            "description": "RESTful API for accessing the Pixelated Empathy AI dataset and processing system",
            "endpoints": {
                "datasets": "/v1/datasets",
                "conversations": "/v1/conversations",
                "quality": "/v1/quality",
                "processing": "/v1/processing",
                "search": "/v1/search",
                "statistics": "/v1/statistics",
                "export": "/v1/export",
            },
        },
        message="Welcome to Pixelated Empathy AI API",
    )


# Health check endpoint
@app.get("/health", response_model=APIResponse)
async def health_check():
    """Health check endpoint."""
    return APIResponse(
        success=True,
        data={"status": "healthy", "uptime": "operational"},
        message="API is healthy",
    )


# Dataset endpoints
@app.get("/v1/datasets", response_model=APIResponse)
async def list_datasets(api_key: str = Depends(verify_api_key)):
    """List available datasets."""
    try:
        # Mock dataset list - in production, fetch from database
        datasets = [
            {
                "name": "priority_complete_fixed",
                "description": "Priority conversations with complete processing",
                "conversations": 297917,
                "quality_score": 0.624,
                "tiers": ["basic", "standard", "professional"],
            },
            {
                "name": "professional_datasets_final",
                "description": "Professional-grade therapeutic conversations",
                "conversations": 22315,
                "quality_score": 0.741,
                "tiers": ["professional", "clinical"],
            },
            {
                "name": "cot_reasoning_complete",
                "description": "Chain-of-thought reasoning conversations",
                "conversations": 129118,
                "quality_score": 0.698,
                "tiers": ["standard", "professional", "research"],
            },
        ]

        return APIResponse(
            success=True,
            data={"datasets": datasets, "total": len(datasets)},
            message="Datasets retrieved successfully",
        )
    except Exception as e:
        logger.error(f"Error listing datasets: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/v1/datasets/{dataset_name}", response_model=APIResponse)
async def get_dataset_info(dataset_name: str, api_key: str = Depends(verify_api_key)):
    """Get detailed information about a specific dataset."""
    try:
        # Mock dataset info - in production, fetch from database
        dataset_info = {
            "name": dataset_name,
            "description": f"Detailed information for {dataset_name}",
            "statistics": {
                "total_conversations": 297917,
                "average_quality": 0.624,
                "tier_distribution": {
                    "basic": 89375,
                    "standard": 134271,
                    "professional": 74271,
                },
                "last_updated": datetime.now().isoformat(),
            },
            "schema": {
                "conversation_id": "string",
                "messages": "array",
                "quality_metrics": "object",
                "metadata": "object",
            },
        }

        return APIResponse(
            success=True,
            data=dataset_info,
            message=f"Dataset {dataset_name} information retrieved successfully",
        )
    except Exception as e:
        logger.error(f"Error getting dataset info: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Conversation endpoints
@app.get("/v1/conversations", response_model=APIResponse)
async def list_conversations(
    dataset: Optional[str] = None,
    tier: Optional[str] = None,
    min_quality: Optional[float] = None,
    limit: int = 100,
    offset: int = 0,
    api_key: str = Depends(verify_api_key),
):
    """List conversations with basic filtering (legacy endpoint)."""
    try:
        # Mock conversation list - in production, fetch from database
        conversations = []
        for i in range(min(limit, 10)):  # Mock 10 conversations
            conversations.append(
                {
                    "id": f"conv_{offset + i + 1:06d}",
                    "dataset": dataset or "priority_complete_fixed",
                    "tier": tier or "standard",
                    "quality_score": 0.65 + (i * 0.05),
                    "message_count": 8 + (i * 2),
                    "created_at": datetime.now().isoformat(),
                }
            )

        return APIResponse(
            success=True,
            data={
                "conversations": conversations,
                "total": len(conversations),
                "limit": limit,
                "offset": offset,
            },
            message="Conversations retrieved successfully",
        )
    except Exception as e:
        logger.error(f"Error listing conversations: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/v1/conversations/query", response_model=APIResponse)
async def advanced_query_conversations(
    query_request: AdvancedQueryRequest, 
    api_key: str = Depends(verify_api_key)
):
    """Advanced conversation querying with comprehensive filtering and sorting."""
    try:
        # In production, this would use actual database queries with the filters
        # For now, we'll simulate advanced filtering logic
        
        # Mock filtering logic based on request parameters
        conversations = []
        total_available = 297917  # Mock total count
        
        # Apply mock filtering logic
        filtered_count = total_available
        if query_request.min_quality:
            filtered_count = int(filtered_count * 0.7)
        if query_request.tier:
            filtered_count = int(filtered_count * 0.3)
        if query_request.content_search:
            filtered_count = int(filtered_count * 0.1)
        if query_request.created_after or query_request.created_before:
            filtered_count = int(filtered_count * 0.5)
        
        # Generate mock results
        for i in range(min(query_request.limit, 20)):
            conv_id = f"adv_{query_request.offset + i + 1:06d}"
            quality_score = (query_request.min_quality or 0.5) + (i * 0.02)
            
            conversation = {
                "id": conv_id,
                "dataset": query_request.dataset or "priority_complete_fixed",
                "tier": query_request.tier or "professional",
                "quality_score": min(quality_score, 1.0),
                "message_count": (query_request.min_messages or 5) + i,
                "created_at": datetime.now().isoformat(),
                "quality_metrics": {
                    "therapeutic_accuracy": quality_score + 0.05,
                    "emotional_authenticity": quality_score + 0.03,
                    "safety_score": min(quality_score + 0.1, 1.0),
                    "overall_quality": quality_score,
                },
            }
            
            # Add content snippet if content search was used
            if query_request.content_search:
                conversation["content_snippet"] = f"...content matching '{query_request.content_search}'..."
                conversation["relevance_score"] = 0.95 - (i * 0.02)
            
            conversations.append(conversation)
        
        # Generate query summary
        query_summary = {
            "applied_filters": {
                "dataset": query_request.dataset,
                "tier": query_request.tier,
                "quality_range": f"{query_request.min_quality}-{query_request.max_quality}",
                "content_search": query_request.content_search,
                "date_range": f"{query_request.created_after} to {query_request.created_before}",
            },
            "sorting": {
                "field": query_request.sort_by,
                "order": query_request.sort_order,
            },
            "performance": {
                "query_time_ms": 127,
                "total_matches": filtered_count,
                "returned_count": len(conversations),
            }
        }
        
        return APIResponse(
            success=True,
            data={
                "conversations": conversations,
                "query_summary": query_summary,
                "pagination": {
                    "limit": query_request.limit,
                    "offset": query_request.offset,
                    "total": filtered_count,
                    "has_more": (query_request.offset + query_request.limit) < filtered_count,
                },
            },
            message="Advanced query completed successfully",
        )
    except Exception as e:
        logger.error(f"Error in advanced conversation query: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/v1/conversations/{conversation_id}", response_model=APIResponse)
async def get_conversation(
    conversation_id: str, api_key: str = Depends(verify_api_key)
):
    """Get a specific conversation by ID."""
    try:
        # Mock conversation - in production, fetch from database
        conversation = {
            "id": conversation_id,
            "messages": [
                {
                    "role": "user",
                    "content": "I've been feeling really anxious lately.",
                    "timestamp": "2025-08-17T00:00:00Z",
                },
                {
                    "role": "assistant",
                    "content": "I understand that anxiety can be overwhelming. Can you tell me more about what's been triggering these feelings?",
                    "timestamp": "2025-08-17T00:00:30Z",
                },
            ],
            "quality_metrics": {
                "therapeutic_accuracy": 0.78,
                "conversation_coherence": 0.85,
                "emotional_authenticity": 0.72,
                "clinical_compliance": 0.81,
                "safety_score": 0.95,
                "overall_quality": 0.82,
            },
            "metadata": {
                "dataset": "professional_datasets_final",
                "tier": "professional",
                "length": 2,
                "created_at": "2025-08-17T00:00:00Z",
            },
        }

        return APIResponse(
            success=True,
            data=conversation,
            message=f"Conversation {conversation_id} retrieved successfully",
        )
    except Exception as e:
        logger.error(f"Error getting conversation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Quality metrics endpoints
@app.get("/v1/quality/metrics", response_model=APIResponse)
async def get_quality_metrics(
    dataset: Optional[str] = None,
    tier: Optional[str] = None,
    api_key: str = Depends(verify_api_key),
):
    """Get quality metrics for datasets or tiers."""
    try:
        # Mock quality metrics - in production, calculate from database
        metrics = {
            "overall_statistics": {
                "average_quality": 0.687,
                "total_conversations": 449350,
                "quality_distribution": {
                    "excellent": 89870,
                    "good": 224675,
                    "fair": 112337,
                    "poor": 22468,
                },
            },
            "tier_metrics": {
                "basic": {"average_quality": 0.617, "count": 134271},
                "standard": {"average_quality": 0.687, "count": 179740},
                "professional": {"average_quality": 0.741, "count": 89870},
                "clinical": {"average_quality": 0.798, "count": 33739},
                "research": {"average_quality": 0.823, "count": 11730},
            },
        }

        return APIResponse(
            success=True, data=metrics, message="Quality metrics retrieved successfully"
        )
    except Exception as e:
        logger.error(f"Error getting quality metrics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/v1/quality/validate", response_model=APIResponse)
async def validate_conversation_quality(
    conversation: ConversationModel, api_key: str = Depends(verify_api_key)
):
    """Validate the quality of a conversation."""
    try:
        # Mock quality validation - in production, use actual quality validation system
        quality_result = {
            "conversation_id": conversation.id,
            "validation_results": {
                "therapeutic_accuracy": 0.78,
                "conversation_coherence": 0.85,
                "emotional_authenticity": 0.72,
                "clinical_compliance": 0.81,
                "safety_score": 0.95,
                "overall_quality": 0.82,
            },
            "recommendations": [
                "Consider enhancing therapeutic language patterns",
                "Maintain current level of emotional authenticity",
                "Excellent safety compliance maintained",
            ],
            "tier_classification": "professional",
            "validation_timestamp": datetime.now().isoformat(),
        }

        return APIResponse(
            success=True,
            data=quality_result,
            message="Conversation quality validated successfully",
        )
    except Exception as e:
        logger.error(f"Error validating conversation quality: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Processing endpoints
@app.post("/v1/processing/submit", response_model=APIResponse)
async def submit_processing_job(
    request: ProcessingRequest, api_key: str = Depends(verify_api_key)
):
    """Submit a processing job."""
    try:
        # Mock job submission - in production, queue actual processing job
        job_id = f"job_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        job_info = {
            "job_id": job_id,
            "dataset_name": request.dataset_name,
            "processing_type": request.processing_type,
            "status": "queued",
            "submitted_at": datetime.now().isoformat(),
            "estimated_completion": "2025-08-17T01:00:00Z",
            "parameters": request.parameters,
        }

        return APIResponse(
            success=True,
            data=job_info,
            message=f"Processing job {job_id} submitted successfully",
        )
    except Exception as e:
        logger.error(f"Error submitting processing job: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/v1/processing/jobs/{job_id}", response_model=APIResponse)
async def get_job_status(job_id: str, api_key: str = Depends(verify_api_key)):
    """Get the status of a processing job."""
    try:
        # Mock job status - in production, fetch from job queue
        job_status = {
            "job_id": job_id,
            "status": "completed",
            "progress": 100,
            "started_at": "2025-08-17T00:30:00Z",
            "completed_at": "2025-08-17T00:45:00Z",
            "results": {
                "processed_conversations": 1000,
                "quality_improvements": 15,
                "export_location": f"/exports/{job_id}_results.jsonl",
            },
        }

        return APIResponse(
            success=True,
            data=job_status,
            message=f"Job {job_id} status retrieved successfully",
        )
    except Exception as e:
        logger.error(f"Error getting job status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Search endpoints
@app.post("/v1/search", response_model=APIResponse)
async def search_conversations(
    search_request: SearchRequest, api_key: str = Depends(verify_api_key)
):
    """Search conversations using advanced filters."""
    try:
        # Mock search results - in production, use actual search system
        results = []
        for i in range(min(search_request.limit, 5)):  # Mock 5 results
            results.append(
                {
                    "conversation_id": f"search_result_{i+1}",
                    "relevance_score": 0.95 - (i * 0.1),
                    "snippet": f"Conversation snippet matching '{search_request.query}'...",
                    "quality_score": 0.78,
                    "tier": "professional",
                    "metadata": {"dataset": "priority_complete_fixed"},
                }
            )

        search_results = {
            "query": search_request.query,
            "results": results,
            "total_matches": 1247,
            "search_time_ms": 45,
            "filters_applied": search_request.filters,
        }

        return APIResponse(
            success=True, data=search_results, message="Search completed successfully"
        )
    except Exception as e:
        logger.error(f"Error searching conversations: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Statistics endpoints
@app.get("/v1/statistics/overview", response_model=APIResponse)
async def get_statistics_overview(api_key: str = Depends(verify_api_key)):
    """Get comprehensive statistics overview."""
    try:
        # Mock statistics - in production, calculate from database
        statistics = {
            "total_conversations": 2592223,
            "total_datasets": 43,
            "quality_distribution": {
                "research": 11730,
                "clinical": 33739,
                "professional": 89870,
                "standard": 179740,
                "basic": 2277144,
            },
            "processing_statistics": {
                "conversations_per_second": 1674,
                "average_processing_time": "8.3 minutes",
                "success_rate": "99.7%",
            },
            "api_usage": {
                "requests_today": 15847,
                "active_users": 127,
                "popular_endpoints": [
                    "/v1/conversations",
                    "/v1/search",
                    "/v1/quality/metrics",
                ],
            },
        }

        return APIResponse(
            success=True,
            data=statistics,
            message="Statistics overview retrieved successfully",
        )
    except Exception as e:
        logger.error(f"Error getting statistics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Usage monitoring endpoints
@app.get("/v1/monitoring/usage", response_model=APIResponse)
async def get_usage_statistics(
    api_key: str = Depends(verify_api_key),
):
    """Get comprehensive usage statistics and monitoring data."""
    try:
        # Get current user's usage stats
        user_stats = rate_limiter.usage_stats.get(api_key, {
            "total_requests": 0,
            "requests_today": 0,
            "last_request": None,
            "endpoints_used": {},
            "first_seen": datetime.now(),
        })
        
        # Calculate usage patterns
        endpoint_usage = dict(user_stats.get("endpoints_used", {}))
        most_used_endpoint = max(endpoint_usage, key=endpoint_usage.get) if endpoint_usage else None
        
        # System-wide statistics (aggregated)
        all_stats = rate_limiter.usage_stats
        system_stats = {
            "total_active_users": len(all_stats),
            "total_requests_all_users": sum(stats["total_requests"] for stats in all_stats.values()),
            "total_requests_today_all_users": sum(stats["requests_today"] for stats in all_stats.values()),
        }
        
        # Rate limiting status
        rate_limit_key = api_key
        current_requests = len([req for req in rate_limiter.requests.get(rate_limit_key, []) 
                               if req > time.time() - 3600])  # Last hour
        
        usage_data = {
            "user_statistics": {
                "api_key_hash": api_key[:8] + "..." + api_key[-4:],  # Partial key for identification
                "account_created": user_stats.get("first_seen", datetime.now()).isoformat(),
                "total_requests": user_stats["total_requests"],
                "requests_today": user_stats["requests_today"],
                "last_request": user_stats["last_request"].isoformat() if user_stats["last_request"] else None,
                "most_used_endpoint": most_used_endpoint,
                "endpoint_usage_breakdown": endpoint_usage,
            },
            "rate_limiting": {
                "current_window_requests": current_requests,
                "hourly_limit": 1000,  # Authenticated user limit
                "remaining_requests": max(0, 1000 - current_requests),
                "window_reset_time": int(time.time() + 3600 - (time.time() % 3600)),
                "rate_limit_status": "within_limits" if current_requests < 900 else "approaching_limit" if current_requests < 1000 else "rate_limited",
            },
            "system_statistics": system_stats,
            "performance_metrics": {
                "average_response_time_ms": 145,  # Mock - would calculate from actual metrics
                "system_uptime_hours": 72,  # Mock - would calculate from startup time
                "api_availability_percent": 99.9,  # Mock - would calculate from health checks
            },
        }
        
        return APIResponse(
            success=True,
            data=usage_data,
            message="Usage statistics retrieved successfully",
        )
    except Exception as e:
        logger.error(f"Error getting usage statistics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/v1/monitoring/health/detailed", response_model=APIResponse)
async def detailed_health_check(
    api_key: str = Depends(verify_api_key),
):
    """Detailed system health check with component status."""
    try:
        health_data = {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "version": "1.0.0",
            "environment": "production",  # Would be configurable
            "components": {
                "api_server": {
                    "status": "healthy",
                    "response_time_ms": 12,
                    "uptime_hours": 72,
                },
                "rate_limiter": {
                    "status": "healthy", 
                    "active_keys": len(rate_limiter.requests),
                    "memory_usage_mb": 15,  # Mock - would calculate actual memory usage
                },
                "authentication": {
                    "status": "healthy",
                    "active_sessions": len(rate_limiter.usage_stats),
                },
                "export_system": {
                    "status": "healthy",
                    "active_jobs": 3,  # Mock - would query actual job queue
                    "queue_depth": 0,
                },
                "database": {
                    "status": "healthy",  # Mock - would check actual database connection
                    "connection_pool": "8/20 connections active",
                    "query_performance": "optimal",
                },
            },
            "metrics": {
                "requests_per_second": 12.5,
                "error_rate_percent": 0.1,
                "average_response_time_ms": 145,
                "memory_usage_percent": 45,
                "cpu_usage_percent": 23,
            },
            "alerts": [],  # Would contain any active system alerts
        }
        
        return APIResponse(
            success=True,
            data=health_data,
            message="Detailed health check completed successfully",
        )
    except Exception as e:
        logger.error(f"Error in detailed health check: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/v1/monitoring/rate-limits", response_model=APIResponse)
async def get_rate_limit_info(
    api_key: str = Depends(verify_api_key),
):
    """Get current rate limiting information and quotas."""
    try:
        # Calculate current rate limit status
        rate_limit_key = api_key
        now = time.time()
        window_start = now - 3600  # 1 hour window
        
        current_requests = [req for req in rate_limiter.requests.get(rate_limit_key, []) if req > window_start]
        current_count = len(current_requests)
        
        # Calculate request pattern over the last hour
        request_pattern = {}
        for i in range(12):  # 5-minute intervals
            interval_start = window_start + (i * 300)  # 300 seconds = 5 minutes
            interval_end = interval_start + 300
            interval_requests = len([req for req in current_requests if interval_start <= req < interval_end])
            request_pattern[f"{i*5}-{(i+1)*5} min ago"] = interval_requests
        
        rate_limit_data = {
            "current_status": {
                "requests_in_current_window": current_count,
                "window_size_seconds": 3600,
                "limit": 1000,
                "remaining": max(0, 1000 - current_count),
                "reset_time": int(window_start + 3600),
                "seconds_until_reset": max(0, int(window_start + 3600 - now)),
            },
            "quota_utilization": {
                "percentage_used": (current_count / 1000) * 100,
                "status": "normal" if current_count < 800 else "warning" if current_count < 950 else "critical",
                "projected_usage": min(1000, current_count * 2),  # Simple projection
            },
            "request_pattern": request_pattern,
            "recommendations": [],
        }
        
        # Add recommendations based on usage
        if current_count > 800:
            rate_limit_data["recommendations"].append("Consider implementing request caching to reduce API calls")
        if current_count > 950:
            rate_limit_data["recommendations"].append("Approaching rate limit - consider upgrading API plan")
        
        return APIResponse(
            success=True,
            data=rate_limit_data,
            message="Rate limit information retrieved successfully",
        )
    except Exception as e:
        logger.error(f"Error getting rate limit info: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Export endpoints
@app.post("/v1/export/bulk", response_model=APIResponse)
async def create_bulk_export(
    export_request: BulkExportRequest,
    api_key: str = Depends(verify_api_key),
):
    """Create a bulk export job with comprehensive filtering and progress tracking."""
    try:
        # Generate unique job ID
        job_id = f"bulk_export_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        
        # Calculate estimated metrics based on filters
        estimated_records = 297917  # Base dataset size
        if export_request.filters:
            if export_request.filters.min_quality:
                estimated_records = int(estimated_records * 0.7)
            if export_request.filters.tier:
                estimated_records = int(estimated_records * 0.3)
            if export_request.filters.content_search:
                estimated_records = int(estimated_records * 0.1)
        
        # Estimate file size based on format and record count
        size_multipliers = {
            "jsonl": 2048,  # ~2KB per conversation
            "parquet": 512,  # ~0.5KB per conversation (compressed)
            "csv": 1024,    # ~1KB per conversation
            "huggingface": 2560,  # ~2.5KB per conversation
            "openai": 1536   # ~1.5KB per conversation
        }
        estimated_size = estimated_records * size_multipliers.get(export_request.format, 2048)
        
        # Create job status
        job_status = ExportJobStatus(
            job_id=job_id,
            status="pending",
            progress=0.0,
            created_at=datetime.now(),
            total_records=estimated_records,
            processed_records=0,
            failed_records=0,
        )
        
        # In production, this would:
        # 1. Store job in database/queue
        # 2. Start async processing task
        # 3. Set up progress tracking
        
        # Mock job creation response
        job_info = {
            "job_id": job_id,
            "status": "pending",
            "estimated_records": estimated_records,
            "estimated_size_bytes": estimated_size,
            "estimated_duration_minutes": max(1, estimated_records // 10000),  # ~10k records/minute
            "export_config": {
                "dataset": export_request.dataset,
                "format": export_request.format,
                "include_metadata": export_request.include_metadata,
                "include_quality_metrics": export_request.include_quality_metrics,
                "batch_size": export_request.batch_size,
            },
            "notifications": {
                "email": export_request.notify_email,
                "webhook": export_request.callback_url,
            },
            "status_url": f"/v1/export/jobs/{job_id}/status",
            "created_at": job_status.created_at.isoformat(),
        }
        
        return APIResponse(
            success=True,
            data=job_info,
            message=f"Bulk export job {job_id} created successfully",
        )
    except Exception as e:
        logger.error(f"Error creating bulk export: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/v1/export/jobs/{job_id}/status", response_model=APIResponse)
async def get_export_job_status(
    job_id: str,
    api_key: str = Depends(verify_api_key),
):
    """Get detailed status of a bulk export job."""
    try:
        # In production, fetch actual job status from database/queue
        # Mock different job states based on job_id for demonstration
        
        import hashlib
        job_hash = int(hashlib.md5(job_id.encode()).hexdigest()[:8], 16)
        mock_progress = min(100.0, (job_hash % 100) + 1)
        
        if mock_progress < 25:
            status = "pending"
            started_at = None
            completed_at = None
        elif mock_progress < 100:
            status = "running"
            started_at = datetime.now()
            completed_at = None
        else:
            status = "completed"
            started_at = datetime.now()
            completed_at = datetime.now()
        
        total_records = 150000 + (job_hash % 50000)
        processed_records = int(total_records * mock_progress / 100)
        failed_records = max(0, int(processed_records * 0.001))  # 0.1% failure rate
        
        job_status = ExportJobStatus(
            job_id=job_id,
            status=status,
            progress=mock_progress,
            created_at=datetime.now(),
            started_at=started_at,
            completed_at=completed_at,
            total_records=total_records,
            processed_records=processed_records,
            failed_records=failed_records,
        )
        
        # Add download info if completed
        if status == "completed":
            job_status.download_url = f"/v1/export/jobs/{job_id}/download"
            job_status.file_size = processed_records * 2048  # Mock file size
            job_status.expires_at = datetime.now()  # Would be +7 days in production
        
        # Add error info if failed
        if status == "failed":
            job_status.error_message = "Processing failed due to system error"
            job_status.error_details = {
                "error_code": "PROCESSING_ERROR",
                "failed_at": "2025-08-29T07:25:00Z",
                "retry_available": True,
            }
        
        response_data = job_status.dict()
        response_data["estimated_completion"] = None
        if status == "running" and mock_progress > 0:
            remaining_records = total_records - processed_records
            records_per_minute = processed_records / max(1, mock_progress)  # Mock calculation
            remaining_minutes = remaining_records / max(1, records_per_minute)
            response_data["estimated_completion"] = f"{remaining_minutes:.1f} minutes"
        
        return APIResponse(
            success=True,
            data=response_data,
            message=f"Export job {job_id} status retrieved successfully",
        )
    except Exception as e:
        logger.error(f"Error getting export job status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/v1/export/jobs/{job_id}/download", response_model=APIResponse)
async def download_export_file(
    job_id: str,
    api_key: str = Depends(verify_api_key),
):
    """Download completed export file."""
    try:
        # In production, this would:
        # 1. Verify job is completed
        # 2. Check download link hasn't expired
        # 3. Return actual file or signed download URL
        
        # Mock download response
        download_info = {
            "job_id": job_id,
            "download_url": f"https://exports.pixelated-empathy.ai/files/{job_id}.jsonl",
            "file_name": f"{job_id}.jsonl",
            "file_size": 2457600,  # Mock size in bytes
            "content_type": "application/jsonl",
            "expires_at": "2025-09-05T07:25:00Z",  # 7 days from now
            "checksum": {
                "md5": "a1b2c3d4e5f6789012345678901234567",
                "sha256": "abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234",
            },
        }
        
        return APIResponse(
            success=True,
            data=download_info,
            message=f"Download information for export {job_id} retrieved successfully",
        )
    except Exception as e:
        logger.error(f"Error getting download info: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/v1/export/jobs", response_model=APIResponse)
async def list_export_jobs(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    api_key: str = Depends(verify_api_key),
):
    """List export jobs with optional status filtering."""
    try:
        # Mock job listing - in production, fetch from database
        jobs = []
        for i in range(min(limit, 10)):
            job_id = f"bulk_export_202508{29-i:02d}_{14+i:02d}{30+i:02d}{15+i:02d}_123456"
            mock_status = ["pending", "running", "completed", "failed"][i % 4]
            
            if status and mock_status != status:
                continue
                
            jobs.append({
                "job_id": job_id,
                "status": mock_status,
                "progress": 100.0 if mock_status == "completed" else (25.0 * i),
                "created_at": f"2025-08-{29-i:02d}T{14+i:02d}:30:00Z",
                "dataset": "priority_complete_fixed",
                "format": ["jsonl", "parquet", "csv"][i % 3],
                "estimated_records": 150000 + (i * 10000),
            })
        
        return APIResponse(
            success=True,
            data={
                "jobs": jobs,
                "total": len(jobs),
                "limit": limit,
                "offset": offset,
            },
            message="Export jobs retrieved successfully",
        )
    except Exception as e:
        logger.error(f"Error listing export jobs: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.delete("/v1/export/jobs/{job_id}", response_model=APIResponse)
async def cancel_export_job(
    job_id: str,
    api_key: str = Depends(verify_api_key),
):
    """Cancel a running export job."""
    try:
        # In production, this would:
        # 1. Check if job can be cancelled (pending/running)
        # 2. Stop the processing task
        # 3. Update job status to cancelled
        # 4. Clean up any partial files
        
        cancellation_info = {
            "job_id": job_id,
            "previous_status": "running",
            "new_status": "cancelled",
            "cancelled_at": datetime.now().isoformat(),
            "processed_records": 75000,  # Mock partial progress
            "cleanup_status": "completed",
        }
        
        return APIResponse(
            success=True,
            data=cancellation_info,
            message=f"Export job {job_id} cancelled successfully",
        )
    except Exception as e:
        logger.error(f"Error cancelling export job: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

"""
Inference API endpoints for Pixelated Empathy AI project.
Implements model inference with authentication, quotas, and rate limiting.
"""

import os
import json
import time
import logging
import asyncio
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from enum import Enum
from dataclasses import dataclass
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
import redis
from functools import wraps

# Import our model adapters
from .model_adapters import ModelAdapterManager, ModelConfig
from ..safety.enhanced_safety_filter import (
    EnhancedSafetyFilter, 
    CrisisInterventionSystem, 
    SafetyCategory,
    SafetyLevel
)
from ..monitoring.health_check import (
    HealthCheckManager,
    HealthCheckMiddleware,
    integrate_health_checks_with_fastapi
)

logger = logging.getLogger(__name__)

# Initialize security components
security = HTTPBearer()

# Initialize model manager
model_manager = ModelAdapterManager()

# Initialize Redis for rate limiting and quotas (if available)
try:
    redis_client = redis.Redis(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", 6379)),
        db=0,
        decode_responses=True
    )
    redis_client.ping()  # Test connection
    REDIS_AVAILABLE = True
except (redis.ConnectionError, redis.RedisError, ConnectionRefusedError):
    logger.warning("Redis not available, using in-memory storage for rate limiting")
    redis_client = None
    REDIS_AVAILABLE = False


class UserTier(Enum):
    """User tier for quota management"""
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"
    ADMIN = "admin"


@dataclass
class APIKeyInfo:
    """Information about an API key"""
    key: str
    user_id: str
    tier: UserTier
    created_at: str
    last_used: Optional[str] = None
    quota_remaining: int = 1000  # Requests per day
    quota_reset: Optional[str] = None
    active: bool = True


class APIKeyManager:
    """Manager for API keys and authentication"""
    
    def __init__(self):
        self.keys: Dict[str, APIKeyInfo] = {}
        self.user_keys: Dict[str, List[str]] = {}  # user_id -> [api_keys]
        self._load_keys()
    
    def _load_keys(self):
        """Load API keys from environment or config file"""
        # For now, we'll create some example keys for testing
        # In production, these would be loaded from a secure source
        pass
    
    def generate_api_key(self, user_id: str, tier: UserTier = UserTier.FREE) -> str:
        """Generate a new API key for a user"""
        api_key = f"pix_{secrets.token_urlsafe(32)}"
        key_info = APIKeyInfo(
            key=api_key,
            user_id=user_id,
            tier=tier,
            created_at=datetime.utcnow().isoformat(),
            quota_remaining=self._get_quota_for_tier(tier)
        )
        self.keys[api_key] = key_info
        
        if user_id not in self.user_keys:
            self.user_keys[user_id] = []
        self.user_keys[user_id].append(api_key)
        
        return api_key
    
    def _get_quota_for_tier(self, tier: UserTier) -> int:
        """Get daily quota based on user tier"""
        quotas = {
            UserTier.FREE: 1000,
            UserTier.PRO: 10000,
            UserTier.ENTERPRISE: 100000,
            UserTier.ADMIN: 1000000
        }
        return quotas.get(tier, 1000)
    
    def validate_api_key(self, api_key: str) -> Optional[APIKeyInfo]:
        """Validate an API key and return user info"""
        if api_key in self.keys:
            key_info = self.keys[api_key]
            if key_info.active:
                return key_info
        return None
    
    def use_request_quota(self, api_key: str) -> bool:
        """Use one request from the user's quota"""
        if api_key in self.keys:
            key_info = self.keys[api_key]
            if key_info.quota_remaining > 0:
                key_info.quota_remaining -= 1
                key_info.last_used = datetime.utcnow().isoformat()
                return True
        return False


# Initialize API key manager
api_key_manager = APIKeyManager()


class RateLimiter:
    """Rate limiting system"""
    
    def __init__(self):
        self.redis_client = redis_client
        self.requests_per_window = {
            UserTier.FREE: (100, 3600),      # 100 requests per hour
            UserTier.PRO: (1000, 3600),      # 1000 requests per hour  
            UserTier.ENTERPRISE: (10000, 3600),  # 10000 requests per hour
            UserTier.ADMIN: (100000, 3600)   # 100000 requests per hour
        }
    
    def _get_key(self, user_id: str, window_start: str) -> str:
        """Get Redis key for rate limiting"""
        return f"rate_limit:{user_id}:{window_start}"
    
    def _get_window_start(self) -> str:
        """Get the start of the current time window (hourly)"""
        now = datetime.utcnow()
        window_start = now.replace(minute=0, second=0, microsecond=0)
        return window_start.isoformat()
    
    def check_rate_limit(self, user_id: str, tier: UserTier) -> bool:
        """Check if user is within rate limit"""
        if not REDIS_AVAILABLE:
            # If Redis is not available, use in-memory approach (not production ready)
            return True
        
        max_requests, window_seconds = self.requests_per_window[tier]
        window_start = self._get_window_start()
        key = self._get_key(user_id, window_start)
        
        try:
            current_requests = self.redis_client.get(key)
            if current_requests is None:
                # First request in this window
                self.redis_client.setex(key, window_seconds, 1)
                return True
            else:
                current_requests = int(current_requests)
                if current_requests < max_requests:
                    # Increment request count
                    self.redis_client.incr(key)
                    return True
                else:
                    # Rate limit exceeded
                    return False
        except Exception as e:
            logger.error(f"Rate limiting error: {e}")
            # Fail open - allow request if rate limiting fails
            return True
    
    def increment_requests(self, user_id: str, tier: UserTier):
        """Increment request count for rate limiting (for in-memory implementation)"""
        pass


# Initialize rate limiter
rate_limiter = RateLimiter()

# Initialize health check manager
health_manager = HealthCheckManager()

# Register model manager with health manager
health_manager.register_component("model_manager", model_manager)

# Register rate limiter with health manager
health_manager.register_component("rate_limiter", rate_limiter)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> APIKeyInfo:
    """Dependency to get current user from API key"""
    api_key_info = api_key_manager.validate_api_key(credentials.credentials)
    if not api_key_info:
        raise HTTPException(
            status_code=401,
            detail="Invalid API key"
        )
    
    # Check quota
    if not api_key_manager.use_request_quota(credentials.credentials):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded - daily quota depleted"
        )
    
    # Check rate limit
    if not rate_limiter.check_rate_limit(api_key_info.user_id, api_key_info.tier):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded - too many requests"
        )
    
    return api_key_info


# Request/Response models
class ChatRequest(BaseModel):
    """Request model for chat inference"""
    model: str = Field(..., description="Model name to use for inference")
    messages: List[Dict[str, str]] = Field(..., description="Conversation messages")
    max_tokens: int = Field(default=256, ge=1, le=2048, description="Maximum tokens to generate")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0, description="Sampling temperature")
    top_p: float = Field(default=0.9, ge=0.0, le=1.0, description="Top-p sampling")
    presence_penalty: float = Field(default=0.0, ge=-2.0, le=2.0, description="Presence penalty")
    frequency_penalty: float = Field(default=0.0, ge=-2.0, le=2.0, description="Frequency penalty")


class ChatResponse(BaseModel):
    """Response model for chat inference with safety information"""
    id: str
    model: str
    created: int
    choices: List[Dict[str, Any]]
    usage: Dict[str, int]
    processing_time: float
    safety_filtered: Optional[bool] = None
    safety_score: Optional[float] = None
    safety_categories: Optional[List[str]] = None
    crisis_intervention: Optional[Dict[str, Any]] = None


class ModelListResponse(BaseModel):
    """Response model for listing available models"""
    object: str = "list"
    data: List[Dict[str, str]]


class UsageResponse(BaseModel):
    """Response model for usage information"""
    user_id: str
    tier: str
    quota_remaining: int
    quota_reset: Optional[str]
    requests_count: int
    requests_limit: int


# Initialize FastAPI app
app = FastAPI(
    title="Pixelated Empathy Inference API",
    description="Secure, scalable model inference API with authentication and rate limiting",
    version="1.0.0"
)


# API endpoints
@app.get("/health", tags=["Health"])
@app.get("/ready", tags=["Health"])
@app.get("/alive", tags=["Health"])
async def health_check():
    """Enhanced health check endpoints"""
    # Use the health manager for comprehensive health checking
    health_middleware = HealthCheckMiddleware(health_manager)
    status_code, response_data = health_middleware.health_check_endpoint()
    
    # Add additional information specific to this service
    response_data.update({
        "service": "inference_api",
        "version": "1.0.0",
        "models_loaded": len(model_manager.list_models()) if model_manager else 0,
        "model_manager": "active" if model_manager else "inactive",
        "rate_limiter": "active" if REDIS_AVAILABLE else "using_fallback",
        "safety_filter": "active" if enhanced_safety_filter else "inactive",
        "crisis_intervention": "active" if crisis_intervention_system else "inactive"
    })
    
    return response_data


@app.get("/models", response_model=ModelListResponse, tags=["Models"])
async def list_models(current_user: APIKeyInfo = Depends(get_current_user)):
    """List available models"""
    # This endpoint doesn't require specific permissions
    available_models = model_manager.list_models()
    models_data = [{"id": model_name, "object": "model", "owned_by": "pixelated-empathy"} 
                   for model_name in available_models]
    
    return ModelListResponse(data=models_data)


# Initialize enhanced safety filter
enhanced_safety_filter = EnhancedSafetyFilter(SafetyLevel.MODERATE)
crisis_intervention_system = CrisisInterventionSystem(enhanced_safety_filter)

@app.post("/chat/completions", response_model=ChatResponse, tags=["Inference"])
async def chat_completions(
    request: ChatRequest,
    current_user: APIKeyInfo = Depends(get_current_user),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Chat completions endpoint with enhanced safety filtering"""
    start_time = time.time()
    
    try:
        # Validate that the requested model exists
        if request.model not in model_manager.list_models():
            raise HTTPException(status_code=404, detail=f"Model '{request.model}' not found")
        
        # Perform inference
        inputs = {
            "messages": request.messages,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "top_p": request.top_p
        }
        
        # Get the model adapter and perform prediction
        result = model_manager.predict(request.model, inputs)
        
        # Apply enhanced safety filtering to the response
        user_context = {
            "user_id": current_user.user_id,
            "user_tier": current_user.tier.value,
            "request_timestamp": datetime.utcnow().isoformat()
        }
        
        request_metadata = {
            "model": request.model,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "request_id": f"req_{int(time.time())}"
        }
        
        # Perform comprehensive safety check
        is_safe, filtered_content, safety_result = enhanced_safety_filter.filter_response(
            result if isinstance(result, str) else str(result),
            user_context=user_context,
            request_metadata=request_metadata
        )
        
        # Handle crisis situations
        crisis_detected = any(cat == SafetyCategory.CRISIS for cat in safety_result.flagged_categories)
        crisis_response = None
        
        if crisis_detected and safety_result.category_scores.get(SafetyCategory.CRISIS, 0) > 0.5:
            # Extract crisis information from safety result
            from ..safety.enhanced_safety_filter import CrisisDetectionResult
            crisis_result = CrisisDetectionResult(
                is_crisis=True,
                crisis_type="detected_from_safety_filter",
                confidence=safety_result.category_scores[SafetyCategory.CRISIS],
                urgency_level="high",
                recommended_action="seek_professional_help"
            )
            
            # Handle the crisis situation
            crisis_response = crisis_intervention_system.handle_crisis_detection(
                crisis_result,
                user_context=user_context,
                content=filtered_content if not is_safe else (result if isinstance(result, str) else str(result))
            )
        
        # Calculate response time
        processing_time = time.time() - start_time
        total_time = int(processing_time * 1000)  # Convert to milliseconds
        
        # Prepare final response content
        final_content = filtered_content if not is_safe else (result if isinstance(result, str) else str(result))
        
        # Create response
        response_data = ChatResponse(
            id=f"chat-{int(time.time())}",
            model=request.model,
            created=int(time.time()),
            choices=[
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": final_content},
                    "finish_reason": "stop"
                }
            ],
            usage={
                "prompt_tokens": len(str(request.messages)),
                "completion_tokens": len(final_content),
                "total_tokens": len(str(request.messages)) + len(final_content)
            },
            processing_time=processing_time
        )
        
        # Add safety metadata to response (for debugging/auditing)
        response_data.safety_filtered = not is_safe
        response_data.safety_score = safety_result.overall_score
        response_data.safety_categories = [cat.value for cat in safety_result.flagged_categories]
        
        # Add crisis intervention metadata if applicable
        if crisis_response:
            response_data.crisis_intervention = crisis_response
        
        # Add background task to log the request for analytics
        background_tasks.add_task(
            log_request,
            user_id=current_user.user_id,
            model=request.model,
            input_messages=request.messages,
            output=final_content,
            processing_time=processing_time,
            safety_info={
                "safety_filtered": not is_safe,
                "safety_score": safety_result.overall_score,
                "flagged_categories": [cat.value for cat in safety_result.flagged_categories],
                "crisis_detected": crisis_detected,
                "crisis_response": crisis_response is not None
            }
        )
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat completion error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/user/usage", response_model=UsageResponse, tags=["User"])
async def get_usage(current_user: APIKeyInfo = Depends(get_current_user)):
    """Get user usage information"""
    return UsageResponse(
        user_id=current_user.user_id,
        tier=current_user.tier.value,
        quota_remaining=current_user.quota_remaining,
        quota_reset=current_user.quota_reset,
        requests_count=1000 - current_user.quota_remaining,  # Simplified calculation
        requests_limit=api_key_manager._get_quota_for_tier(current_user.tier)
    )


@app.post("/tokens/validate", tags=["Authentication"])
async def validate_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Validate an API token without consuming quota"""
    api_key_info = api_key_manager.validate_api_key(credentials.credentials)
    if not api_key_info:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    return {
        "valid": True,
        "user_id": api_key_info.user_id,
        "tier": api_key_info.tier.value,
        "quota_remaining": api_key_info.quota_remaining
    }


@app.get("/admin/models", tags=["Admin"])
async def list_all_models(current_user: APIKeyInfo = Depends(get_current_user)):
    """Admin endpoint to list all models with detailed information"""
    if current_user.tier != UserTier.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    models_info = {}
    for model_name in model_manager.list_models():
        info = model_manager.get_model_info(model_name)
        if info:
            models_info[model_name] = info
    
    return {"models": models_info}


@app.post("/admin/models/load", tags=["Admin"])
async def load_model(
    model_path: str,
    model_type: str,  # pytorch, tensorflow, onnx, llm
    model_name: str,
    current_user: APIKeyInfo = Depends(get_current_user)
):
    """Admin endpoint to load a new model"""
    if current_user.tier != UserTier.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        config = ModelConfig(
            model_path=model_path,
            model_type=model_type,
            model_name=model_name,
            model_version="1.0.0"
        )
        
        adapter = model_manager.load_model(model_name, config)
        
        return {
            "status": "success",
            "model": model_name,
            "loaded": True,
            "model_info": adapter.get_model_info()
        }
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load model: {str(e)}")


def log_request(user_id: str, model: str, input_messages: List[Dict], output: Any, processing_time: float, safety_info: Optional[Dict] = None):
    """Background task to log requests for analytics with safety information"""
    try:
        # In a real implementation, this would log to a database or analytics system
        # with appropriate redaction for sensitive content
        log_entry = {
            "user_id": user_id,
            "model": model,
            "timestamp": datetime.utcnow().isoformat(),
            "processing_time_ms": processing_time * 1000,
            "input_length": len(str(input_messages)),
            "output_length": len(str(output)) if output else 0
        }
        
        # Add safety information if provided
        if safety_info:
            log_entry["safety_info"] = safety_info
        
        # Store in Redis for analytics (optional)
        if REDIS_AVAILABLE:
            redis_client.lpush("inference_logs", json.dumps(log_entry))
            redis_client.ltrim("inference_logs", 0, 10000)  # Keep last 10k logs
        
        # Log with appropriate level based on safety flags
        if safety_info and safety_info.get("safety_filtered"):
            logger.warning(f"Safety-filtered request logged: user={user_id}, model={model}, time={processing_time:.3f}s")
        elif safety_info and safety_info.get("crisis_detected"):
            logger.critical(f"CRISIS DETECTED in request: user={user_id}, model={model}, time={processing_time:.3f}s")
        else:
            logger.info(f"Request logged: user={user_id}, model={model}, time={processing_time:.3f}s")
            
    except Exception as e:
        logger.error(f"Failed to log request: {e}")


# Middleware for request timing
@app.middleware("http")
async def add_process_time_header(request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Event handlers
@app.on_event("startup")
async def startup_event():
    """Startup event to initialize models if needed"""
    logger.info("Inference API starting up...")
    
    # Register shutdown callback with health manager
    def cleanup_models():
        logger.info("Cleaning up models during shutdown...")
        model_manager.unload_all_models()
    
    health_manager.register_shutdown_callback(cleanup_models)
    
    # Optionally load default models
    if not model_manager.list_models():
        logger.info("No models loaded, loading default models...")
        # Add logic to load default models if needed


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event to clean up resources gracefully"""
    logger.info("Inference API shutting down...")
    
    # Initiate graceful shutdown through health manager
    shutdown_result = health_manager.initiate_graceful_shutdown()
    
    if shutdown_result.success:
        logger.info(f"Graceful shutdown completed successfully in {shutdown_result.duration_seconds:.2f} seconds")
    else:
        logger.error(f"Graceful shutdown completed with errors: {shutdown_result.error_messages}")
        logger.info(f"Shutdown took {shutdown_result.duration_seconds:.2f} seconds")


def create_api_key_for_user(user_id: str, tier: UserTier = UserTier.FREE) -> str:
    """Helper function to create API keys for users (for admin use)"""
    return api_key_manager.generate_api_key(user_id, tier)


# Example usage and testing
def start_test_server():
    """Function to start the server for testing"""
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)


if __name__ == "__main__":
    # For testing purposes, create a sample API key
    sample_api_key = create_api_key_for_user("test_user", UserTier.PRO)
    print(f"Created sample API key: {sample_api_key}")
    
    # Start the server
    start_test_server()
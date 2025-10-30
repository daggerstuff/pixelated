#!/usr/bin/env python3
"""
Pixelated Empathy AI - API Rate Limiting System
Task 1.2: Implement API Rate Limiting

Enterprise-grade rate limiting system with per-user limits, burst protection, and graceful degradation.
"""

import time
import asyncio
import json
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple, Any, List
from enum import Enum
from dataclasses import dataclass, asdict
from collections import defaultdict, deque
import redis
import logging
from fastapi import HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
import threading
from pathlib import Path
import sqlite3

logger = logging.getLogger(__name__)

class RateLimitType(str, Enum):
    """Rate limit types"""
    PER_SECOND = "per_second"
    PER_MINUTE = "per_minute"
    PER_HOUR = "per_hour"
    PER_DAY = "per_day"
    BURST = "burst"

class RateLimitScope(str, Enum):
    """Rate limit scopes"""
    USER = "user"
    IP = "ip"
    ENDPOINT = "endpoint"
    GLOBAL = "global"

@dataclass
class RateLimit:
    """Rate limit configuration"""
    limit: int
    window: int  # seconds
    scope: RateLimitScope
    limit_type: RateLimitType
    burst_limit: Optional[int] = None
    burst_window: Optional[int] = None

@dataclass
class RateLimitStatus:
    """Rate limit status"""
    limit: int
    remaining: int
    reset_time: int
    retry_after: Optional[int] = None
    is_exceeded: bool = False

class RateLimitStorage:
    """Abstract base class for rate limit storage"""
    
    def get_count(self, key: str, window: int) -> int:
        """Get current count for key within window"""
        raise NotImplementedError
    
    def increment(self, key: str, window: int, amount: int = 1) -> int:
        """Increment count for key and return new count"""
        raise NotImplementedError
    
    def get_reset_time(self, key: str, window: int) -> int:
        """Get reset time for key"""
        raise NotImplementedError
    
    def cleanup_expired(self):
        """Clean up expired entries"""
        raise NotImplementedError

class RedisRateLimitStorage(RateLimitStorage):
    """Redis-based rate limit storage"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        """Initialize Redis storage"""
        try:
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            self.redis_client.ping()
            logger.info("Redis rate limit storage initialized")
        except Exception as e:
            logger.warning(f"Redis not available, falling back to memory storage: {e}")
            raise
    
    def get_count(self, key: str, window: int) -> int:
        """Get current count for key within window"""
        try:
            count = self.redis_client.get(key)
            return int(count) if count else 0
        except Exception as e:
            logger.error(f"Redis get_count failed: {e}")
            return 0
    
    def increment(self, key: str, window: int, amount: int = 1) -> int:
        """Increment count for key and return new count"""
        try:
            pipe = self.redis_client.pipeline()
            pipe.incr(key, amount)
            pipe.expire(key, window)
            results = pipe.execute()
            return results[0]
        except Exception as e:
            logger.error(f"Redis increment failed: {e}")
            return amount
    
    def get_reset_time(self, key: str, window: int) -> int:
        """Get reset time for key"""
        try:
            ttl = self.redis_client.ttl(key)
            if ttl > 0:
                return int(time.time()) + ttl
            else:
                return int(time.time()) + window
        except Exception as e:
            logger.error(f"Redis get_reset_time failed: {e}")
            return int(time.time()) + window
    
    def cleanup_expired(self):
        """Redis handles expiration automatically"""
        pass

class MemoryRateLimitStorage(RateLimitStorage):
    """In-memory rate limit storage with SQLite persistence"""
    
    def __init__(self, db_path: Optional[str] = None):
        """Initialize memory storage with SQLite backup"""
        self.db_path = db_path or str(Path(__file__).parent / "rate_limits.db")
        self.memory_store: Dict[str, List[float]] = defaultdict(list)
        self.lock = threading.RLock()
        self._init_database()
        self._load_from_database()
        
        # Start cleanup thread
        self.cleanup_thread = threading.Thread(target=self._periodic_cleanup, daemon=True)
        self.cleanup_thread.start()
    
    def _init_database(self):
        """Initialize SQLite database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS rate_limit_entries (
                    key TEXT PRIMARY KEY,
                    timestamps TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            conn.commit()
            conn.close()
            logger.info("Rate limit database initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize rate limit database: {e}")
    
    def _load_from_database(self):
        """Load rate limit data from database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT key, timestamps FROM rate_limit_entries
                WHERE updated_at > datetime('now', '-1 day')
            """)
            
            for key, timestamps_json in cursor.fetchall():
                timestamps = json.loads(timestamps_json)
                # Only keep recent timestamps
                current_time = time.time()
                recent_timestamps = [ts for ts in timestamps if current_time - ts < 86400]  # 24 hours
                if recent_timestamps:
                    self.memory_store[key] = recent_timestamps
            
            conn.close()
            logger.info(f"Loaded {len(self.memory_store)} rate limit entries from database")
            
        except Exception as e:
            logger.error(f"Failed to load rate limit data: {e}")
    
    def _save_to_database(self, key: str, timestamps: List[float]):
        """Save rate limit data to database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT OR REPLACE INTO rate_limit_entries (key, timestamps, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            """, (key, json.dumps(timestamps)))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logger.error(f"Failed to save rate limit data: {e}")
    
    def _periodic_cleanup(self):
        """Periodic cleanup of expired entries"""
        while True:
            try:
                time.sleep(300)  # Clean up every 5 minutes
                self.cleanup_expired()
            except Exception as e:
                logger.error(f"Cleanup thread error: {e}")
    
    def get_count(self, key: str, window: int) -> int:
        """Get current count for key within window"""
        with self.lock:
            current_time = time.time()
            timestamps = self.memory_store.get(key, [])
            
            # Filter timestamps within window
            valid_timestamps = [ts for ts in timestamps if current_time - ts < window]
            self.memory_store[key] = valid_timestamps
            
            return len(valid_timestamps)
    
    def increment(self, key: str, window: int, amount: int = 1) -> int:
        """Increment count for key and return new count"""
        with self.lock:
            current_time = time.time()
            timestamps = self.memory_store.get(key, [])
            
            # Filter timestamps within window
            valid_timestamps = [ts for ts in timestamps if current_time - ts < window]
            
            # Add new timestamps
            for _ in range(amount):
                valid_timestamps.append(current_time)
            
            self.memory_store[key] = valid_timestamps
            
            # Save to database periodically
            if len(valid_timestamps) % 10 == 0:  # Save every 10 requests
                self._save_to_database(key, valid_timestamps)
            
            return len(valid_timestamps)
    
    def get_reset_time(self, key: str, window: int) -> int:
        """Get reset time for key"""
        with self.lock:
            timestamps = self.memory_store.get(key, [])
            if timestamps:
                oldest_timestamp = min(timestamps)
                return int(oldest_timestamp + window)
            else:
                return int(time.time() + window)
    
    def cleanup_expired(self):
        """Clean up expired entries"""
        with self.lock:
            current_time = time.time()
            keys_to_remove = []
            
            for key, timestamps in self.memory_store.items():
                # Keep only timestamps from last 24 hours
                valid_timestamps = [ts for ts in timestamps if current_time - ts < 86400]
                
                if valid_timestamps:
                    self.memory_store[key] = valid_timestamps
                    # Save updated data
                    self._save_to_database(key, valid_timestamps)
                else:
                    keys_to_remove.append(key)
            
            # Remove empty entries
            for key in keys_to_remove:
                del self.memory_store[key]
            
            logger.info(f"Cleaned up {len(keys_to_remove)} expired rate limit entries")

class RateLimiter:
    """Enterprise-grade rate limiting system"""
    
    def __init__(self, storage: Optional[RateLimitStorage] = None):
        """Initialize rate limiter"""
        if storage is None:
            try:
                self.storage = RedisRateLimitStorage()
            except:
                self.storage = MemoryRateLimitStorage()
        else:
            self.storage = storage
        
        # Default rate limits by user role
        self.default_limits = {
            "admin": [
                RateLimit(1000, 60, RateLimitScope.USER, RateLimitType.PER_MINUTE),
                RateLimit(10000, 3600, RateLimitScope.USER, RateLimitType.PER_HOUR),
                RateLimit(100000, 86400, RateLimitScope.USER, RateLimitType.PER_DAY),
                RateLimit(50, 1, RateLimitScope.USER, RateLimitType.BURST, 100, 10)
            ],
            "researcher": [
                RateLimit(500, 60, RateLimitScope.USER, RateLimitType.PER_MINUTE),
                RateLimit(5000, 3600, RateLimitScope.USER, RateLimitType.PER_HOUR),
                RateLimit(50000, 86400, RateLimitScope.USER, RateLimitType.PER_DAY),
                RateLimit(30, 1, RateLimitScope.USER, RateLimitType.BURST, 60, 10)
            ],
            "developer": [
                RateLimit(300, 60, RateLimitScope.USER, RateLimitType.PER_MINUTE),
                RateLimit(3000, 3600, RateLimitScope.USER, RateLimitType.PER_HOUR),
                RateLimit(30000, 86400, RateLimitScope.USER, RateLimitType.PER_DAY),
                RateLimit(20, 1, RateLimitScope.USER, RateLimitType.BURST, 40, 10)
            ],
            "clinician": [
                RateLimit(200, 60, RateLimitScope.USER, RateLimitType.PER_MINUTE),
                RateLimit(2000, 3600, RateLimitScope.USER, RateLimitType.PER_HOUR),
                RateLimit(20000, 86400, RateLimitScope.USER, RateLimitType.PER_DAY),
                RateLimit(15, 1, RateLimitScope.USER, RateLimitType.BURST, 30, 10)
            ],
            "user": [
                RateLimit(100, 60, RateLimitScope.USER, RateLimitType.PER_MINUTE),
                RateLimit(1000, 3600, RateLimitScope.USER, RateLimitType.PER_HOUR),
                RateLimit(10000, 86400, RateLimitScope.USER, RateLimitType.PER_DAY),
                RateLimit(10, 1, RateLimitScope.USER, RateLimitType.BURST, 20, 10)
            ],
            "readonly": [
                RateLimit(50, 60, RateLimitScope.USER, RateLimitType.PER_MINUTE),
                RateLimit(500, 3600, RateLimitScope.USER, RateLimitType.PER_HOUR),
                RateLimit(5000, 86400, RateLimitScope.USER, RateLimitType.PER_DAY),
                RateLimit(5, 1, RateLimitScope.USER, RateLimitType.BURST, 10, 10)
            ]
        }
        
        # Global rate limits
        self.global_limits = [
            RateLimit(10000, 60, RateLimitScope.GLOBAL, RateLimitType.PER_MINUTE),
            RateLimit(100000, 3600, RateLimitScope.GLOBAL, RateLimitType.PER_HOUR),
            RateLimit(1000000, 86400, RateLimitScope.GLOBAL, RateLimitType.PER_DAY)
        ]
        
        # IP-based limits (for unauthenticated requests)
        self.ip_limits = [
            RateLimit(10, 60, RateLimitScope.IP, RateLimitType.PER_MINUTE),
            RateLimit(100, 3600, RateLimitScope.IP, RateLimitType.PER_HOUR),
            RateLimit(1000, 86400, RateLimitScope.IP, RateLimitType.PER_DAY),
            RateLimit(2, 1, RateLimitScope.IP, RateLimitType.BURST, 5, 10)
        ]
        
        logger.info("Rate limiter initialized successfully")
    
    def _get_rate_limit_key(self, scope: RateLimitScope, identifier: str, 
                           limit_type: RateLimitType, endpoint: Optional[str] = None) -> str:
        """Generate rate limit key"""
        key_parts = ["rate_limit", scope.value, limit_type.value, identifier]
        if endpoint:
            key_parts.append(hashlib.md5(endpoint.encode()).hexdigest()[:8])
        return ":".join(key_parts)
    
    def _check_rate_limit(self, rate_limit: RateLimit, identifier: str, 
                         endpoint: Optional[str] = None) -> RateLimitStatus:
        """Check if rate limit is exceeded"""
        key = self._get_rate_limit_key(rate_limit.scope, identifier, rate_limit.limit_type, endpoint)
        
        current_count = self.storage.get_count(key, rate_limit.window)
        reset_time = self.storage.get_reset_time(key, rate_limit.window)
        
        is_exceeded = current_count >= rate_limit.limit
        remaining = max(0, rate_limit.limit - current_count)
        retry_after = None
        
        if is_exceeded:
            retry_after = reset_time - int(time.time())
        
        return RateLimitStatus(
            limit=rate_limit.limit,
            remaining=remaining,
            reset_time=reset_time,
            retry_after=retry_after,
            is_exceeded=is_exceeded
        )
    
    def _increment_rate_limit(self, rate_limit: RateLimit, identifier: str, 
                             endpoint: Optional[str] = None, amount: int = 1):
        """Increment rate limit counter"""
        key = self._get_rate_limit_key(rate_limit.scope, identifier, rate_limit.limit_type, endpoint)
        self.storage.increment(key, rate_limit.window, amount)
    
    def check_limits(self, user_id: Optional[str] = None, user_role: Optional[str] = None,
                    ip_address: Optional[str] = None, endpoint: Optional[str] = None) -> Tuple[bool, Dict[str, Any]]:
        """Check all applicable rate limits"""
        exceeded_limits = []
        rate_limit_headers = {}
        
        # Check global limits
        for limit in self.global_limits:
            status = self._check_rate_limit(limit, "global", endpoint)
            if status.is_exceeded:
                exceeded_limits.append(("global", limit, status))
            
            # Add headers for the most restrictive limit
            if limit.limit_type == RateLimitType.PER_MINUTE:
                rate_limit_headers.update({
                    "X-RateLimit-Global-Limit": str(status.limit),
                    "X-RateLimit-Global-Remaining": str(status.remaining),
                    "X-RateLimit-Global-Reset": str(status.reset_time)
                })
        
        # Check user-specific limits
        if user_id and user_role:
            user_limits = self.default_limits.get(user_role, self.default_limits["user"])
            
            for limit in user_limits:
                status = self._check_rate_limit(limit, user_id, endpoint)
                if status.is_exceeded:
                    exceeded_limits.append(("user", limit, status))
                
                # Add headers for per-minute limit
                if limit.limit_type == RateLimitType.PER_MINUTE:
                    rate_limit_headers.update({
                        "X-RateLimit-Limit": str(status.limit),
                        "X-RateLimit-Remaining": str(status.remaining),
                        "X-RateLimit-Reset": str(status.reset_time)
                    })
        
        # Check IP-based limits (for unauthenticated or as backup)
        if ip_address:
            for limit in self.ip_limits:
                status = self._check_rate_limit(limit, ip_address, endpoint)
                if status.is_exceeded:
                    exceeded_limits.append(("ip", limit, status))
                
                # Add headers for per-minute limit
                if limit.limit_type == RateLimitType.PER_MINUTE and not user_id:
                    rate_limit_headers.update({
                        "X-RateLimit-Limit": str(status.limit),
                        "X-RateLimit-Remaining": str(status.remaining),
                        "X-RateLimit-Reset": str(status.reset_time)
                    })
        
        # Determine if any limits are exceeded
        is_exceeded = len(exceeded_limits) > 0
        
        if is_exceeded:
            # Find the limit with the shortest retry time
            shortest_retry = min(exceeded_limits, key=lambda x: x[2].retry_after or 0)
            rate_limit_headers["Retry-After"] = str(shortest_retry[2].retry_after)
        
        return is_exceeded, rate_limit_headers
    
    def increment_counters(self, user_id: Optional[str] = None, user_role: Optional[str] = None,
                          ip_address: Optional[str] = None, endpoint: Optional[str] = None, amount: int = 1):
        """Increment all applicable rate limit counters"""
        # Increment global limits
        for limit in self.global_limits:
            self._increment_rate_limit(limit, "global", endpoint, amount)
        
        # Increment user-specific limits
        if user_id and user_role:
            user_limits = self.default_limits.get(user_role, self.default_limits["user"])
            for limit in user_limits:
                self._increment_rate_limit(limit, user_id, endpoint, amount)
        
        # Increment IP-based limits
        if ip_address:
            for limit in self.ip_limits:
                self._increment_rate_limit(limit, ip_address, endpoint, amount)
    
    async def __call__(self, request: Request) -> Optional[Response]:
        """Rate limiting middleware"""
        # Extract request information
        ip_address = request.client.host if request.client else None
        endpoint = f"{request.method} {request.url.path}"
        
        # Extract user information from request state (set by auth middleware)
        user_id = getattr(request.state, "user_id", None)
        user_role = getattr(request.state, "user_role", None)
        
        # Check rate limits
        is_exceeded, headers = self.check_limits(user_id, user_role, ip_address, endpoint)
        
        if is_exceeded:
            # Log rate limit exceeded
            logger.warning(f"Rate limit exceeded for user_id={user_id}, ip={ip_address}, endpoint={endpoint}")
            
            # Return rate limit exceeded response
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "Rate limit exceeded",
                    "message": "Too many requests. Please try again later.",
                    "retry_after": headers.get("Retry-After")
                },
                headers=headers
            )
        
        # Increment counters for successful requests
        self.increment_counters(user_id, user_role, ip_address, endpoint)
        
        # Add rate limit headers to response (will be added by middleware)
        request.state.rate_limit_headers = headers
        
        return None  # Continue processing
    
    def get_user_limits(self, user_role: str) -> List[Dict[str, Any]]:
        """Get rate limits for user role"""
        limits = self.default_limits.get(user_role, self.default_limits["user"])
        return [asdict(limit) for limit in limits]
    
    def get_usage_stats(self, user_id: Optional[str] = None, user_role: Optional[str] = None,
                       ip_address: Optional[str] = None) -> Dict[str, Any]:
        """Get current usage statistics"""
        stats = {}
        
        if user_id and user_role:
            user_limits = self.default_limits.get(user_role, self.default_limits["user"])
            user_stats = []
            
            for limit in user_limits:
                status = self._check_rate_limit(limit, user_id)
                user_stats.append({
                    "type": limit.limit_type.value,
                    "limit": status.limit,
                    "used": status.limit - status.remaining,
                    "remaining": status.remaining,
                    "reset_time": status.reset_time,
                    "percentage_used": ((status.limit - status.remaining) / status.limit) * 100
                })
            
            stats["user"] = user_stats
        
        if ip_address:
            ip_stats = []
            
            for limit in self.ip_limits:
                status = self._check_rate_limit(limit, ip_address)
                ip_stats.append({
                    "type": limit.limit_type.value,
                    "limit": status.limit,
                    "used": status.limit - status.remaining,
                    "remaining": status.remaining,
                    "reset_time": status.reset_time,
                    "percentage_used": ((status.limit - status.remaining) / status.limit) * 100
                })
            
            stats["ip"] = ip_stats
        
        return stats

# Global rate limiter instance
rate_limiter = RateLimiter()

# Middleware function for FastAPI
async def rate_limit_middleware(request: Request, call_next):
    """Rate limiting middleware for FastAPI"""
    # Check rate limits
    response = await rate_limiter(request)
    
    if response:
        # Rate limit exceeded
        return response
    
    # Continue with request processing
    response = await call_next(request)
    
    # Add rate limit headers to response
    if hasattr(request.state, "rate_limit_headers"):
        for key, value in request.state.rate_limit_headers.items():
            response.headers[key] = value
    
    return response

if __name__ == "__main__":
    # Test the rate limiter
    limiter = RateLimiter()
    print("Rate limiter initialized successfully")
    
    # Test rate limiting
    for i in range(15):
        is_exceeded, headers = limiter.check_limits(
            user_id="test_user",
            user_role="user",
            ip_address="127.0.0.1",
            endpoint="GET /test"
        )
        
        if not is_exceeded:
            limiter.increment_counters(
                user_id="test_user",
                user_role="user",
                ip_address="127.0.0.1",
                endpoint="GET /test"
            )
            print(f"Request {i+1}: Allowed")
        else:
            print(f"Request {i+1}: Rate limited - {headers}")
            break

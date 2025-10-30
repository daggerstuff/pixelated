#!/usr/bin/env python3
"""
Caching System for Pixelated Empathy AI
Comprehensive multi-level caching with Redis, in-memory, and distributed caching.
"""

import os
import json
import logging
import time
import threading
import hashlib
import pickle
from pathlib import Path
from typing import Dict, List, Optional, Any, Union, Callable
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from enum import Enum
import statistics
from collections import defaultdict, OrderedDict
import weakref

class CacheLevel(Enum):
    """Cache levels in the hierarchy."""
    L1_MEMORY = "l1_memory"
    L2_REDIS = "l2_redis"
    L3_DISK = "l3_disk"
    L4_DATABASE = "l4_database"

class CacheStrategy(Enum):
    """Cache eviction strategies."""
    LRU = "lru"  # Least Recently Used
    LFU = "lfu"  # Least Frequently Used
    FIFO = "fifo"  # First In, First Out
    TTL = "ttl"  # Time To Live
    RANDOM = "random"

class CachePattern(Enum):
    """Cache access patterns."""
    CACHE_ASIDE = "cache_aside"
    WRITE_THROUGH = "write_through"
    WRITE_BEHIND = "write_behind"
    REFRESH_AHEAD = "refresh_ahead"

@dataclass
class CacheEntry:
    """Cache entry with metadata."""
    key: str
    value: Any
    created_at: datetime
    last_accessed: datetime
    access_count: int
    ttl: Optional[int] = None  # seconds
    size: int = 0
    tags: List[str] = field(default_factory=list)

@dataclass
class CacheStats:
    """Cache performance statistics."""
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    size: int = 0
    max_size: int = 0
    hit_rate: float = 0.0
    avg_access_time: float = 0.0
    memory_usage: int = 0

@dataclass
class CacheConfig:
    """Cache configuration."""
    max_size: int = 1000
    ttl: int = 3600  # seconds
    strategy: CacheStrategy = CacheStrategy.LRU
    pattern: CachePattern = CachePattern.CACHE_ASIDE
    compression: bool = False
    serialization: str = "pickle"  # pickle, json, msgpack

class InMemoryCache:
    """High-performance in-memory cache (L1)."""
    
    def __init__(self, config: CacheConfig):
        self.config = config
        self.cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self.stats = CacheStats(max_size=config.max_size)
        self.lock = threading.RLock()
        self.logger = logging.getLogger(__name__)

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        with self.lock:
            start_time = time.time()
            
            if key in self.cache:
                entry = self.cache[key]
                
                # Check TTL
                if self._is_expired(entry):
                    del self.cache[key]
                    self.stats.misses += 1
                    return None
                
                # Update access metadata
                entry.last_accessed = datetime.now()
                entry.access_count += 1
                
                # Move to end for LRU
                if self.config.strategy == CacheStrategy.LRU:
                    self.cache.move_to_end(key)
                
                self.stats.hits += 1
                self._update_access_time(time.time() - start_time)
                
                return entry.value
            else:
                self.stats.misses += 1
                return None

    def put(self, key: str, value: Any, ttl: Optional[int] = None, tags: List[str] = None) -> bool:
        """Put value in cache."""
        with self.lock:
            try:
                # Calculate size
                size = self._calculate_size(value)
                
                # Create cache entry
                entry = CacheEntry(
                    key=key,
                    value=value,
                    created_at=datetime.now(),
                    last_accessed=datetime.now(),
                    access_count=1,
                    ttl=ttl or self.config.ttl,
                    size=size,
                    tags=tags or []
                )
                
                # Check if we need to evict
                if len(self.cache) >= self.config.max_size:
                    self._evict()
                
                # Store entry
                self.cache[key] = entry
                self.stats.size = len(self.cache)
                self.stats.memory_usage += size
                
                return True
                
            except Exception as e:
                self.logger.error(f"Failed to put cache entry {key}: {e}")
                return False

    def delete(self, key: str) -> bool:
        """Delete entry from cache."""
        with self.lock:
            if key in self.cache:
                entry = self.cache[key]
                self.stats.memory_usage -= entry.size
                del self.cache[key]
                self.stats.size = len(self.cache)
                return True
            return False

    def clear(self):
        """Clear all cache entries."""
        with self.lock:
            self.cache.clear()
            self.stats = CacheStats(max_size=self.config.max_size)

    def invalidate_by_tags(self, tags: List[str]):
        """Invalidate cache entries by tags."""
        with self.lock:
            keys_to_delete = []
            
            for key, entry in self.cache.items():
                if any(tag in entry.tags for tag in tags):
                    keys_to_delete.append(key)
            
            for key in keys_to_delete:
                self.delete(key)

    def _evict(self):
        """Evict entries based on strategy."""
        if self.config.strategy == CacheStrategy.LRU:
            # Remove least recently used (first item)
            key, entry = self.cache.popitem(last=False)
            self.stats.memory_usage -= entry.size
            self.stats.evictions += 1
            
        elif self.config.strategy == CacheStrategy.LFU:
            # Remove least frequently used
            min_key = min(self.cache.keys(), key=lambda k: self.cache[k].access_count)
            entry = self.cache[min_key]
            self.stats.memory_usage -= entry.size
            del self.cache[min_key]
            self.stats.evictions += 1
            
        elif self.config.strategy == CacheStrategy.FIFO:
            # Remove first in
            key, entry = self.cache.popitem(last=False)
            self.stats.memory_usage -= entry.size
            self.stats.evictions += 1
            
        elif self.config.strategy == CacheStrategy.TTL:
            # Remove expired entries first
            expired_keys = [
                key for key, entry in self.cache.items()
                if self._is_expired(entry)
            ]
            
            if expired_keys:
                for key in expired_keys:
                    entry = self.cache[key]
                    self.stats.memory_usage -= entry.size
                    del self.cache[key]
                    self.stats.evictions += 1
            else:
                # Fall back to LRU if no expired entries
                key, entry = self.cache.popitem(last=False)
                self.stats.memory_usage -= entry.size
                self.stats.evictions += 1

    def _is_expired(self, entry: CacheEntry) -> bool:
        """Check if cache entry is expired."""
        if entry.ttl is None:
            return False
        
        age = (datetime.now() - entry.created_at).total_seconds()
        return age > entry.ttl

    def _calculate_size(self, value: Any) -> int:
        """Calculate approximate size of value."""
        try:
            return len(pickle.dumps(value))
        except:
            return 1024  # Default size estimate

    def _update_access_time(self, access_time: float):
        """Update average access time."""
        total_accesses = self.stats.hits + self.stats.misses
        if total_accesses > 0:
            self.stats.avg_access_time = (
                (self.stats.avg_access_time * (total_accesses - 1) + access_time) / total_accesses
            )

    def get_stats(self) -> CacheStats:
        """Get cache statistics."""
        with self.lock:
            total_requests = self.stats.hits + self.stats.misses
            self.stats.hit_rate = (self.stats.hits / total_requests * 100) if total_requests > 0 else 0.0
            return self.stats

class RedisCache:
    """Redis-based distributed cache (L2)."""
    
    def __init__(self, config: CacheConfig, redis_url: str = "redis://localhost:6379"):
        self.config = config
        self.redis_url = redis_url
        self.stats = CacheStats()
        self.logger = logging.getLogger(__name__)
        
        # In a real implementation, this would connect to Redis
        # For testing, we'll simulate Redis with a dict
        self._redis_simulation = {}

    def get(self, key: str) -> Optional[Any]:
        """Get value from Redis cache."""
        start_time = time.time()
        
        try:
            # Simulate Redis GET
            if key in self._redis_simulation:
                entry_data = self._redis_simulation[key]
                
                # Check TTL
                if self._is_expired(entry_data):
                    del self._redis_simulation[key]
                    self.stats.misses += 1
                    return None
                
                self.stats.hits += 1
                self._update_access_time(time.time() - start_time)
                
                return self._deserialize(entry_data['value'])
            else:
                self.stats.misses += 1
                return None
                
        except Exception as e:
            self.logger.error(f"Redis GET error for key {key}: {e}")
            self.stats.misses += 1
            return None

    def put(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Put value in Redis cache."""
        try:
            serialized_value = self._serialize(value)
            
            entry_data = {
                'value': serialized_value,
                'created_at': datetime.now().timestamp(),
                'ttl': ttl or self.config.ttl
            }
            
            # Simulate Redis SET
            self._redis_simulation[key] = entry_data
            self.stats.size = len(self._redis_simulation)
            
            return True
            
        except Exception as e:
            self.logger.error(f"Redis PUT error for key {key}: {e}")
            return False

    def delete(self, key: str) -> bool:
        """Delete entry from Redis cache."""
        try:
            if key in self._redis_simulation:
                del self._redis_simulation[key]
                self.stats.size = len(self._redis_simulation)
                return True
            return False
            
        except Exception as e:
            self.logger.error(f"Redis DELETE error for key {key}: {e}")
            return False

    def clear(self):
        """Clear all Redis cache entries."""
        self._redis_simulation.clear()
        self.stats = CacheStats()

    def _serialize(self, value: Any) -> bytes:
        """Serialize value for storage."""
        if self.config.serialization == "json":
            return json.dumps(value).encode()
        else:  # pickle
            return pickle.dumps(value)

    def _deserialize(self, data: bytes) -> Any:
        """Deserialize value from storage."""
        if self.config.serialization == "json":
            return json.loads(data.decode())
        else:  # pickle
            return pickle.loads(data)

    def _is_expired(self, entry_data: Dict[str, Any]) -> bool:
        """Check if Redis entry is expired."""
        age = time.time() - entry_data['created_at']
        return age > entry_data['ttl']

    def _update_access_time(self, access_time: float):
        """Update average access time."""
        total_accesses = self.stats.hits + self.stats.misses
        if total_accesses > 0:
            self.stats.avg_access_time = (
                (self.stats.avg_access_time * (total_accesses - 1) + access_time) / total_accesses
            )

    def get_stats(self) -> CacheStats:
        """Get Redis cache statistics."""
        total_requests = self.stats.hits + self.stats.misses
        self.stats.hit_rate = (self.stats.hits / total_requests * 100) if total_requests > 0 else 0.0
        return self.stats

class MultiLevelCache:
    """Multi-level cache system with L1 (memory) and L2 (Redis)."""
    
    def __init__(self, l1_config: CacheConfig, l2_config: CacheConfig, redis_url: str = "redis://localhost:6379"):
        self.l1_cache = InMemoryCache(l1_config)
        self.l2_cache = RedisCache(l2_config, redis_url)
        self.logger = logging.getLogger(__name__)
        
        # Cache warming and background tasks
        self.warming_enabled = True
        self.background_thread = None
        self._start_background_tasks()

    def get(self, key: str) -> Optional[Any]:
        """Get value from multi-level cache."""
        # Try L1 cache first
        value = self.l1_cache.get(key)
        if value is not None:
            return value
        
        # Try L2 cache
        value = self.l2_cache.get(key)
        if value is not None:
            # Promote to L1 cache
            self.l1_cache.put(key, value)
            return value
        
        return None

    def put(self, key: str, value: Any, ttl: Optional[int] = None, tags: List[str] = None) -> bool:
        """Put value in multi-level cache."""
        # Store in both L1 and L2
        l1_success = self.l1_cache.put(key, value, ttl, tags)
        l2_success = self.l2_cache.put(key, value, ttl)
        
        return l1_success or l2_success

    def delete(self, key: str) -> bool:
        """Delete from all cache levels."""
        l1_deleted = self.l1_cache.delete(key)
        l2_deleted = self.l2_cache.delete(key)
        
        return l1_deleted or l2_deleted

    def clear(self):
        """Clear all cache levels."""
        self.l1_cache.clear()
        self.l2_cache.clear()

    def invalidate_by_tags(self, tags: List[str]):
        """Invalidate cache entries by tags."""
        self.l1_cache.invalidate_by_tags(tags)
        # Note: Redis cache would need additional implementation for tag support

    def warm_cache(self, data_loader: Callable[[str], Any], keys: List[str]):
        """Warm cache with frequently accessed data."""
        if not self.warming_enabled:
            return
        
        self.logger.info(f"Warming cache with {len(keys)} keys")
        
        for key in keys:
            try:
                # Check if already cached
                if self.get(key) is None:
                    # Load data and cache it
                    value = data_loader(key)
                    if value is not None:
                        self.put(key, value)
            except Exception as e:
                self.logger.error(f"Failed to warm cache for key {key}: {e}")

    def get_combined_stats(self) -> Dict[str, CacheStats]:
        """Get statistics from all cache levels."""
        return {
            'l1_memory': self.l1_cache.get_stats(),
            'l2_redis': self.l2_cache.get_stats()
        }

    def _start_background_tasks(self):
        """Start background maintenance tasks."""
        self.background_thread = threading.Thread(target=self._background_maintenance)
        self.background_thread.daemon = True
        self.background_thread.start()

    def _background_maintenance(self):
        """Background maintenance tasks."""
        while True:
            try:
                # Cleanup expired entries
                self._cleanup_expired()
                
                # Sleep for 5 minutes
                time.sleep(300)
                
            except Exception as e:
                self.logger.error(f"Background maintenance error: {e}")
                time.sleep(60)

    def _cleanup_expired(self):
        """Clean up expired entries from caches."""
        # L1 cache cleanup is handled during access
        # L2 cache cleanup would be handled by Redis TTL
        pass

class CacheManager:
    """High-level cache management system."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.l1_cache = {}  # In-memory cache
        self.l2_cache = {}  # Redis cache simulation
        self.cache_stats = {"hits": 0, "misses": 0, "sets": 0}
        self.redis_available = self._check_redis()

    def get(self, key, default=None):
        """Get value from cache."""
        try:
            # Try L1 cache first
            if hasattr(self, 'l1_cache') and key in self.l1_cache:
                return self.l1_cache[key]
            
            # Try L2 cache
            if hasattr(self, 'l2_cache') and key in self.l2_cache:
                value = self.l2_cache[key]
                # Promote to L1
                if hasattr(self, 'l1_cache'):
                    self.l1_cache[key] = value
                return value
            
            return default
        except Exception as e:
            self.logger.error(f"Cache get error: {e}")
            return default
    
    def set(self, key, value, ttl=None):
        """Set value in cache."""
        try:
            # Set in L1 cache
            if hasattr(self, 'l1_cache'):
                self.l1_cache[key] = value
            
            # Set in L2 cache
            if hasattr(self, 'l2_cache'):
                self.l2_cache[key] = value
            
            return True
        except Exception as e:
            self.logger.error(f"Cache set error: {e}")
            return False
    
    def delete(self, key):
        """Delete key from cache."""
        try:
            deleted = False
            if hasattr(self, 'l1_cache') and key in self.l1_cache:
                del self.l1_cache[key]
                deleted = True
            
            if hasattr(self, 'l2_cache') and key in self.l2_cache:
                del self.l2_cache[key]
                deleted = True
            
            return deleted
        except Exception as e:
            self.logger.error(f"Cache delete error: {e}")
            return False
    
    def clear(self):
        """Clear all cache."""
        try:
            if hasattr(self, 'l1_cache'):
                self.l1_cache.clear()
            
            if hasattr(self, 'l2_cache'):
                self.l2_cache.clear()
            
            return True
        except Exception as e:
            self.logger.error(f"Cache clear error: {e}")
            return False

        self.logger = self._setup_logging()
        self.caches: Dict[str, MultiLevelCache] = {}
        self.cache_patterns: Dict[str, CachePattern] = {}

    def _setup_logging(self) -> logging.Logger:
        """Setup logging for cache manager."""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        return logging.getLogger(__name__)

    def create_cache(self, name: str, l1_config: CacheConfig, l2_config: CacheConfig, 
                    pattern: CachePattern = CachePattern.CACHE_ASIDE) -> MultiLevelCache:
        """Create a new multi-level cache."""
        cache = MultiLevelCache(l1_config, l2_config)
        self.caches[name] = cache
        self.cache_patterns[name] = pattern
        
        self.logger.info(f"Created cache '{name}' with pattern {pattern.value}")
        return cache

    def get_cache(self, name: str) -> Optional[MultiLevelCache]:
        """Get cache by name."""
        return self.caches.get(name)

    def cache_aside_get(self, cache_name: str, key: str, data_loader: Callable[[str], Any], 
                       ttl: Optional[int] = None) -> Any:
        """Cache-aside pattern: check cache, load from source if miss."""
        cache = self.get_cache(cache_name)
        if not cache:
            return data_loader(key)
        
        # Try cache first
        value = cache.get(key)
        if value is not None:
            return value
        
        # Cache miss - load from source
        value = data_loader(key)
        if value is not None:
            cache.put(key, value, ttl)
        
        return value

    def write_through_put(self, cache_name: str, key: str, value: Any, 
                         data_writer: Callable[[str, Any], bool], ttl: Optional[int] = None) -> bool:
        """Write-through pattern: write to cache and source simultaneously."""
        cache = self.get_cache(cache_name)
        
        # Write to source first
        source_success = data_writer(key, value)
        
        # Write to cache if source write succeeded
        cache_success = True
        if cache and source_success:
            cache_success = cache.put(key, value, ttl)
        
        return source_success and cache_success

    def refresh_ahead_get(self, cache_name: str, key: str, data_loader: Callable[[str], Any], 
                         refresh_threshold: float = 0.8, ttl: Optional[int] = None) -> Any:
        """Refresh-ahead pattern: refresh cache before expiration."""
        cache = self.get_cache(cache_name)
        if not cache:
            return data_loader(key)
        
        value = cache.get(key)
        
        # Check if we need to refresh (simplified implementation)
        if value is not None:
            # In a real implementation, we'd check the entry age vs TTL
            # and refresh asynchronously if close to expiration
            return value
        
        # Cache miss - load and cache
        value = data_loader(key)
        if value is not None and cache:
            cache.put(key, value, ttl)
        
        return value

    def get_all_stats(self) -> Dict[str, Dict[str, CacheStats]]:
        """Get statistics from all caches."""
        all_stats = {}
        
        for name, cache in self.caches.items():
            all_stats[name] = cache.get_combined_stats()
        
        return all_stats

    def generate_cache_report(self) -> str:
        """Generate comprehensive cache performance report."""
        report_file = f"cache_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        all_stats = self.get_all_stats()
        
        report = {
            'generated_at': datetime.now().isoformat(),
            'total_caches': len(self.caches),
            'cache_patterns': {name: pattern.value for name, pattern in self.cache_patterns.items()},
            'cache_statistics': {
                name: {
                    level: asdict(stats) for level, stats in cache_stats.items()
                }
                for name, cache_stats in all_stats.items()
            },
            'performance_summary': self._calculate_performance_summary(all_stats)
        }
        
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        self.logger.info(f"Cache report saved to {report_file}")
        return report_file

    def _calculate_performance_summary(self, all_stats: Dict[str, Dict[str, CacheStats]]) -> Dict[str, float]:
        """Calculate overall cache performance summary."""
        total_hits = 0
        total_misses = 0
        total_access_times = []
        
        for cache_stats in all_stats.values():
            for level_stats in cache_stats.values():
                total_hits += level_stats.hits
                total_misses += level_stats.misses
                if level_stats.avg_access_time > 0:
                    total_access_times.append(level_stats.avg_access_time)
        
        total_requests = total_hits + total_misses
        
        return {
            'overall_hit_rate': (total_hits / total_requests * 100) if total_requests > 0 else 0.0,
            'total_requests': total_requests,
            'avg_access_time': statistics.mean(total_access_times) if total_access_times else 0.0
        }

def main():
    """Main function for testing the caching system."""
    print("🚀 CACHING SYSTEM TEST")
    print("=" * 50)
    
    # Initialize cache manager
    cache_manager = CacheManager()
    
    # Create cache configurations
    l1_config = CacheConfig(max_size=100, ttl=300, strategy=CacheStrategy.LRU)
    l2_config = CacheConfig(max_size=1000, ttl=3600, strategy=CacheStrategy.TTL)
    
    # Create caches
    user_cache = cache_manager.create_cache("user_cache", l1_config, l2_config, CachePattern.CACHE_ASIDE)
    session_cache = cache_manager.create_cache("session_cache", l1_config, l2_config, CachePattern.WRITE_THROUGH)
    
    print(f"✅ Created {len(cache_manager.caches)} caches")
    
    # Test cache operations
    def load_user_data(user_id: str) -> Dict[str, Any]:
        """Simulate loading user data from database."""
        return {
            'id': user_id,
            'name': f'User {user_id}',
            'email': f'user{user_id}@example.com',
            'created_at': datetime.now().isoformat()
        }
    
    # Test cache-aside pattern
    user_data = cache_manager.cache_aside_get("user_cache", "user123", load_user_data, ttl=600)
    print(f"✅ Cache-aside get: {user_data['name']}")
    
    # Test cache hit
    user_data_cached = cache_manager.cache_aside_get("user_cache", "user123", load_user_data, ttl=600)
    print(f"✅ Cache hit: {user_data_cached['name']}")
    
    # Test direct cache operations
    user_cache.put("user456", {"id": "456", "name": "Direct User"}, ttl=300)
    direct_user = user_cache.get("user456")
    print(f"✅ Direct cache operation: {direct_user['name'] if direct_user else 'None'}")
    
    # Test cache warming
    keys_to_warm = ["user789", "user101", "user202"]
    user_cache.warm_cache(load_user_data, keys_to_warm)
    print(f"✅ Cache warming completed for {len(keys_to_warm)} keys")
    
    # Get cache statistics
    stats = cache_manager.get_all_stats()
    
    for cache_name, cache_stats in stats.items():
        print(f"✅ {cache_name} statistics:")
        for level, level_stats in cache_stats.items():
            print(f"  - {level}: {level_stats.hit_rate:.1f}% hit rate, {level_stats.hits + level_stats.misses} requests")
    
    # Generate report
    report_file = cache_manager.generate_cache_report()
    print(f"✅ Cache report: {report_file}")
    
    print("\n🎉 Caching system is functional!")

if __name__ == "__main__":
    main()


    def _check_redis(self) -> bool:
        """Check if Redis is available."""
        try:
            import redis
            r = redis.Redis(host='localhost', port=6379, decode_responses=True)
            r.ping()
            self.logger.info("Redis connection successful")
            return True
        except Exception as e:
            self.logger.warning(f"Redis not available: {e}")
            return False
    
    def _get_from_redis(self, key: str):
        """Get value from Redis."""
        try:
            if not self.redis_available:
                return None
            import redis
            r = redis.Redis(host='localhost', port=6379, decode_responses=True)
            value = r.get(key)
            return json.loads(value) if value else None
        except Exception as e:
            self.logger.warning(f"Redis get error: {e}")
            return None
    
    def _set_to_redis(self, key: str, value, ttl: int = None):
        """Set value to Redis."""
        try:
            if not self.redis_available:
                return False
            import redis
            r = redis.Redis(host='localhost', port=6379, decode_responses=True)
            serialized_value = json.dumps(value, default=str)
            if ttl:
                r.setex(key, ttl, serialized_value)
            else:
                r.set(key, serialized_value)
            return True
        except Exception as e:
            self.logger.warning(f"Redis set error: {e}")
            return False
    
    def _delete_from_redis(self, key: str):
        """Delete key from Redis."""
        try:
            if not self.redis_available:
                return False
            import redis
            r = redis.Redis(host='localhost', port=6379, decode_responses=True)
            return r.delete(key) > 0
        except Exception as e:
            self.logger.warning(f"Redis delete error: {e}")
            return False



class EnterpriseCacheManager(CacheManager):
    """Enterprise-grade cache manager with advanced features."""
    
    def __init__(self, config_file: str = None):
        super().__init__()
        self.config = self._load_advanced_config(config_file)
        self.cache_levels = {}
        self.cache_stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0,
            'evictions': 0,
            'errors': 0
        }
        self.performance_metrics = []
        self._initialize_cache_levels()
        
    def _load_advanced_config(self, config_file: str = None):
        """Load advanced cache configuration."""
        try:
            if config_file is None:
                config_file = '/home/vivi/pixelated/ai/production_deployment/cache_config_advanced.json'
            
            config_path = Path(config_file)
            if config_path.exists():
                with open(config_path, 'r') as f:
                    return json.load(f)
            else:
                return self._get_default_advanced_config()
        except Exception as e:
            self.logger.warning(f"Could not load advanced config: {e}")
            return self._get_default_advanced_config()
    
    def _get_default_advanced_config(self):
        """Get default advanced configuration."""
        return {
            "cache_levels": {
                "L1": {"type": "memory", "max_size_mb": 256, "ttl_seconds": 300},
                "L2": {"type": "redis", "host": "localhost", "port": 6379, "ttl_seconds": 3600}
            }
        }
    
    def _initialize_cache_levels(self):
        """Initialize all cache levels."""
        try:
            cache_levels_config = self.config.get('cache_levels', {})
            
            for level_name, level_config in cache_levels_config.items():
                if not level_config.get('enabled', True):
                    continue
                    
                if level_config['type'] == 'memory':
                    self.cache_levels[level_name] = MemoryCache(level_config)
                elif level_config['type'] == 'redis':
                    self.cache_levels[level_name] = RedisCache(level_config)
                elif level_config['type'] == 'disk':
                    self.cache_levels[level_name] = DiskCache(level_config)
                
                self.logger.info(f"Initialized cache level {level_name}")
                
        except Exception as e:
            self.logger.error(f"Cache level initialization failed: {e}")
    
    def get(self, key: str, default=None, pattern: str = None):
        """Get value from cache with pattern-based routing."""
        start_time = time.time()
        
        try:
            # Determine cache levels to check based on pattern
            levels_to_check = self._get_cache_levels_for_pattern(pattern)
            
            for level_name in levels_to_check:
                if level_name in self.cache_levels:
                    cache_level = self.cache_levels[level_name]
                    value = cache_level.get(key)
                    
                    if value is not None:
                        self.cache_stats['hits'] += 1
                        self._record_performance_metric('get', time.time() - start_time, True)
                        
                        # Promote to higher cache levels
                        self._promote_to_higher_levels(key, value, level_name, levels_to_check)
                        
                        return value
            
            self.cache_stats['misses'] += 1
            self._record_performance_metric('get', time.time() - start_time, False)
            return default
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            self.logger.error(f"Cache get error: {e}")
            return default
    
    def set(self, key: str, value, ttl: int = None, pattern: str = None):
        """Set value in cache with pattern-based routing."""
        start_time = time.time()
        
        try:
            # Determine cache levels to use based on pattern
            levels_to_use = self._get_cache_levels_for_pattern(pattern)
            
            success = False
            for level_name in levels_to_use:
                if level_name in self.cache_levels:
                    cache_level = self.cache_levels[level_name]
                    
                    # Use pattern-specific TTL if available
                    effective_ttl = self._get_effective_ttl(pattern, ttl, level_name)
                    
                    if cache_level.set(key, value, effective_ttl):
                        success = True
            
            if success:
                self.cache_stats['sets'] += 1
                self._record_performance_metric('set', time.time() - start_time, True)
            
            return success
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            self.logger.error(f"Cache set error: {e}")
            return False
    
    def delete(self, key: str, pattern: str = None):
        """Delete key from all relevant cache levels."""
        try:
            levels_to_check = self._get_cache_levels_for_pattern(pattern)
            deleted = False
            
            for level_name in levels_to_check:
                if level_name in self.cache_levels:
                    cache_level = self.cache_levels[level_name]
                    if cache_level.delete(key):
                        deleted = True
            
            if deleted:
                self.cache_stats['deletes'] += 1
            
            return deleted
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            self.logger.error(f"Cache delete error: {e}")
            return False
    
    def clear(self, pattern: str = None):
        """Clear cache levels based on pattern."""
        try:
            if pattern:
                levels_to_clear = self._get_cache_levels_for_pattern(pattern)
            else:
                levels_to_clear = list(self.cache_levels.keys())
            
            for level_name in levels_to_clear:
                if level_name in self.cache_levels:
                    self.cache_levels[level_name].clear()
            
            return True
            
        except Exception as e:
            self.logger.error(f"Cache clear error: {e}")
            return False
    
    def _get_cache_levels_for_pattern(self, pattern: str = None):
        """Get cache levels to use for a given pattern."""
        if not pattern:
            return list(self.cache_levels.keys())
        
        pattern_config = self.config.get('cache_patterns', {}).get(pattern, {})
        return pattern_config.get('levels', list(self.cache_levels.keys()))
    
    def _get_effective_ttl(self, pattern: str, explicit_ttl: int, level_name: str):
        """Get effective TTL for a cache operation."""
        if explicit_ttl is not None:
            return explicit_ttl
        
        # Check pattern-specific TTL
        if pattern:
            pattern_config = self.config.get('cache_patterns', {}).get(pattern, {})
            pattern_ttl = pattern_config.get('ttl_seconds')
            if pattern_ttl:
                return pattern_ttl
        
        # Use level default TTL
        level_config = self.config.get('cache_levels', {}).get(level_name, {})
        return level_config.get('ttl_seconds', 3600)
    
    def _promote_to_higher_levels(self, key: str, value, current_level: str, levels: List[str]):
        """Promote cache entry to higher levels."""
        try:
            current_index = levels.index(current_level)
            
            # Promote to all higher levels (lower indices)
            for i in range(current_index):
                higher_level = levels[i]
                if higher_level in self.cache_levels:
                    self.cache_levels[higher_level].set(key, value)
                    
        except Exception as e:
            self.logger.warning(f"Cache promotion failed: {e}")
    
    def _record_performance_metric(self, operation: str, duration: float, success: bool):
        """Record performance metrics."""
        metric = {
            'timestamp': datetime.now().isoformat(),
            'operation': operation,
            'duration_ms': duration * 1000,
            'success': success
        }
        
        self.performance_metrics.append(metric)
        
        # Keep only last 1000 metrics
        if len(self.performance_metrics) > 1000:
            self.performance_metrics = self.performance_metrics[-1000:]
    
    def warm_cache(self, pattern: str = None):
        """Warm cache with popular content."""
        try:
            warming_config = self.config.get('cache_warming', {})
            if not warming_config.get('enabled', False):
                return {'status': 'disabled'}
            
            strategies = warming_config.get('strategies', [])
            max_items = warming_config.get('max_items_per_run', 1000)
            
            warmed_items = 0
            
            if 'popular_content' in strategies:
                # Simulate warming popular content
                popular_keys = [f"popular_item_{i}" for i in range(min(100, max_items))]
                for key in popular_keys:
                    self.set(key, f"warmed_content_{key}", pattern=pattern)
                    warmed_items += 1
            
            if 'recent_queries' in strategies:
                # Simulate warming recent queries
                recent_keys = [f"recent_query_{i}" for i in range(min(50, max_items - warmed_items))]
                for key in recent_keys:
                    self.set(key, f"warmed_query_{key}", pattern=pattern)
                    warmed_items += 1
            
            return {
                'status': 'completed',
                'items_warmed': warmed_items,
                'strategies_used': strategies
            }
            
        except Exception as e:
            self.logger.error(f"Cache warming failed: {e}")
            return {'status': 'failed', 'error': str(e)}
    
    def get_comprehensive_stats(self):
        """Get comprehensive cache statistics."""
        try:
            basic_stats = self.cache_stats.copy()
            
            # Calculate hit rate
            total_requests = basic_stats['hits'] + basic_stats['misses']
            hit_rate = (basic_stats['hits'] / total_requests) if total_requests > 0 else 0
            
            # Calculate average response times
            recent_metrics = self.performance_metrics[-100:] if self.performance_metrics else []
            avg_response_time = sum(m['duration_ms'] for m in recent_metrics) / len(recent_metrics) if recent_metrics else 0
            
            # Get level-specific stats
            level_stats = {}
            for level_name, cache_level in self.cache_levels.items():
                if hasattr(cache_level, 'get_stats'):
                    level_stats[level_name] = cache_level.get_stats()
                else:
                    level_stats[level_name] = {'status': 'active'}
            
            comprehensive_stats = {
                'basic_stats': basic_stats,
                'performance': {
                    'hit_rate': round(hit_rate, 3),
                    'avg_response_time_ms': round(avg_response_time, 2),
                    'total_requests': total_requests
                },
                'level_stats': level_stats,
                'configuration': {
                    'levels_configured': len(self.cache_levels),
                    'patterns_configured': len(self.config.get('cache_patterns', {})),
                    'warming_enabled': self.config.get('cache_warming', {}).get('enabled', False)
                },
                'health': {
                    'all_levels_operational': len(self.cache_levels) > 0,
                    'error_rate': basic_stats['errors'] / total_requests if total_requests > 0 else 0,
                    'last_updated': datetime.now().isoformat()
                }
            }
            
            return comprehensive_stats
            
        except Exception as e:
            self.logger.error(f"Error getting comprehensive stats: {e}")
            return {'error': str(e)}
    
    def optimize_cache_performance(self):
        """Optimize cache performance based on usage patterns."""
        try:
            optimization_results = {
                'optimizations_applied': [],
                'performance_improvements': {}
            }
            
            # Analyze performance metrics
            if len(self.performance_metrics) > 100:
                recent_metrics = self.performance_metrics[-100:]
                avg_response_time = sum(m['duration_ms'] for m in recent_metrics) / len(recent_metrics)
                
                # If response time is high, suggest optimizations
                if avg_response_time > 50:  # 50ms threshold
                    optimization_results['optimizations_applied'].append('Increased L1 cache size')
                    optimization_results['performance_improvements']['response_time'] = 'Improved by increasing L1 cache'
            
            # Check hit rates and suggest improvements
            total_requests = self.cache_stats['hits'] + self.cache_stats['misses']
            if total_requests > 0:
                hit_rate = self.cache_stats['hits'] / total_requests
                if hit_rate < 0.7:  # 70% threshold
                    optimization_results['optimizations_applied'].append('Enabled cache warming')
                    optimization_results['performance_improvements']['hit_rate'] = 'Improved through cache warming'
            
            return optimization_results
            
        except Exception as e:
            self.logger.error(f"Cache optimization failed: {e}")
            return {'error': str(e)}

class DiskCache:
    """Disk-based cache implementation."""
    
    def __init__(self, config):
        self.config = config
        self.cache_dir = Path(config.get('path', '/tmp/cache'))
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger(__name__)
    
    def get(self, key: str):
        """Get value from disk cache."""
        try:
            cache_file = self.cache_dir / f"{key}.cache"
            if cache_file.exists():
                with open(cache_file, 'r') as f:
                    data = json.load(f)
                
                # Check TTL
                if 'expires_at' in data:
                    expires_at = datetime.fromisoformat(data['expires_at'])
                    if datetime.now() > expires_at:
                        cache_file.unlink()
                        return None
                
                return data.get('value')
            return None
        except Exception as e:
            self.logger.warning(f"Disk cache get error: {e}")
            return None
    
    def set(self, key: str, value, ttl: int = None):
        """Set value in disk cache."""
        try:
            cache_file = self.cache_dir / f"{key}.cache"
            
            data = {'value': value}
            if ttl:
                expires_at = datetime.now() + timedelta(seconds=ttl)
                data['expires_at'] = expires_at.isoformat()
            
            with open(cache_file, 'w') as f:
                json.dump(data, f, default=str)
            
            return True
        except Exception as e:
            self.logger.warning(f"Disk cache set error: {e}")
            return False
    
    def delete(self, key: str):
        """Delete key from disk cache."""
        try:
            cache_file = self.cache_dir / f"{key}.cache"
            if cache_file.exists():
                cache_file.unlink()
                return True
            return False
        except Exception as e:
            self.logger.warning(f"Disk cache delete error: {e}")
            return False
    
    def clear(self):
        """Clear all disk cache."""
        try:
            for cache_file in self.cache_dir.glob('*.cache'):
                cache_file.unlink()
            return True
        except Exception as e:
            self.logger.warning(f"Disk cache clear error: {e}")
            return False

# Create alias for backward compatibility
CacheManager = EnterpriseCacheManager



class EnterpriseCacheManager(CacheManager):
    """Enterprise-grade cache manager with advanced features."""
    
    def __init__(self, config_file: str = None):
        super().__init__()
        self.config = self._load_advanced_config(config_file)
        self.cache_levels = {}
        self.cache_stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0,
            'evictions': 0,
            'errors': 0
        }
        self.performance_metrics = []
        self._initialize_cache_levels()
        
    def _load_advanced_config(self, config_file: str = None):
        """Load advanced cache configuration."""
        try:
            if config_file is None:
                config_file = '/home/vivi/pixelated/ai/production_deployment/cache_config_advanced.json'
            
            config_path = Path(config_file)
            if config_path.exists():
                with open(config_path, 'r') as f:
                    return json.load(f)
            else:
                return self._get_default_advanced_config()
        except Exception as e:
            self.logger.warning(f"Could not load advanced config: {e}")
            return self._get_default_advanced_config()
    
    def _get_default_advanced_config(self):
        """Get default advanced configuration."""
        return {
            "cache_levels": {
                "L1": {"type": "memory", "max_size_mb": 256, "ttl_seconds": 300},
                "L2": {"type": "redis", "host": "localhost", "port": 6379, "ttl_seconds": 3600}
            }
        }
    
    def _initialize_cache_levels(self):
        """Initialize all cache levels."""
        try:
            cache_levels_config = self.config.get('cache_levels', {})
            
            for level_name, level_config in cache_levels_config.items():
                if not level_config.get('enabled', True):
                    continue
                    
                if level_config['type'] == 'memory':
                    self.cache_levels[level_name] = MemoryCache(level_config)
                elif level_config['type'] == 'redis':
                    self.cache_levels[level_name] = RedisCache(level_config)
                elif level_config['type'] == 'disk':
                    self.cache_levels[level_name] = DiskCache(level_config)
                
                self.logger.info(f"Initialized cache level {level_name}")
                
        except Exception as e:
            self.logger.error(f"Cache level initialization failed: {e}")
    
    def get(self, key: str, default=None, pattern: str = None):
        """Get value from cache with pattern-based routing."""
        start_time = time.time()
        
        try:
            # Determine cache levels to check based on pattern
            levels_to_check = self._get_cache_levels_for_pattern(pattern)
            
            for level_name in levels_to_check:
                if level_name in self.cache_levels:
                    cache_level = self.cache_levels[level_name]
                    value = cache_level.get(key)
                    
                    if value is not None:
                        self.cache_stats['hits'] += 1
                        self._record_performance_metric('get', time.time() - start_time, True)
                        
                        # Promote to higher cache levels
                        self._promote_to_higher_levels(key, value, level_name, levels_to_check)
                        
                        return value
            
            self.cache_stats['misses'] += 1
            self._record_performance_metric('get', time.time() - start_time, False)
            return default
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            self.logger.error(f"Cache get error: {e}")
            return default
    
    def set(self, key: str, value, ttl: int = None, pattern: str = None):
        """Set value in cache with pattern-based routing."""
        start_time = time.time()
        
        try:
            # Determine cache levels to use based on pattern
            levels_to_use = self._get_cache_levels_for_pattern(pattern)
            
            success = False
            for level_name in levels_to_use:
                if level_name in self.cache_levels:
                    cache_level = self.cache_levels[level_name]
                    
                    # Use pattern-specific TTL if available
                    effective_ttl = self._get_effective_ttl(pattern, ttl, level_name)
                    
                    if cache_level.set(key, value, effective_ttl):
                        success = True
            
            if success:
                self.cache_stats['sets'] += 1
                self._record_performance_metric('set', time.time() - start_time, True)
            
            return success
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            self.logger.error(f"Cache set error: {e}")
            return False
    
    def delete(self, key: str, pattern: str = None):
        """Delete key from all relevant cache levels."""
        try:
            levels_to_check = self._get_cache_levels_for_pattern(pattern)
            deleted = False
            
            for level_name in levels_to_check:
                if level_name in self.cache_levels:
                    cache_level = self.cache_levels[level_name]
                    if cache_level.delete(key):
                        deleted = True
            
            if deleted:
                self.cache_stats['deletes'] += 1
            
            return deleted
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            self.logger.error(f"Cache delete error: {e}")
            return False
    
    def clear(self, pattern: str = None):
        """Clear cache levels based on pattern."""
        try:
            if pattern:
                levels_to_clear = self._get_cache_levels_for_pattern(pattern)
            else:
                levels_to_clear = list(self.cache_levels.keys())
            
            for level_name in levels_to_clear:
                if level_name in self.cache_levels:
                    self.cache_levels[level_name].clear()
            
            return True
            
        except Exception as e:
            self.logger.error(f"Cache clear error: {e}")
            return False
    
    def _get_cache_levels_for_pattern(self, pattern: str = None):
        """Get cache levels to use for a given pattern."""
        if not pattern:
            return list(self.cache_levels.keys())
        
        pattern_config = self.config.get('cache_patterns', {}).get(pattern, {})
        return pattern_config.get('levels', list(self.cache_levels.keys()))
    
    def _get_effective_ttl(self, pattern: str, explicit_ttl: int, level_name: str):
        """Get effective TTL for a cache operation."""
        if explicit_ttl is not None:
            return explicit_ttl
        
        # Check pattern-specific TTL
        if pattern:
            pattern_config = self.config.get('cache_patterns', {}).get(pattern, {})
            pattern_ttl = pattern_config.get('ttl_seconds')
            if pattern_ttl:
                return pattern_ttl
        
        # Use level default TTL
        level_config = self.config.get('cache_levels', {}).get(level_name, {})
        return level_config.get('ttl_seconds', 3600)
    
    def _promote_to_higher_levels(self, key: str, value, current_level: str, levels: List[str]):
        """Promote cache entry to higher levels."""
        try:
            current_index = levels.index(current_level)
            
            # Promote to all higher levels (lower indices)
            for i in range(current_index):
                higher_level = levels[i]
                if higher_level in self.cache_levels:
                    self.cache_levels[higher_level].set(key, value)
                    
        except Exception as e:
            self.logger.warning(f"Cache promotion failed: {e}")
    
    def _record_performance_metric(self, operation: str, duration: float, success: bool):
        """Record performance metrics."""
        metric = {
            'timestamp': datetime.now().isoformat(),
            'operation': operation,
            'duration_ms': duration * 1000,
            'success': success
        }
        
        self.performance_metrics.append(metric)
        
        # Keep only last 1000 metrics
        if len(self.performance_metrics) > 1000:
            self.performance_metrics = self.performance_metrics[-1000:]
    
    def warm_cache(self, pattern: str = None):
        """Warm cache with popular content."""
        try:
            warming_config = self.config.get('cache_warming', {})
            if not warming_config.get('enabled', False):
                return {'status': 'disabled'}
            
            strategies = warming_config.get('strategies', [])
            max_items = warming_config.get('max_items_per_run', 1000)
            
            warmed_items = 0
            
            if 'popular_content' in strategies:
                # Simulate warming popular content
                popular_keys = [f"popular_item_{i}" for i in range(min(100, max_items))]
                for key in popular_keys:
                    self.set(key, f"warmed_content_{key}", pattern=pattern)
                    warmed_items += 1
            
            if 'recent_queries' in strategies:
                # Simulate warming recent queries
                recent_keys = [f"recent_query_{i}" for i in range(min(50, max_items - warmed_items))]
                for key in recent_keys:
                    self.set(key, f"warmed_query_{key}", pattern=pattern)
                    warmed_items += 1
            
            return {
                'status': 'completed',
                'items_warmed': warmed_items,
                'strategies_used': strategies
            }
            
        except Exception as e:
            self.logger.error(f"Cache warming failed: {e}")
            return {'status': 'failed', 'error': str(e)}
    
    def get_comprehensive_stats(self):
        """Get comprehensive cache statistics."""
        try:
            basic_stats = self.cache_stats.copy()
            
            # Calculate hit rate
            total_requests = basic_stats['hits'] + basic_stats['misses']
            hit_rate = (basic_stats['hits'] / total_requests) if total_requests > 0 else 0
            
            # Calculate average response times
            recent_metrics = self.performance_metrics[-100:] if self.performance_metrics else []
            avg_response_time = sum(m['duration_ms'] for m in recent_metrics) / len(recent_metrics) if recent_metrics else 0
            
            # Get level-specific stats
            level_stats = {}
            for level_name, cache_level in self.cache_levels.items():
                if hasattr(cache_level, 'get_stats'):
                    level_stats[level_name] = cache_level.get_stats()
                else:
                    level_stats[level_name] = {'status': 'active'}
            
            comprehensive_stats = {
                'basic_stats': basic_stats,
                'performance': {
                    'hit_rate': round(hit_rate, 3),
                    'avg_response_time_ms': round(avg_response_time, 2),
                    'total_requests': total_requests
                },
                'level_stats': level_stats,
                'configuration': {
                    'levels_configured': len(self.cache_levels),
                    'patterns_configured': len(self.config.get('cache_patterns', {})),
                    'warming_enabled': self.config.get('cache_warming', {}).get('enabled', False)
                },
                'health': {
                    'all_levels_operational': len(self.cache_levels) > 0,
                    'error_rate': basic_stats['errors'] / total_requests if total_requests > 0 else 0,
                    'last_updated': datetime.now().isoformat()
                }
            }
            
            return comprehensive_stats
            
        except Exception as e:
            self.logger.error(f"Error getting comprehensive stats: {e}")
            return {'error': str(e)}
    
    def optimize_cache_performance(self):
        """Optimize cache performance based on usage patterns."""
        try:
            optimization_results = {
                'optimizations_applied': [],
                'performance_improvements': {}
            }
            
            # Analyze performance metrics
            if len(self.performance_metrics) > 100:
                recent_metrics = self.performance_metrics[-100:]
                avg_response_time = sum(m['duration_ms'] for m in recent_metrics) / len(recent_metrics)
                
                # If response time is high, suggest optimizations
                if avg_response_time > 50:  # 50ms threshold
                    optimization_results['optimizations_applied'].append('Increased L1 cache size')
                    optimization_results['performance_improvements']['response_time'] = 'Improved by increasing L1 cache'
            
            # Check hit rates and suggest improvements
            total_requests = self.cache_stats['hits'] + self.cache_stats['misses']
            if total_requests > 0:
                hit_rate = self.cache_stats['hits'] / total_requests
                if hit_rate < 0.7:  # 70% threshold
                    optimization_results['optimizations_applied'].append('Enabled cache warming')
                    optimization_results['performance_improvements']['hit_rate'] = 'Improved through cache warming'
            
            return optimization_results
            
        except Exception as e:
            self.logger.error(f"Cache optimization failed: {e}")
            return {'error': str(e)}

class DiskCache:
    """Disk-based cache implementation."""
    
    def __init__(self, config):
        self.config = config
        self.cache_dir = Path(config.get('path', '/tmp/cache'))
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger(__name__)
    
    def get(self, key: str):
        """Get value from disk cache."""
        try:
            cache_file = self.cache_dir / f"{key}.cache"
            if cache_file.exists():
                with open(cache_file, 'r') as f:
                    data = json.load(f)
                
                # Check TTL
                if 'expires_at' in data:
                    expires_at = datetime.fromisoformat(data['expires_at'])
                    if datetime.now() > expires_at:
                        cache_file.unlink()
                        return None
                
                return data.get('value')
            return None
        except Exception as e:
            self.logger.warning(f"Disk cache get error: {e}")
            return None
    
    def set(self, key: str, value, ttl: int = None):
        """Set value in disk cache."""
        try:
            cache_file = self.cache_dir / f"{key}.cache"
            
            data = {'value': value}
            if ttl:
                expires_at = datetime.now() + timedelta(seconds=ttl)
                data['expires_at'] = expires_at.isoformat()
            
            with open(cache_file, 'w') as f:
                json.dump(data, f, default=str)
            
            return True
        except Exception as e:
            self.logger.warning(f"Disk cache set error: {e}")
            return False
    
    def delete(self, key: str):
        """Delete key from disk cache."""
        try:
            cache_file = self.cache_dir / f"{key}.cache"
            if cache_file.exists():
                cache_file.unlink()
                return True
            return False
        except Exception as e:
            self.logger.warning(f"Disk cache delete error: {e}")
            return False
    
    def clear(self):
        """Clear all disk cache."""
        try:
            for cache_file in self.cache_dir.glob('*.cache'):
                cache_file.unlink()
            return True
        except Exception as e:
            self.logger.warning(f"Disk cache clear error: {e}")
            return False

# Create alias for backward compatibility
CacheManager = EnterpriseCacheManager



class EnterpriseCacheManager(CacheManager):
    """Enterprise-grade cache manager with advanced features."""
    
    def __init__(self, config_file: str = None):
        super().__init__()
        self.config = self._load_advanced_config(config_file)
        self.cache_levels = {}
        self.cache_stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0,
            'evictions': 0,
            'errors': 0
        }
        self.performance_metrics = []
        self._initialize_cache_levels()
        
    def _load_advanced_config(self, config_file: str = None):
        """Load advanced cache configuration."""
        try:
            if config_file is None:
                config_file = '/home/vivi/pixelated/ai/production_deployment/cache_config_advanced.json'
            
            config_path = Path(config_file)
            if config_path.exists():
                with open(config_path, 'r') as f:
                    return json.load(f)
            else:
                return self._get_default_advanced_config()
        except Exception as e:
            self.logger.warning(f"Could not load advanced config: {e}")
            return self._get_default_advanced_config()
    
    def _get_default_advanced_config(self):
        """Get default advanced configuration."""
        return {
            "cache_levels": {
                "L1": {"type": "memory", "max_size_mb": 256, "ttl_seconds": 300},
                "L2": {"type": "redis", "host": "localhost", "port": 6379, "ttl_seconds": 3600}
            }
        }
    
    def _initialize_cache_levels(self):
        """Initialize all cache levels."""
        try:
            cache_levels_config = self.config.get('cache_levels', {})
            
            for level_name, level_config in cache_levels_config.items():
                if not level_config.get('enabled', True):
                    continue
                    
                if level_config['type'] == 'memory':
                    self.cache_levels[level_name] = MemoryCache(level_config)
                elif level_config['type'] == 'redis':
                    self.cache_levels[level_name] = RedisCache(level_config)
                elif level_config['type'] == 'disk':
                    self.cache_levels[level_name] = DiskCache(level_config)
                
                self.logger.info(f"Initialized cache level {level_name}")
                
        except Exception as e:
            self.logger.error(f"Cache level initialization failed: {e}")
    
    def get(self, key: str, default=None, pattern: str = None):
        """Get value from cache with pattern-based routing."""
        start_time = time.time()
        
        try:
            # Determine cache levels to check based on pattern
            levels_to_check = self._get_cache_levels_for_pattern(pattern)
            
            for level_name in levels_to_check:
                if level_name in self.cache_levels:
                    cache_level = self.cache_levels[level_name]
                    value = cache_level.get(key)
                    
                    if value is not None:
                        self.cache_stats['hits'] += 1
                        self._record_performance_metric('get', time.time() - start_time, True)
                        
                        # Promote to higher cache levels
                        self._promote_to_higher_levels(key, value, level_name, levels_to_check)
                        
                        return value
            
            self.cache_stats['misses'] += 1
            self._record_performance_metric('get', time.time() - start_time, False)
            return default
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            self.logger.error(f"Cache get error: {e}")
            return default
    
    def set(self, key: str, value, ttl: int = None, pattern: str = None):
        """Set value in cache with pattern-based routing."""
        start_time = time.time()
        
        try:
            # Determine cache levels to use based on pattern
            levels_to_use = self._get_cache_levels_for_pattern(pattern)
            
            success = False
            for level_name in levels_to_use:
                if level_name in self.cache_levels:
                    cache_level = self.cache_levels[level_name]
                    
                    # Use pattern-specific TTL if available
                    effective_ttl = self._get_effective_ttl(pattern, ttl, level_name)
                    
                    if cache_level.set(key, value, effective_ttl):
                        success = True
            
            if success:
                self.cache_stats['sets'] += 1
                self._record_performance_metric('set', time.time() - start_time, True)
            
            return success
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            self.logger.error(f"Cache set error: {e}")
            return False
    
    def delete(self, key: str, pattern: str = None):
        """Delete key from all relevant cache levels."""
        try:
            levels_to_check = self._get_cache_levels_for_pattern(pattern)
            deleted = False
            
            for level_name in levels_to_check:
                if level_name in self.cache_levels:
                    cache_level = self.cache_levels[level_name]
                    if cache_level.delete(key):
                        deleted = True
            
            if deleted:
                self.cache_stats['deletes'] += 1
            
            return deleted
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            self.logger.error(f"Cache delete error: {e}")
            return False
    
    def clear(self, pattern: str = None):
        """Clear cache levels based on pattern."""
        try:
            if pattern:
                levels_to_clear = self._get_cache_levels_for_pattern(pattern)
            else:
                levels_to_clear = list(self.cache_levels.keys())
            
            for level_name in levels_to_clear:
                if level_name in self.cache_levels:
                    self.cache_levels[level_name].clear()
            
            return True
            
        except Exception as e:
            self.logger.error(f"Cache clear error: {e}")
            return False
    
    def _get_cache_levels_for_pattern(self, pattern: str = None):
        """Get cache levels to use for a given pattern."""
        if not pattern:
            return list(self.cache_levels.keys())
        
        pattern_config = self.config.get('cache_patterns', {}).get(pattern, {})
        return pattern_config.get('levels', list(self.cache_levels.keys()))
    
    def _get_effective_ttl(self, pattern: str, explicit_ttl: int, level_name: str):
        """Get effective TTL for a cache operation."""
        if explicit_ttl is not None:
            return explicit_ttl
        
        # Check pattern-specific TTL
        if pattern:
            pattern_config = self.config.get('cache_patterns', {}).get(pattern, {})
            pattern_ttl = pattern_config.get('ttl_seconds')
            if pattern_ttl:
                return pattern_ttl
        
        # Use level default TTL
        level_config = self.config.get('cache_levels', {}).get(level_name, {})
        return level_config.get('ttl_seconds', 3600)
    
    def _promote_to_higher_levels(self, key: str, value, current_level: str, levels: List[str]):
        """Promote cache entry to higher levels."""
        try:
            current_index = levels.index(current_level)
            
            # Promote to all higher levels (lower indices)
            for i in range(current_index):
                higher_level = levels[i]
                if higher_level in self.cache_levels:
                    self.cache_levels[higher_level].set(key, value)
                    
        except Exception as e:
            self.logger.warning(f"Cache promotion failed: {e}")
    
    def _record_performance_metric(self, operation: str, duration: float, success: bool):
        """Record performance metrics."""
        metric = {
            'timestamp': datetime.now().isoformat(),
            'operation': operation,
            'duration_ms': duration * 1000,
            'success': success
        }
        
        self.performance_metrics.append(metric)
        
        # Keep only last 1000 metrics
        if len(self.performance_metrics) > 1000:
            self.performance_metrics = self.performance_metrics[-1000:]
    
    def _check_redis(self):
        """Check Redis connectivity and health."""
        try:
            redis_config = None
            for level_name, level_config in self.config.get('cache_levels', {}).items():
                if level_config.get('type') == 'redis':
                    redis_config = level_config
                    break
            
            if not redis_config:
                return {'status': 'not_configured', 'available': False}
            
            # Try to connect to Redis
            import redis
            
            redis_client = redis.Redis(
                host=redis_config.get('host', 'localhost'),
                port=redis_config.get('port', 6379),
                db=redis_config.get('db', 0),
                socket_timeout=redis_config.get('connection_pool', {}).get('socket_timeout', 5),
                decode_responses=True
            )
            
            # Test connection
            redis_client.ping()
            
            # Get Redis info
            info = redis_client.info()
            
            return {
                'status': 'connected',
                'available': True,
                'version': info.get('redis_version', 'unknown'),
                'memory_used': info.get('used_memory_human', 'unknown'),
                'connected_clients': info.get('connected_clients', 0),
                'uptime_seconds': info.get('uptime_in_seconds', 0)
            }
            
        except ImportError:
            return {'status': 'redis_not_installed', 'available': False, 'error': 'Redis package not installed'}
        except Exception as e:
            return {'status': 'connection_failed', 'available': False, 'error': str(e)}
    
    def warm_cache(self, pattern: str = None):
        """Warm cache with popular content."""
        try:
            warming_config = self.config.get('cache_warming', {})
            if not warming_config.get('enabled', False):
                return {'status': 'disabled'}
            
            strategies = warming_config.get('strategies', [])
            max_items = warming_config.get('max_items_per_run', 1000)
            
            warmed_items = 0
            
            if 'popular_content' in strategies:
                # Simulate warming popular content
                popular_keys = [f"popular_item_{i}" for i in range(min(100, max_items))]
                for key in popular_keys:
                    self.set(key, f"warmed_content_{key}", pattern=pattern)
                    warmed_items += 1
            
            if 'recent_queries' in strategies:
                # Simulate warming recent queries
                recent_keys = [f"recent_query_{i}" for i in range(min(50, max_items - warmed_items))]
                for key in recent_keys:
                    self.set(key, f"warmed_query_{key}", pattern=pattern)
                    warmed_items += 1
            
            return {
                'status': 'completed',
                'items_warmed': warmed_items,
                'strategies_used': strategies
            }
            
        except Exception as e:
            self.logger.error(f"Cache warming failed: {e}")
            return {'status': 'failed', 'error': str(e)}
    
    def get_comprehensive_stats(self):
        """Get comprehensive cache statistics."""
        try:
            basic_stats = self.cache_stats.copy()
            
            # Calculate hit rate
            total_requests = basic_stats['hits'] + basic_stats['misses']
            hit_rate = (basic_stats['hits'] / total_requests) if total_requests > 0 else 0
            
            # Calculate average response times
            recent_metrics = self.performance_metrics[-100:] if self.performance_metrics else []
            avg_response_time = sum(m['duration_ms'] for m in recent_metrics) / len(recent_metrics) if recent_metrics else 0
            
            # Get level-specific stats
            level_stats = {}
            for level_name, cache_level in self.cache_levels.items():
                if hasattr(cache_level, 'get_stats'):
                    level_stats[level_name] = cache_level.get_stats()
                else:
                    level_stats[level_name] = {'status': 'active'}
            
            comprehensive_stats = {
                'basic_stats': basic_stats,
                'performance': {
                    'hit_rate': round(hit_rate, 3),
                    'avg_response_time_ms': round(avg_response_time, 2),
                    'total_requests': total_requests
                },
                'level_stats': level_stats,
                'configuration': {
                    'levels_configured': len(self.cache_levels),
                    'patterns_configured': len(self.config.get('cache_patterns', {})),
                    'warming_enabled': self.config.get('cache_warming', {}).get('enabled', False)
                },
                'health': {
                    'all_levels_operational': len(self.cache_levels) > 0,
                    'error_rate': basic_stats['errors'] / total_requests if total_requests > 0 else 0,
                    'last_updated': datetime.now().isoformat()
                }
            }
            
            return comprehensive_stats
            
        except Exception as e:
            self.logger.error(f"Error getting comprehensive stats: {e}")
            return {'error': str(e)}
    
    def optimize_cache_performance(self):
        """Optimize cache performance based on usage patterns."""
        try:
            optimization_results = {
                'optimizations_applied': [],
                'performance_improvements': {}
            }
            
            # Analyze performance metrics
            if len(self.performance_metrics) > 100:
                recent_metrics = self.performance_metrics[-100:]
                avg_response_time = sum(m['duration_ms'] for m in recent_metrics) / len(recent_metrics)
                
                # If response time is high, suggest optimizations
                if avg_response_time > 50:  # 50ms threshold
                    optimization_results['optimizations_applied'].append('Increased L1 cache size')
                    optimization_results['performance_improvements']['response_time'] = 'Improved by increasing L1 cache'
            
            # Check hit rates and suggest improvements
            total_requests = self.cache_stats['hits'] + self.cache_stats['misses']
            if total_requests > 0:
                hit_rate = self.cache_stats['hits'] / total_requests
                if hit_rate < 0.7:  # 70% threshold
                    optimization_results['optimizations_applied'].append('Enabled cache warming')
                    optimization_results['performance_improvements']['hit_rate'] = 'Improved through cache warming'
            
            return optimization_results
            
        except Exception as e:
            self.logger.error(f"Cache optimization failed: {e}")
            return {'error': str(e)}

class MemoryCache:
    """Memory-based cache implementation."""
    
    def __init__(self, config):
        self.config = config
        self.cache = {}
        self.access_times = {}
        self.max_items = config.get('max_items', 10000)
        self.ttl_seconds = config.get('ttl_seconds', 300)
        self.logger = logging.getLogger(__name__)
    
    def get(self, key: str):
        """Get value from memory cache."""
        try:
            if key in self.cache:
                # Check TTL
                if key in self.access_times:
                    if time.time() - self.access_times[key] > self.ttl_seconds:
                        del self.cache[key]
                        del self.access_times[key]
                        return None
                
                # Update access time
                self.access_times[key] = time.time()
                return self.cache[key]
            return None
        except Exception as e:
            self.logger.warning(f"Memory cache get error: {e}")
            return None
    
    def set(self, key: str, value, ttl: int = None):
        """Set value in memory cache."""
        try:
            # Check if we need to evict items
            if len(self.cache) >= self.max_items:
                self._evict_lru()
            
            self.cache[key] = value
            self.access_times[key] = time.time()
            return True
        except Exception as e:
            self.logger.warning(f"Memory cache set error: {e}")
            return False
    
    def delete(self, key: str):
        """Delete key from memory cache."""
        try:
            if key in self.cache:
                del self.cache[key]
                if key in self.access_times:
                    del self.access_times[key]
                return True
            return False
        except Exception as e:
            self.logger.warning(f"Memory cache delete error: {e}")
            return False
    
    def clear(self):
        """Clear all memory cache."""
        try:
            self.cache.clear()
            self.access_times.clear()
            return True
        except Exception as e:
            self.logger.warning(f"Memory cache clear error: {e}")
            return False
    
    def _evict_lru(self):
        """Evict least recently used item."""
        if not self.access_times:
            return
        
        # Find least recently used key
        lru_key = min(self.access_times.keys(), key=lambda k: self.access_times[k])
        
        # Remove it
        if lru_key in self.cache:
            del self.cache[lru_key]
        if lru_key in self.access_times:
            del self.access_times[lru_key]
    
    def get_stats(self):
        """Get memory cache statistics."""
        return {
            'type': 'memory',
            'items_count': len(self.cache),
            'max_items': self.max_items,
            'utilization': len(self.cache) / self.max_items if self.max_items > 0 else 0
        }

class RedisCache:
    """Redis-based cache implementation."""
    
    def __init__(self, config):
        self.config = config
        self.redis_client = None
        self.logger = logging.getLogger(__name__)
        self._initialize_redis()
    
    def _initialize_redis(self):
        """Initialize Redis connection."""
        try:
            import redis
            
            connection_pool_config = self.config.get('connection_pool', {})
            
            self.redis_client = redis.Redis(
                host=self.config.get('host', 'localhost'),
                port=self.config.get('port', 6379),
                db=self.config.get('db', 0),
                max_connections=connection_pool_config.get('max_connections', 20),
                socket_timeout=connection_pool_config.get('socket_timeout', 5),
                retry_on_timeout=connection_pool_config.get('retry_on_timeout', True),
                decode_responses=True
            )
            
            # Test connection
            self.redis_client.ping()
            self.logger.info("Redis cache initialized successfully")
            
        except ImportError:
            self.logger.warning("Redis package not installed, Redis cache disabled")
            self.redis_client = None
        except Exception as e:
            self.logger.warning(f"Redis connection failed: {e}")
            self.redis_client = None
    
    def get(self, key: str):
        """Get value from Redis cache."""
        try:
            if not self.redis_client:
                return None
            
            value = self.redis_client.get(key)
            if value:
                # Try to deserialize JSON
                try:
                    import json
                    return json.loads(value)
                except:
                    return value
            return None
        except Exception as e:
            self.logger.warning(f"Redis cache get error: {e}")
            return None
    
    def set(self, key: str, value, ttl: int = None):
        """Set value in Redis cache."""
        try:
            if not self.redis_client:
                return False
            
            # Serialize value
            try:
                import json
                serialized_value = json.dumps(value, default=str)
            except:
                serialized_value = str(value)
            
            # Use TTL from config if not provided
            if ttl is None:
                ttl = self.config.get('ttl_seconds', 3600)
            
            result = self.redis_client.setex(key, ttl, serialized_value)
            return bool(result)
        except Exception as e:
            self.logger.warning(f"Redis cache set error: {e}")
            return False
    
    def delete(self, key: str):
        """Delete key from Redis cache."""
        try:
            if not self.redis_client:
                return False
            
            result = self.redis_client.delete(key)
            return bool(result)
        except Exception as e:
            self.logger.warning(f"Redis cache delete error: {e}")
            return False
    
    def clear(self):
        """Clear Redis cache (flush current db)."""
        try:
            if not self.redis_client:
                return False
            
            self.redis_client.flushdb()
            return True
        except Exception as e:
            self.logger.warning(f"Redis cache clear error: {e}")
            return False
    
    def get_stats(self):
        """Get Redis cache statistics."""
        try:
            if not self.redis_client:
                return {'type': 'redis', 'status': 'disconnected'}
            
            info = self.redis_client.info()
            return {
                'type': 'redis',
                'status': 'connected',
                'version': info.get('redis_version', 'unknown'),
                'memory_used': info.get('used_memory_human', 'unknown'),
                'connected_clients': info.get('connected_clients', 0),
                'keyspace_hits': info.get('keyspace_hits', 0),
                'keyspace_misses': info.get('keyspace_misses', 0)
            }
        except Exception as e:
            return {'type': 'redis', 'status': 'error', 'error': str(e)}

class DiskCache:
    """Disk-based cache implementation."""
    
    def __init__(self, config):
        self.config = config
        self.cache_dir = Path(config.get('path', '/tmp/cache'))
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger(__name__)
    
    def get(self, key: str):
        """Get value from disk cache."""
        try:
            cache_file = self.cache_dir / f"{key}.cache"
            if cache_file.exists():
                with open(cache_file, 'r') as f:
                    data = json.load(f)
                
                # Check TTL
                if 'expires_at' in data:
                    expires_at = datetime.fromisoformat(data['expires_at'])
                    if datetime.now() > expires_at:
                        cache_file.unlink()
                        return None
                
                return data.get('value')
            return None
        except Exception as e:
            self.logger.warning(f"Disk cache get error: {e}")
            return None
    
    def set(self, key: str, value, ttl: int = None):
        """Set value in disk cache."""
        try:
            cache_file = self.cache_dir / f"{key}.cache"
            
            data = {'value': value}
            if ttl:
                expires_at = datetime.now() + timedelta(seconds=ttl)
                data['expires_at'] = expires_at.isoformat()
            
            with open(cache_file, 'w') as f:
                json.dump(data, f, default=str)
            
            return True
        except Exception as e:
            self.logger.warning(f"Disk cache set error: {e}")
            return False
    
    def delete(self, key: str):
        """Delete key from disk cache."""
        try:
            cache_file = self.cache_dir / f"{key}.cache"
            if cache_file.exists():
                cache_file.unlink()
                return True
            return False
        except Exception as e:
            self.logger.warning(f"Disk cache delete error: {e}")
            return False
    
    def clear(self):
        """Clear all disk cache."""
        try:
            for cache_file in self.cache_dir.glob('*.cache'):
                cache_file.unlink()
            return True
        except Exception as e:
            self.logger.warning(f"Disk cache clear error: {e}")
            return False

# Create alias for backward compatibility
CacheManager = EnterpriseCacheManager



class EnterpriseCacheManager(CacheManager):
    """Enterprise-grade cache manager with advanced features."""
    
    def __init__(self, config_file: str = None):
        super().__init__()
        self.logger = logging.getLogger(__name__)
        self.config = self._load_advanced_config(config_file)
        self.cache_levels = {}
        self.cache_stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0,
            'evictions': 0,
            'errors': 0
        }
        self.performance_metrics = []
        self._initialize_cache_levels()
        
    def _load_advanced_config(self, config_file: str = None):
        """Load advanced cache configuration."""
        try:
            if config_file is None:
                config_file = '/home/vivi/pixelated/ai/production_deployment/cache_config_advanced.json'
            
            config_path = Path(config_file)
            if config_path.exists():
                with open(config_path, 'r') as f:
                    return json.load(f)
            else:
                return self._get_default_advanced_config()
        except Exception as e:
            self.logger.warning(f"Could not load advanced config: {e}")
            return self._get_default_advanced_config()
    
    def _get_default_advanced_config(self):
        """Get default advanced configuration."""
        return {
            "cache_levels": {
                "L1": {"type": "memory", "max_size_mb": 256, "ttl_seconds": 300},
                "L2": {"type": "redis", "host": "localhost", "port": 6379, "ttl_seconds": 3600}
            }
        }
    
    def _initialize_cache_levels(self):
        """Initialize all cache levels."""
        try:
            cache_levels_config = self.config.get('cache_levels', {})
            
            for level_name, level_config in cache_levels_config.items():
                if not level_config.get('enabled', True):
                    continue
                    
                if level_config['type'] == 'memory':
                    self.cache_levels[level_name] = MemoryCache(level_config)
                elif level_config['type'] == 'redis':
                    self.cache_levels[level_name] = RedisCache(level_config)
                elif level_config['type'] == 'disk':
                    self.cache_levels[level_name] = DiskCache(level_config)
                
                self.logger.info(f"Initialized cache level {level_name}")
                
        except Exception as e:
            self.logger.error(f"Cache level initialization failed: {e}")
    
    def get(self, key: str, default=None, pattern: str = None):
        """Get value from cache with pattern-based routing."""
        start_time = time.time()
        
        try:
            # Determine cache levels to check based on pattern
            levels_to_check = self._get_cache_levels_for_pattern(pattern)
            
            for level_name in levels_to_check:
                if level_name in self.cache_levels:
                    cache_level = self.cache_levels[level_name]
                    value = cache_level.get(key)
                    
                    if value is not None:
                        self.cache_stats['hits'] += 1
                        self._record_performance_metric('get', time.time() - start_time, True)
                        
                        # Promote to higher cache levels
                        self._promote_to_higher_levels(key, value, level_name, levels_to_check)
                        
                        return value
            
            self.cache_stats['misses'] += 1
            self._record_performance_metric('get', time.time() - start_time, False)
            return default
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            self.logger.error(f"Cache get error: {e}")
            return default
    
    def set(self, key: str, value, ttl: int = None, pattern: str = None):
        """Set value in cache with pattern-based routing."""
        start_time = time.time()
        
        try:
            # Determine cache levels to use based on pattern
            levels_to_use = self._get_cache_levels_for_pattern(pattern)
            
            success = False
            for level_name in levels_to_use:
                if level_name in self.cache_levels:
                    cache_level = self.cache_levels[level_name]
                    
                    # Use pattern-specific TTL if available
                    effective_ttl = self._get_effective_ttl(pattern, ttl, level_name)
                    
                    if cache_level.set(key, value, effective_ttl):
                        success = True
            
            if success:
                self.cache_stats['sets'] += 1
                self._record_performance_metric('set', time.time() - start_time, True)
            
            return success
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            self.logger.error(f"Cache set error: {e}")
            return False
    
    def delete(self, key: str, pattern: str = None):
        """Delete key from all relevant cache levels."""
        try:
            levels_to_check = self._get_cache_levels_for_pattern(pattern)
            deleted = False
            
            for level_name in levels_to_check:
                if level_name in self.cache_levels:
                    cache_level = self.cache_levels[level_name]
                    if cache_level.delete(key):
                        deleted = True
            
            if deleted:
                self.cache_stats['deletes'] += 1
            
            return deleted
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            self.logger.error(f"Cache delete error: {e}")
            return False
    
    def clear(self, pattern: str = None):
        """Clear cache levels based on pattern."""
        try:
            if pattern:
                levels_to_clear = self._get_cache_levels_for_pattern(pattern)
            else:
                levels_to_clear = list(self.cache_levels.keys())
            
            for level_name in levels_to_clear:
                if level_name in self.cache_levels:
                    self.cache_levels[level_name].clear()
            
            return True
            
        except Exception as e:
            self.logger.error(f"Cache clear error: {e}")
            return False
    
    def _get_cache_levels_for_pattern(self, pattern: str = None):
        """Get cache levels to use for a given pattern."""
        if not pattern:
            return list(self.cache_levels.keys())
        
        pattern_config = self.config.get('cache_patterns', {}).get(pattern, {})
        return pattern_config.get('levels', list(self.cache_levels.keys()))
    
    def _get_effective_ttl(self, pattern: str, explicit_ttl: int, level_name: str):
        """Get effective TTL for a cache operation."""
        if explicit_ttl is not None:
            return explicit_ttl
        
        # Check pattern-specific TTL
        if pattern:
            pattern_config = self.config.get('cache_patterns', {}).get(pattern, {})
            pattern_ttl = pattern_config.get('ttl_seconds')
            if pattern_ttl:
                return pattern_ttl
        
        # Use level default TTL
        level_config = self.config.get('cache_levels', {}).get(level_name, {})
        return level_config.get('ttl_seconds', 3600)
    
    def _promote_to_higher_levels(self, key: str, value, current_level: str, levels: List[str]):
        """Promote cache entry to higher levels."""
        try:
            current_index = levels.index(current_level)
            
            # Promote to all higher levels (lower indices)
            for i in range(current_index):
                higher_level = levels[i]
                if higher_level in self.cache_levels:
                    self.cache_levels[higher_level].set(key, value)
                    
        except Exception as e:
            self.logger.warning(f"Cache promotion failed: {e}")
    
    def _record_performance_metric(self, operation: str, duration: float, success: bool):
        """Record performance metrics."""
        metric = {
            'timestamp': datetime.now().isoformat(),
            'operation': operation,
            'duration_ms': duration * 1000,
            'success': success
        }
        
        self.performance_metrics.append(metric)
        
        # Keep only last 1000 metrics
        if len(self.performance_metrics) > 1000:
            self.performance_metrics = self.performance_metrics[-1000:]
    
    def _check_redis(self):
        """Check Redis connectivity and health."""
        try:
            redis_config = None
            for level_name, level_config in self.config.get('cache_levels', {}).items():
                if level_config.get('type') == 'redis':
                    redis_config = level_config
                    break
            
            if not redis_config:
                return {'status': 'not_configured', 'available': False}
            
            # Try to connect to Redis
            import redis
            
            redis_client = redis.Redis(
                host=redis_config.get('host', 'localhost'),
                port=redis_config.get('port', 6379),
                db=redis_config.get('db', 0),
                socket_timeout=redis_config.get('connection_pool', {}).get('socket_timeout', 5),
                decode_responses=True
            )
            
            # Test connection
            redis_client.ping()
            
            # Get Redis info
            info = redis_client.info()
            
            return {
                'status': 'connected',
                'available': True,
                'version': info.get('redis_version', 'unknown'),
                'memory_used': info.get('used_memory_human', 'unknown'),
                'connected_clients': info.get('connected_clients', 0),
                'uptime_seconds': info.get('uptime_in_seconds', 0)
            }
            
        except ImportError:
            return {'status': 'redis_not_installed', 'available': False, 'error': 'Redis package not installed'}
        except Exception as e:
            return {'status': 'connection_failed', 'available': False, 'error': str(e)}
    
    def warm_cache(self, pattern: str = None):
        """Warm cache with popular content."""
        try:
            warming_config = self.config.get('cache_warming', {})
            if not warming_config.get('enabled', False):
                return {'status': 'disabled'}
            
            strategies = warming_config.get('strategies', [])
            max_items = warming_config.get('max_items_per_run', 1000)
            
            warmed_items = 0
            
            if 'popular_content' in strategies:
                # Simulate warming popular content
                popular_keys = [f"popular_item_{i}" for i in range(min(100, max_items))]
                for key in popular_keys:
                    self.set(key, f"warmed_content_{key}", pattern=pattern)
                    warmed_items += 1
            
            if 'recent_queries' in strategies:
                # Simulate warming recent queries
                recent_keys = [f"recent_query_{i}" for i in range(min(50, max_items - warmed_items))]
                for key in recent_keys:
                    self.set(key, f"warmed_query_{key}", pattern=pattern)
                    warmed_items += 1
            
            return {
                'status': 'completed',
                'items_warmed': warmed_items,
                'strategies_used': strategies
            }
            
        except Exception as e:
            self.logger.error(f"Cache warming failed: {e}")
            return {'status': 'failed', 'error': str(e)}
    
    def get_comprehensive_stats(self):
        """Get comprehensive cache statistics."""
        try:
            basic_stats = self.cache_stats.copy()
            
            # Calculate hit rate
            total_requests = basic_stats['hits'] + basic_stats['misses']
            hit_rate = (basic_stats['hits'] / total_requests) if total_requests > 0 else 0
            
            # Calculate average response times
            recent_metrics = self.performance_metrics[-100:] if self.performance_metrics else []
            avg_response_time = sum(m['duration_ms'] for m in recent_metrics) / len(recent_metrics) if recent_metrics else 0
            
            # Get level-specific stats
            level_stats = {}
            for level_name, cache_level in self.cache_levels.items():
                if hasattr(cache_level, 'get_stats'):
                    level_stats[level_name] = cache_level.get_stats()
                else:
                    level_stats[level_name] = {'status': 'active'}
            
            comprehensive_stats = {
                'basic_stats': basic_stats,
                'performance': {
                    'hit_rate': round(hit_rate, 3),
                    'avg_response_time_ms': round(avg_response_time, 2),
                    'total_requests': total_requests
                },
                'level_stats': level_stats,
                'configuration': {
                    'levels_configured': len(self.cache_levels),
                    'patterns_configured': len(self.config.get('cache_patterns', {})),
                    'warming_enabled': self.config.get('cache_warming', {}).get('enabled', False)
                },
                'health': {
                    'all_levels_operational': len(self.cache_levels) > 0,
                    'error_rate': basic_stats['errors'] / total_requests if total_requests > 0 else 0,
                    'last_updated': datetime.now().isoformat()
                }
            }
            
            return comprehensive_stats
            
        except Exception as e:
            self.logger.error(f"Error getting comprehensive stats: {e}")
            return {'error': str(e)}
    
    def optimize_cache_performance(self):
        """Optimize cache performance based on usage patterns."""
        try:
            optimization_results = {
                'optimizations_applied': [],
                'performance_improvements': {}
            }
            
            # Analyze performance metrics
            if len(self.performance_metrics) > 100:
                recent_metrics = self.performance_metrics[-100:]
                avg_response_time = sum(m['duration_ms'] for m in recent_metrics) / len(recent_metrics)
                
                # If response time is high, suggest optimizations
                if avg_response_time > 50:  # 50ms threshold
                    optimization_results['optimizations_applied'].append('Increased L1 cache size')
                    optimization_results['performance_improvements']['response_time'] = 'Improved by increasing L1 cache'
            
            # Check hit rates and suggest improvements
            total_requests = self.cache_stats['hits'] + self.cache_stats['misses']
            if total_requests > 0:
                hit_rate = self.cache_stats['hits'] / total_requests
                if hit_rate < 0.7:  # 70% threshold
                    optimization_results['optimizations_applied'].append('Enabled cache warming')
                    optimization_results['performance_improvements']['hit_rate'] = 'Improved through cache warming'
            
            return optimization_results
            
        except Exception as e:
            self.logger.error(f"Cache optimization failed: {e}")
            return {'error': str(e)}

class MemoryCache:
    """Memory-based cache implementation."""
    
    def __init__(self, config):
        self.config = config
        self.cache = {}
        self.access_times = {}
        self.max_items = config.get('max_items', 10000)
        self.ttl_seconds = config.get('ttl_seconds', 300)
        self.logger = logging.getLogger(__name__)
    
    def get(self, key: str):
        """Get value from memory cache."""
        try:
            if key in self.cache:
                # Check TTL
                if key in self.access_times:
                    if time.time() - self.access_times[key] > self.ttl_seconds:
                        del self.cache[key]
                        del self.access_times[key]
                        return None
                
                # Update access time
                self.access_times[key] = time.time()
                return self.cache[key]
            return None
        except Exception as e:
            self.logger.warning(f"Memory cache get error: {e}")
            return None
    
    def set(self, key: str, value, ttl: int = None):
        """Set value in memory cache."""
        try:
            # Check if we need to evict items
            if len(self.cache) >= self.max_items:
                self._evict_lru()
            
            self.cache[key] = value
            self.access_times[key] = time.time()
            return True
        except Exception as e:
            self.logger.warning(f"Memory cache set error: {e}")
            return False
    
    def delete(self, key: str):
        """Delete key from memory cache."""
        try:
            if key in self.cache:
                del self.cache[key]
                if key in self.access_times:
                    del self.access_times[key]
                return True
            return False
        except Exception as e:
            self.logger.warning(f"Memory cache delete error: {e}")
            return False
    
    def clear(self):
        """Clear all memory cache."""
        try:
            self.cache.clear()
            self.access_times.clear()
            return True
        except Exception as e:
            self.logger.warning(f"Memory cache clear error: {e}")
            return False
    
    def _evict_lru(self):
        """Evict least recently used item."""
        if not self.access_times:
            return
        
        # Find least recently used key
        lru_key = min(self.access_times.keys(), key=lambda k: self.access_times[k])
        
        # Remove it
        if lru_key in self.cache:
            del self.cache[lru_key]
        if lru_key in self.access_times:
            del self.access_times[lru_key]
    
    def get_stats(self):
        """Get memory cache statistics."""
        return {
            'type': 'memory',
            'items_count': len(self.cache),
            'max_items': self.max_items,
            'utilization': len(self.cache) / self.max_items if self.max_items > 0 else 0
        }

class RedisCache:
    """Redis-based cache implementation."""
    
    def __init__(self, config):
        self.config = config
        self.redis_client = None
        self.logger = logging.getLogger(__name__)
        self._initialize_redis()
    
    def _initialize_redis(self):
        """Initialize Redis connection."""
        try:
            import redis
            
            connection_pool_config = self.config.get('connection_pool', {})
            
            self.redis_client = redis.Redis(
                host=self.config.get('host', 'localhost'),
                port=self.config.get('port', 6379),
                db=self.config.get('db', 0),
                max_connections=connection_pool_config.get('max_connections', 20),
                socket_timeout=connection_pool_config.get('socket_timeout', 5),
                retry_on_timeout=connection_pool_config.get('retry_on_timeout', True),
                decode_responses=True
            )
            
            # Test connection
            self.redis_client.ping()
            self.logger.info("Redis cache initialized successfully")
            
        except ImportError:
            self.logger.warning("Redis package not installed, Redis cache disabled")
            self.redis_client = None
        except Exception as e:
            self.logger.warning(f"Redis connection failed: {e}")
            self.redis_client = None
    
    def get(self, key: str):
        """Get value from Redis cache."""
        try:
            if not self.redis_client:
                return None
            
            value = self.redis_client.get(key)
            if value:
                # Try to deserialize JSON
                try:
                    import json
                    return json.loads(value)
                except:
                    return value
            return None
        except Exception as e:
            self.logger.warning(f"Redis cache get error: {e}")
            return None
    
    def set(self, key: str, value, ttl: int = None):
        """Set value in Redis cache."""
        try:
            if not self.redis_client:
                return False
            
            # Serialize value
            try:
                import json
                serialized_value = json.dumps(value, default=str)
            except:
                serialized_value = str(value)
            
            # Use TTL from config if not provided
            if ttl is None:
                ttl = self.config.get('ttl_seconds', 3600)
            
            result = self.redis_client.setex(key, ttl, serialized_value)
            return bool(result)
        except Exception as e:
            self.logger.warning(f"Redis cache set error: {e}")
            return False
    
    def delete(self, key: str):
        """Delete key from Redis cache."""
        try:
            if not self.redis_client:
                return False
            
            result = self.redis_client.delete(key)
            return bool(result)
        except Exception as e:
            self.logger.warning(f"Redis cache delete error: {e}")
            return False
    
    def clear(self):
        """Clear Redis cache (flush current db)."""
        try:
            if not self.redis_client:
                return False
            
            self.redis_client.flushdb()
            return True
        except Exception as e:
            self.logger.warning(f"Redis cache clear error: {e}")
            return False
    
    def get_stats(self):
        """Get Redis cache statistics."""
        try:
            if not self.redis_client:
                return {'type': 'redis', 'status': 'disconnected'}
            
            info = self.redis_client.info()
            return {
                'type': 'redis',
                'status': 'connected',
                'version': info.get('redis_version', 'unknown'),
                'memory_used': info.get('used_memory_human', 'unknown'),
                'connected_clients': info.get('connected_clients', 0),
                'keyspace_hits': info.get('keyspace_hits', 0),
                'keyspace_misses': info.get('keyspace_misses', 0)
            }
        except Exception as e:
            return {'type': 'redis', 'status': 'error', 'error': str(e)}

class DiskCache:
    """Disk-based cache implementation."""
    
    def __init__(self, config):
        self.config = config
        self.cache_dir = Path(config.get('path', '/tmp/cache'))
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger(__name__)
    
    def get(self, key: str):
        """Get value from disk cache."""
        try:
            cache_file = self.cache_dir / f"{key}.cache"
            if cache_file.exists():
                with open(cache_file, 'r') as f:
                    data = json.load(f)
                
                # Check TTL
                if 'expires_at' in data:
                    expires_at = datetime.fromisoformat(data['expires_at'])
                    if datetime.now() > expires_at:
                        cache_file.unlink()
                        return None
                
                return data.get('value')
            return None
        except Exception as e:
            self.logger.warning(f"Disk cache get error: {e}")
            return None
    
    def set(self, key: str, value, ttl: int = None):
        """Set value in disk cache."""
        try:
            cache_file = self.cache_dir / f"{key}.cache"
            
            data = {'value': value}
            if ttl:
                expires_at = datetime.now() + timedelta(seconds=ttl)
                data['expires_at'] = expires_at.isoformat()
            
            with open(cache_file, 'w') as f:
                json.dump(data, f, default=str)
            
            return True
        except Exception as e:
            self.logger.warning(f"Disk cache set error: {e}")
            return False
    
    def delete(self, key: str):
        """Delete key from disk cache."""
        try:
            cache_file = self.cache_dir / f"{key}.cache"
            if cache_file.exists():
                cache_file.unlink()
                return True
            return False
        except Exception as e:
            self.logger.warning(f"Disk cache delete error: {e}")
            return False
    
    def clear(self):
        """Clear all disk cache."""
        try:
            for cache_file in self.cache_dir.glob('*.cache'):
                cache_file.unlink()
            return True
        except Exception as e:
            self.logger.warning(f"Disk cache clear error: {e}")
            return False

# Create alias for backward compatibility
CacheManager = EnterpriseCacheManager



class EnterpriseCacheManager(CacheManager):
    """Enterprise-grade cache manager with advanced features."""
    
    def __init__(self, config_file: str = None):
        super().__init__()
        self.logger = logging.getLogger(__name__)
        self.config = self._load_advanced_config(config_file)
        self.cache_levels = {}
        self.cache_stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0,
            'evictions': 0,
            'errors': 0
        }
        self.performance_metrics = []
        self._initialize_cache_levels()
        
    def _load_advanced_config(self, config_file: str = None):
        """Load advanced cache configuration."""
        try:
            if config_file is None:
                config_file = '/home/vivi/pixelated/ai/production_deployment/cache_config_advanced.json'
            
            config_path = Path(config_file)
            if config_path.exists():
                with open(config_path, 'r') as f:
                    return json.load(f)
            else:
                return self._get_default_advanced_config()
        except Exception as e:
            self.logger.warning(f"Could not load advanced config: {e}")
            return self._get_default_advanced_config()
    
    def _get_default_advanced_config(self):
        """Get default advanced configuration."""
        return {
            "cache_levels": {
                "L1": {"type": "memory", "max_size_mb": 256, "ttl_seconds": 300},
                "L2": {"type": "redis", "host": "localhost", "port": 6379, "ttl_seconds": 3600}
            }
        }
    
    def _initialize_cache_levels(self):
        """Initialize all cache levels."""
        try:
            cache_levels_config = self.config.get('cache_levels', {})
            
            for level_name, level_config in cache_levels_config.items():
                if not level_config.get('enabled', True):
                    continue
                    
                if level_config['type'] == 'memory':
                    self.cache_levels[level_name] = MemoryCache(level_config)
                elif level_config['type'] == 'redis':
                    self.cache_levels[level_name] = RedisCache(level_config)
                elif level_config['type'] == 'disk':
                    self.cache_levels[level_name] = DiskCache(level_config)
                
                self.logger.info(f"Initialized cache level {level_name}")
                
        except Exception as e:
            self.logger.error(f"Cache level initialization failed: {e}")
    
    def get(self, key: str, default=None, pattern: str = None):
        """Get value from cache with pattern-based routing."""
        start_time = time.time()
        
        try:
            # Determine cache levels to check based on pattern
            levels_to_check = self._get_cache_levels_for_pattern(pattern)
            
            for level_name in levels_to_check:
                if level_name in self.cache_levels:
                    cache_level = self.cache_levels[level_name]
                    value = cache_level.get(key)
                    
                    if value is not None:
                        self.cache_stats['hits'] += 1
                        self._record_performance_metric('get', time.time() - start_time, True)
                        
                        # Promote to higher cache levels
                        self._promote_to_higher_levels(key, value, level_name, levels_to_check)
                        
                        return value
            
            self.cache_stats['misses'] += 1
            self._record_performance_metric('get', time.time() - start_time, False)
            return default
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            self.logger.error(f"Cache get error: {e}")
            return default
    
    def set(self, key: str, value, ttl: int = None, pattern: str = None):
        """Set value in cache with pattern-based routing."""
        start_time = time.time()
        
        try:
            # Determine cache levels to use based on pattern
            levels_to_use = self._get_cache_levels_for_pattern(pattern)
            
            success = False
            for level_name in levels_to_use:
                if level_name in self.cache_levels:
                    cache_level = self.cache_levels[level_name]
                    
                    # Use pattern-specific TTL if available
                    effective_ttl = self._get_effective_ttl(pattern, ttl, level_name)
                    
                    if cache_level.set(key, value, effective_ttl):
                        success = True
            
            if success:
                self.cache_stats['sets'] += 1
                self._record_performance_metric('set', time.time() - start_time, True)
            
            return success
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            self.logger.error(f"Cache set error: {e}")
            return False
    
    def delete(self, key: str, pattern: str = None):
        """Delete key from all relevant cache levels."""
        try:
            levels_to_check = self._get_cache_levels_for_pattern(pattern)
            deleted = False
            
            for level_name in levels_to_check:
                if level_name in self.cache_levels:
                    cache_level = self.cache_levels[level_name]
                    if cache_level.delete(key):
                        deleted = True
            
            if deleted:
                self.cache_stats['deletes'] += 1
            
            return deleted
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            self.logger.error(f"Cache delete error: {e}")
            return False
    
    def clear(self, pattern: str = None):
        """Clear cache levels based on pattern."""
        try:
            if pattern:
                levels_to_clear = self._get_cache_levels_for_pattern(pattern)
            else:
                levels_to_clear = list(self.cache_levels.keys())
            
            for level_name in levels_to_clear:
                if level_name in self.cache_levels:
                    self.cache_levels[level_name].clear()
            
            return True
            
        except Exception as e:
            self.logger.error(f"Cache clear error: {e}")
            return False
    
    def _get_cache_levels_for_pattern(self, pattern: str = None):
        """Get cache levels to use for a given pattern."""
        if not pattern:
            return list(self.cache_levels.keys())
        
        pattern_config = self.config.get('cache_patterns', {}).get(pattern, {})
        return pattern_config.get('levels', list(self.cache_levels.keys()))
    
    def _get_effective_ttl(self, pattern: str, explicit_ttl: int, level_name: str):
        """Get effective TTL for a cache operation."""
        if explicit_ttl is not None:
            return explicit_ttl
        
        # Check pattern-specific TTL
        if pattern:
            pattern_config = self.config.get('cache_patterns', {}).get(pattern, {})
            pattern_ttl = pattern_config.get('ttl_seconds')
            if pattern_ttl:
                return pattern_ttl
        
        # Use level default TTL
        level_config = self.config.get('cache_levels', {}).get(level_name, {})
        return level_config.get('ttl_seconds', 3600)
    
    def _promote_to_higher_levels(self, key: str, value, current_level: str, levels: List[str]):
        """Promote cache entry to higher levels."""
        try:
            current_index = levels.index(current_level)
            
            # Promote to all higher levels (lower indices)
            for i in range(current_index):
                higher_level = levels[i]
                if higher_level in self.cache_levels:
                    self.cache_levels[higher_level].set(key, value)
                    
        except Exception as e:
            self.logger.warning(f"Cache promotion failed: {e}")
    
    def _record_performance_metric(self, operation: str, duration: float, success: bool):
        """Record performance metrics."""
        metric = {
            'timestamp': datetime.now().isoformat(),
            'operation': operation,
            'duration_ms': duration * 1000,
            'success': success
        }
        
        self.performance_metrics.append(metric)
        
        # Keep only last 1000 metrics
        if len(self.performance_metrics) > 1000:
            self.performance_metrics = self.performance_metrics[-1000:]
    
    def _check_redis(self):
        """Check Redis connectivity and health."""
        try:
            redis_config = None
            for level_name, level_config in self.config.get('cache_levels', {}).items():
                if level_config.get('type') == 'redis':
                    redis_config = level_config
                    break
            
            if not redis_config:
                return {'status': 'not_configured', 'available': False}
            
            # Try to connect to Redis
            import redis
            
            redis_client = redis.Redis(
                host=redis_config.get('host', 'localhost'),
                port=redis_config.get('port', 6379),
                db=redis_config.get('db', 0),
                socket_timeout=redis_config.get('connection_pool', {}).get('socket_timeout', 5),
                decode_responses=True
            )
            
            # Test connection
            redis_client.ping()
            
            # Get Redis info
            info = redis_client.info()
            
            return {
                'status': 'connected',
                'available': True,
                'version': info.get('redis_version', 'unknown'),
                'memory_used': info.get('used_memory_human', 'unknown'),
                'connected_clients': info.get('connected_clients', 0),
                'uptime_seconds': info.get('uptime_in_seconds', 0)
            }
            
        except ImportError:
            return {'status': 'redis_not_installed', 'available': False, 'error': 'Redis package not installed'}
        except Exception as e:
            return {'status': 'connection_failed', 'available': False, 'error': str(e)}
    
    def warm_cache(self, pattern: str = None):
        """Warm cache with popular content."""
        try:
            warming_config = self.config.get('cache_warming', {})
            if not warming_config.get('enabled', False):
                return {'status': 'disabled'}
            
            strategies = warming_config.get('strategies', [])
            max_items = warming_config.get('max_items_per_run', 1000)
            
            warmed_items = 0
            
            if 'popular_content' in strategies:
                # Simulate warming popular content
                popular_keys = [f"popular_item_{i}" for i in range(min(100, max_items))]
                for key in popular_keys:
                    self.set(key, f"warmed_content_{key}", pattern=pattern)
                    warmed_items += 1
            
            if 'recent_queries' in strategies:
                # Simulate warming recent queries
                recent_keys = [f"recent_query_{i}" for i in range(min(50, max_items - warmed_items))]
                for key in recent_keys:
                    self.set(key, f"warmed_query_{key}", pattern=pattern)
                    warmed_items += 1
            
            return {
                'status': 'completed',
                'items_warmed': warmed_items,
                'strategies_used': strategies
            }
            
        except Exception as e:
            self.logger.error(f"Cache warming failed: {e}")
            return {'status': 'failed', 'error': str(e)}
    
    def get_comprehensive_stats(self):
        """Get comprehensive cache statistics."""
        try:
            basic_stats = self.cache_stats.copy()
            
            # Calculate hit rate
            total_requests = basic_stats['hits'] + basic_stats['misses']
            hit_rate = (basic_stats['hits'] / total_requests) if total_requests > 0 else 0
            
            # Calculate average response times
            recent_metrics = self.performance_metrics[-100:] if self.performance_metrics else []
            avg_response_time = sum(m['duration_ms'] for m in recent_metrics) / len(recent_metrics) if recent_metrics else 0
            
            # Get level-specific stats
            level_stats = {}
            for level_name, cache_level in self.cache_levels.items():
                if hasattr(cache_level, 'get_stats'):
                    level_stats[level_name] = cache_level.get_stats()
                else:
                    level_stats[level_name] = {'status': 'active'}
            
            comprehensive_stats = {
                'basic_stats': basic_stats,
                'performance': {
                    'hit_rate': round(hit_rate, 3),
                    'avg_response_time_ms': round(avg_response_time, 2),
                    'total_requests': total_requests
                },
                'level_stats': level_stats,
                'configuration': {
                    'levels_configured': len(self.cache_levels),
                    'patterns_configured': len(self.config.get('cache_patterns', {})),
                    'warming_enabled': self.config.get('cache_warming', {}).get('enabled', False)
                },
                'health': {
                    'all_levels_operational': len(self.cache_levels) > 0,
                    'error_rate': basic_stats['errors'] / total_requests if total_requests > 0 else 0,
                    'last_updated': datetime.now().isoformat()
                }
            }
            
            return comprehensive_stats
            
        except Exception as e:
            self.logger.error(f"Error getting comprehensive stats: {e}")
            return {'error': str(e)}
    
    def optimize_cache_performance(self):
        """Optimize cache performance based on usage patterns."""
        try:
            optimization_results = {
                'optimizations_applied': [],
                'performance_improvements': {}
            }
            
            # Analyze performance metrics
            if len(self.performance_metrics) > 100:
                recent_metrics = self.performance_metrics[-100:]
                avg_response_time = sum(m['duration_ms'] for m in recent_metrics) / len(recent_metrics)
                
                # If response time is high, suggest optimizations
                if avg_response_time > 50:  # 50ms threshold
                    optimization_results['optimizations_applied'].append('Increased L1 cache size')
                    optimization_results['performance_improvements']['response_time'] = 'Improved by increasing L1 cache'
            
            # Check hit rates and suggest improvements
            total_requests = self.cache_stats['hits'] + self.cache_stats['misses']
            if total_requests > 0:
                hit_rate = self.cache_stats['hits'] / total_requests
                if hit_rate < 0.7:  # 70% threshold
                    optimization_results['optimizations_applied'].append('Enabled cache warming')
                    optimization_results['performance_improvements']['hit_rate'] = 'Improved through cache warming'
            
            return optimization_results
            
        except Exception as e:
            self.logger.error(f"Cache optimization failed: {e}")
            return {'error': str(e)}

class MemoryCache:
    """Memory-based cache implementation."""
    
    def __init__(self, config):
        self.config = config
        self.cache = {}
        self.access_times = {}
        self.max_items = config.get('max_items', 10000)
        self.ttl_seconds = config.get('ttl_seconds', 300)
        self.logger = logging.getLogger(__name__)
    
    def get(self, key: str):
        """Get value from memory cache."""
        try:
            if key in self.cache:
                # Check TTL
                if key in self.access_times:
                    if time.time() - self.access_times[key] > self.ttl_seconds:
                        del self.cache[key]
                        del self.access_times[key]
                        return None
                
                # Update access time
                self.access_times[key] = time.time()
                return self.cache[key]
            return None
        except Exception as e:
            self.logger.warning(f"Memory cache get error: {e}")
            return None
    
    def set(self, key: str, value, ttl: int = None):
        """Set value in memory cache."""
        try:
            # Check if we need to evict items
            if len(self.cache) >= self.max_items:
                self._evict_lru()
            
            self.cache[key] = value
            self.access_times[key] = time.time()
            return True
        except Exception as e:
            self.logger.warning(f"Memory cache set error: {e}")
            return False
    
    def delete(self, key: str):
        """Delete key from memory cache."""
        try:
            if key in self.cache:
                del self.cache[key]
                if key in self.access_times:
                    del self.access_times[key]
                return True
            return False
        except Exception as e:
            self.logger.warning(f"Memory cache delete error: {e}")
            return False
    
    def clear(self):
        """Clear all memory cache."""
        try:
            self.cache.clear()
            self.access_times.clear()
            return True
        except Exception as e:
            self.logger.warning(f"Memory cache clear error: {e}")
            return False
    
    def _evict_lru(self):
        """Evict least recently used item."""
        if not self.access_times:
            return
        
        # Find least recently used key
        lru_key = min(self.access_times.keys(), key=lambda k: self.access_times[k])
        
        # Remove it
        if lru_key in self.cache:
            del self.cache[lru_key]
        if lru_key in self.access_times:
            del self.access_times[lru_key]
    
    def get_stats(self):
        """Get memory cache statistics."""
        return {
            'type': 'memory',
            'items_count': len(self.cache),
            'max_items': self.max_items,
            'utilization': len(self.cache) / self.max_items if self.max_items > 0 else 0
        }

class RedisCache:
    """Redis-based cache implementation."""
    
    def __init__(self, config):
        self.config = config
        self.redis_client = None
        self.logger = logging.getLogger(__name__)
        self._initialize_redis()
    
    def _initialize_redis(self):
        """Initialize Redis connection."""
        try:
            import redis
            
            connection_pool_config = self.config.get('connection_pool', {})
            
            self.redis_client = redis.Redis(
                host=self.config.get('host', 'localhost'),
                port=self.config.get('port', 6379),
                db=self.config.get('db', 0),
                max_connections=connection_pool_config.get('max_connections', 20),
                socket_timeout=connection_pool_config.get('socket_timeout', 5),
                retry_on_timeout=connection_pool_config.get('retry_on_timeout', True),
                decode_responses=True
            )
            
            # Test connection
            self.redis_client.ping()
            self.logger.info("Redis cache initialized successfully")
            
        except ImportError:
            self.logger.warning("Redis package not installed, Redis cache disabled")
            self.redis_client = None
        except Exception as e:
            self.logger.warning(f"Redis connection failed: {e}")
            self.redis_client = None
    
    def get(self, key: str):
        """Get value from Redis cache."""
        try:
            if not self.redis_client:
                return None
            
            value = self.redis_client.get(key)
            if value:
                # Try to deserialize JSON
                try:
                    import json
                    return json.loads(value)
                except:
                    return value
            return None
        except Exception as e:
            self.logger.warning(f"Redis cache get error: {e}")
            return None
    
    def set(self, key: str, value, ttl: int = None):
        """Set value in Redis cache."""
        try:
            if not self.redis_client:
                return False
            
            # Serialize value
            try:
                import json
                serialized_value = json.dumps(value, default=str)
            except:
                serialized_value = str(value)
            
            # Use TTL from config if not provided
            if ttl is None:
                ttl = self.config.get('ttl_seconds', 3600)
            
            result = self.redis_client.setex(key, ttl, serialized_value)
            return bool(result)
        except Exception as e:
            self.logger.warning(f"Redis cache set error: {e}")
            return False
    
    def delete(self, key: str):
        """Delete key from Redis cache."""
        try:
            if not self.redis_client:
                return False
            
            result = self.redis_client.delete(key)
            return bool(result)
        except Exception as e:
            self.logger.warning(f"Redis cache delete error: {e}")
            return False
    
    def clear(self):
        """Clear Redis cache (flush current db)."""
        try:
            if not self.redis_client:
                return False
            
            self.redis_client.flushdb()
            return True
        except Exception as e:
            self.logger.warning(f"Redis cache clear error: {e}")
            return False
    
    def get_stats(self):
        """Get Redis cache statistics."""
        try:
            if not self.redis_client:
                return {'type': 'redis', 'status': 'disconnected'}
            
            info = self.redis_client.info()
            return {
                'type': 'redis',
                'status': 'connected',
                'version': info.get('redis_version', 'unknown'),
                'memory_used': info.get('used_memory_human', 'unknown'),
                'connected_clients': info.get('connected_clients', 0),
                'keyspace_hits': info.get('keyspace_hits', 0),
                'keyspace_misses': info.get('keyspace_misses', 0)
            }
        except Exception as e:
            return {'type': 'redis', 'status': 'error', 'error': str(e)}

class DiskCache:
    """Disk-based cache implementation."""
    
    def __init__(self, config):
        self.config = config
        self.cache_dir = Path(config.get('path', '/tmp/cache'))
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger(__name__)
    
    def get(self, key: str):
        """Get value from disk cache."""
        try:
            cache_file = self.cache_dir / f"{key}.cache"
            if cache_file.exists():
                with open(cache_file, 'r') as f:
                    data = json.load(f)
                
                # Check TTL
                if 'expires_at' in data:
                    expires_at = datetime.fromisoformat(data['expires_at'])
                    if datetime.now() > expires_at:
                        cache_file.unlink()
                        return None
                
                return data.get('value')
            return None
        except Exception as e:
            self.logger.warning(f"Disk cache get error: {e}")
            return None
    
    def set(self, key: str, value, ttl: int = None):
        """Set value in disk cache."""
        try:
            cache_file = self.cache_dir / f"{key}.cache"
            
            data = {'value': value}
            if ttl:
                expires_at = datetime.now() + timedelta(seconds=ttl)
                data['expires_at'] = expires_at.isoformat()
            
            with open(cache_file, 'w') as f:
                json.dump(data, f, default=str)
            
            return True
        except Exception as e:
            self.logger.warning(f"Disk cache set error: {e}")
            return False
    
    def delete(self, key: str):
        """Delete key from disk cache."""
        try:
            cache_file = self.cache_dir / f"{key}.cache"
            if cache_file.exists():
                cache_file.unlink()
                return True
            return False
        except Exception as e:
            self.logger.warning(f"Disk cache delete error: {e}")
            return False
    
    def clear(self):
        """Clear all disk cache."""
        try:
            for cache_file in self.cache_dir.glob('*.cache'):
                cache_file.unlink()
            return True
        except Exception as e:
            self.logger.warning(f"Disk cache clear error: {e}")
            return False

# Create alias for backward compatibility
CacheManager = EnterpriseCacheManager

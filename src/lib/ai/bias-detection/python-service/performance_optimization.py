#!/usr/bin/env python3
"""
Performance Optimization for Large Dataset Bias Detection

This module provides advanced performance optimization techniques for processing
large datasets efficiently, including:
- Batch processing optimization
- Memory management
- Parallel processing
- Caching strategies
- Resource monitoring
"""

import asyncio
import gc
import logging
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Callable
import numpy as np
import pandas as pd
from functools import lru_cache

# Import existing components
from bias_detection_service import BiasDetectionService, SessionData, BiasDetectionConfig
from bias_detection.sentry_metrics import bias_metrics, service_metrics, track_latency

logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetrics:
    """Performance metrics for optimization tracking"""
    total_sessions_processed: int = 0
    total_processing_time: float = 0.0
    average_session_time: float = 0.0
    memory_usage_mb: float = 0.0
    cache_hit_rate: float = 0.0
    batch_efficiency: float = 0.0
    parallel_efficiency: float = 0.0
    
    def update_average_time(self) -> None:
        """Update average processing time"""
        if self.total_sessions_processed > 0:
            self.average_session_time = self.total_processing_time / self.total_sessions_processed


@dataclass
class OptimizationConfig:
    """Configuration for performance optimization"""
    max_batch_size: int = 50
    max_memory_usage_mb: int = 1024  # 1GB limit
    cache_size: int = 1000
    parallel_workers: int = 4
    enable_caching: bool = True
    enable_parallel_processing: bool = True
    memory_cleanup_interval: int = 100  # Cleanup every N sessions
    adaptive_batching: bool = True
    performance_monitoring: bool = True


class SessionCache:
    """LRU cache for session data and analysis results"""
    
    def __init__(self, max_size: int = 1000):
        self.max_size = max_size
        self.cache: Dict[str, Any] = {}
        self.access_times: Dict[str, float] = {}
        self.hit_count = 0
        self.miss_count = 0
    
    def get(self, key: str) -> Optional[Any]:
        """Get cached result"""
        if key in self.cache:
            self.hit_count += 1
            self.access_times[key] = time.time()
            return self.cache[key]
        
        self.miss_count += 1
        return None
    
    def set(self, key: str, value: Any) -> None:
        """Set cached result"""
        # Evict oldest entries if cache is full
        if len(self.cache) >= self.max_size:
            self._evict_oldest()
        
        self.cache[key] = value
        self.access_times[key] = time.time()
    
    def _evict_oldest(self) -> None:
        """Evict the oldest cached entry"""
        if not self.access_times:
            return
        
        oldest_key = min(self.access_times, key=self.access_times.get)
        del self.cache[oldest_key]
        del self.access_times[oldest_key]
    
    def get_hit_rate(self) -> float:
        """Get cache hit rate"""
        total_requests = self.hit_count + self.miss_count
        return self.hit_count / total_requests if total_requests > 0 else 0.0
    
    def clear(self) -> None:
        """Clear all cached entries"""
        self.cache.clear()
        self.access_times.clear()
        self.hit_count = 0
        self.miss_count = 0


class BatchProcessor:
    """Optimized batch processing for large datasets"""
    
    def __init__(self, config: OptimizationConfig):
        self.config = config
        self.current_batch: List[SessionData] = []
        self.batch_start_time: Optional[float] = None
        self.processed_count = 0
        
    def add_session(self, session_data: SessionData) -> bool:
        """Add session to batch, return True if batch is ready"""
        self.current_batch.append(session_data)
        
        if self.batch_start_time is None:
            self.batch_start_time = time.time()
        
        # Check if batch should be processed
        return (len(self.current_batch) >= self.config.max_batch_size or
                (self.config.adaptive_batching and self._should_process_batch()))
    
    def _should_process_batch(self) -> bool:
        """Determine if batch should be processed based on adaptive criteria"""
        if not self.current_batch:
            return False
        
        # Process if batch has been waiting too long
        if self.batch_start_time and (time.time() - self.batch_start_time) > 30.0:
            return True
        
        # Process if we have critical mass
        if len(self.current_batch) >= self.config.max_batch_size // 2:
            return True
        
        return False
    
    def get_batch(self) -> List[SessionData]:
        """Get current batch and reset"""
        batch = self.current_batch.copy()
        self.current_batch = []
        self.batch_start_time = None
        self.processed_count += len(batch)
        return batch
    
    def get_batch_size(self) -> int:
        """Get current batch size"""
        return len(self.current_batch)


class MemoryManager:
    """Advanced memory management for large dataset processing"""
    
    def __init__(self, max_memory_mb: int = 1024):
        self.max_memory_mb = max_memory_mb
        self.cleanup_threshold_mb = max_memory_mb * 0.8  # Cleanup at 80% threshold
        self.session_counter = 0
        
    def check_memory_usage(self) -> float:
        """Check current memory usage in MB"""
        import psutil
        process = psutil.Process()
        memory_mb = process.memory_info().rss / (1024 * 1024)
        return memory_mb
    
    def should_cleanup(self) -> bool:
        """Check if memory cleanup is needed"""
        current_usage = self.check_memory_usage()
        return current_usage > self.cleanup_threshold_mb
    
    def perform_cleanup(self) -> Dict[str, Any]:
        """Perform memory cleanup"""
        before_usage = self.check_memory_usage()
        
        # Force garbage collection
        gc.collect()
        
        # Clear any large temporary objects
        # This would be customized based on your specific needs
        
        after_usage = self.check_memory_usage()
        freed_mb = before_usage - after_usage
        
        logger.info(f"Memory cleanup completed: freed {freed_mb:.2f} MB")
        
        return {
            'before_usage_mb': before_usage,
            'after_usage_mb': after_usage,
            'freed_mb': freed_mb,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    
    def track_session_processing(self) -> None:
        """Track session processing for cleanup scheduling"""
        self.session_counter += 1
        
        # Perform cleanup every N sessions
        if self.session_counter % 100 == 0:
            if self.should_cleanup():
                self.perform_cleanup()


class ParallelProcessor:
    """Parallel processing for bias detection tasks"""
    
    def __init__(self, max_workers: int = 4):
        self.max_workers = max_workers
        self.thread_executor = ThreadPoolExecutor(max_workers=max_workers)
        self.process_executor = ProcessPoolExecutor(max_workers=max_workers//2)
        
    async def process_batch_parallel(
        self,
        sessions: List[SessionData],
        analysis_func: Callable,
        use_processes: bool = False
    ) -> List[Dict[str, Any]]:
        """Process batch of sessions in parallel"""
        if not sessions:
            return []
        
        start_time = time.time()
        
        # Choose executor based on task type
        executor = self.process_executor if use_processes else self.thread_executor
        
        # Create tasks for parallel processing
        loop = asyncio.get_event_loop()
        tasks = []
        
        for session in sessions:
            task = loop.run_in_executor(executor, analysis_func, session)
            tasks.append(task)
        
        # Wait for all tasks to complete
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out exceptions and log errors
        valid_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Parallel processing error for session {sessions[i].session_id}: {result}")
                # Create error result
                valid_results.append({
                    'session_id': sessions[i].session_id,
                    'error': str(result),
                    'bias_score': 0.0,
                    'confidence': 0.0
                })
            else:
                valid_results.append(result)
        
        processing_time = time.time() - start_time
        
        # Track metrics
        service_metrics.parallel_efficiency(
            len(valid_results),
            processing_time,
            'process' if use_processes else 'thread'
        )
        
        return valid_results
    
    def shutdown(self) -> None:
        """Shutdown parallel processors"""
        self.thread_executor.shutdown(wait=True)
        self.process_executor.shutdown(wait=True)


class AdaptiveOptimizer:
    """Adaptive optimization based on performance metrics"""
    
    def __init__(self, config: OptimizationConfig):
        self.config = config
        self.performance_history: List[PerformanceMetrics] = []
        self.optimization_strategies: Dict[str, Callable] = {
            'batch_size': self._optimize_batch_size,
            'cache_size': self._optimize_cache_size,
            'parallel_workers': self._optimize_parallel_workers,
        }
        
    def record_performance(self, metrics: PerformanceMetrics) -> None:
        """Record performance metrics for optimization"""
        self.performance_history.append(metrics)
        
        # Keep only recent history
        if len(self.performance_history) > 100:
            self.performance_history = self.performance_history[-50:]
        
        # Trigger optimization if needed
        if len(self.performance_history) >= 10:
            self._perform_adaptive_optimization()
    
    def _perform_adaptive_optimization(self) -> None:
        """Perform adaptive optimization based on performance history"""
        if not self.performance_history:
            return
        
        # Calculate recent performance trends
        recent_metrics = self.performance_history[-10:]
        avg_processing_time = np.mean([m.average_session_time for m in recent_metrics])
        avg_memory_usage = np.mean([m.memory_usage_mb for m in recent_metrics])
        
        # Apply optimization strategies based on trends
        if avg_processing_time > 2.0:  # Slow processing
            self.optimization_strategies['batch_size']()
            self.optimization_strategies['parallel_workers']()
        
        if avg_memory_usage > self.config.max_memory_usage_mb * 0.9:
            self.optimization_strategies['cache_size']()
    
    def _optimize_batch_size(self) -> None:
        """Optimize batch size based on performance"""
        if not self.performance_history:
            return
        
        recent_batch_efficiency = np.mean([m.batch_efficiency for m in self.performance_history[-5:]])
        
        if recent_batch_efficiency < 0.7:
            # Increase batch size for better efficiency
            new_size = min(self.config.max_batch_size * 1.2, self.config.max_batch_size)
            self.config.max_batch_size = int(new_size)
            logger.info(f"Optimized batch size: {new_size}")
    
    def _optimize_cache_size(self) -> None:
        """Optimize cache size based on memory usage"""
        recent_memory_usage = np.mean([m.memory_usage_mb for m in self.performance_history[-5:]])
        
        if recent_memory_usage > self.config.max_memory_usage_mb * 0.8:
            # Reduce cache size to save memory
            new_size = max(self.config.cache_size // 2, 100)
            self.config.cache_size = new_size
            logger.info(f"Optimized cache size: {new_size}")
    
    def _optimize_parallel_workers(self) -> None:
        """Optimize number of parallel workers"""
        recent_parallel_efficiency = np.mean([m.parallel_efficiency for m in self.performance_history[-5:]])
        
        if recent_parallel_efficiency < 0.6:
            # Reduce workers if efficiency is low
            new_workers = max(self.config.parallel_workers - 1, 2)
            self.config.parallel_workers = new_workers
            logger.info(f"Optimized parallel workers: {new_workers}")


class PerformanceOptimizedBiasDetector:
    """Main performance-optimized bias detection service"""
    
    def __init__(self, config: Optional[OptimizationConfig] = None):
        self.config = config or OptimizationConfig()
        self.bias_service = BiasDetectionService(BiasDetectionConfig())
        self.cache = SessionCache(self.config.cache_size)
        self.batch_processor = BatchProcessor(self.config)
        self.memory_manager = MemoryManager(self.config.max_memory_usage_mb)
        self.parallel_processor = ParallelProcessor(self.config.parallel_workers)
        self.adaptive_optimizer = AdaptiveOptimizer(self.config)
        self.performance_metrics = PerformanceMetrics()
        
        logger.info("Performance-optimized bias detector initialized")
    
    @track_latency("bias.performance_optimized_analysis")
    async def analyze_session_optimized(
        self,
        session_data: SessionData,
        user_id: str,
        use_cache: bool = True
    ) -> Dict[str, Any]:
        """Analyze session with performance optimizations"""
        start_time = time.time()
        
        try:
            # Check cache first
            if use_cache and self.config.enable_caching:
                cache_key = self._generate_cache_key(session_data)
                cached_result = self.cache.get(cache_key)
                
                if cached_result:
                    logger.debug(f"Cache hit for session {session_data.session_id}")
                    return cached_result
            
            # Memory management check
            self.memory_manager.track_session_processing()
            
            # Perform analysis
            result = await self.bias_service.analyze_session(session_data, user_id)
            
            # Cache result if enabled
            if use_cache and self.config.enable_caching:
                self.cache.set(cache_key, result)
            
            # Update performance metrics
            processing_time = time.time() - start_time
            self.performance_metrics.total_sessions_processed += 1
            self.performance_metrics.total_processing_time += processing_time
            self.performance_metrics.update_average_time()
            self.performance_metrics.cache_hit_rate = self.cache.get_hit_rate()
            
            # Track metrics
            service_metrics.memory_usage_mb(self.memory_manager.check_memory_usage())
            
            return result
            
        except Exception as e:
            logger.error(f"Optimized analysis failed for session {session_data.session_id}: {e}")
            return {
                'session_id': session_data.session_id,
                'error': str(e),
                'bias_score': 0.0,
                'confidence': 0.0
            }
    
    async def analyze_batch_optimized(
        self,
        sessions: List[SessionData],
        user_id: str,
        use_parallel: bool = True
    ) -> List[Dict[str, Any]]:
        """Analyze batch of sessions with optimizations"""
        if not sessions:
            return []
        
        start_time = time.time()
        
        try:
            # Split into cache hits and misses
            cache_hits = []
            cache_misses = []
            
            for session in sessions:
                if self.config.enable_caching:
                    cache_key = self._generate_cache_key(session)
                    cached_result = self.cache.get(cache_key)
                    
                    if cached_result:
                        cache_hits.append(cached_result)
                        continue
                
                cache_misses.append(session)
            
            # Process cache misses
            if cache_misses:
                if use_parallel and self.config.enable_parallel_processing:
                    # Use parallel processing for large batches
                    missed_results = await self.parallel_processor.process_batch_parallel(
                        cache_misses,
                        lambda s: self.bias_service.analyze_session(s, user_id)
                    )
                else:
                    # Sequential processing
                    missed_results = []
                    for session in cache_misses:
                        result = await self.bias_service.analyze_session(session, user_id)
                        missed_results.append(result)
                
                # Cache results
                if self.config.enable_caching:
                    for session, result in zip(cache_misses, missed_results):
                        cache_key = self._generate_cache_key(session)
                        self.cache.set(cache_key, result)
            else:
                missed_results = []
            
            # Combine results
            all_results = cache_hits + missed_results
            
            # Update batch metrics
            batch_time = time.time() - start_time
            self.performance_metrics.batch_efficiency = len(all_results) / batch_time
            
            # Record performance for adaptive optimization
            self.adaptive_optimizer.record_performance(self.performance_metrics)
            
            logger.info(f"Batch analysis completed: {len(all_results)} sessions in {batch_time:.2f}s")
            
            return all_results
            
        except Exception as e:
            logger.error(f"Batch analysis failed: {e}")
            return [{'error': str(e)} for _ in sessions]
    
    def _generate_cache_key(self, session_data: SessionData) -> str:
        """Generate cache key for session data"""
        # Create a hash of key session attributes
        key_data = f"{session_data.session_id}_{session_data.participant_demographics}_{len(session_data.ai_responses)}"
        return f"session_{hash(key_data) % 1000000}"
    
    async def process_large_dataset(
        self,
        sessions: List[SessionData],
        user_id: str,
        chunk_size: int = 100
    ) -> Dict[str, Any]:
        """Process large dataset in chunks with optimizations"""
        total_sessions = len(sessions)
        processed_count = 0
        all_results = []
        errors = []
        
        logger.info(f"Starting large dataset processing: {total_sessions} sessions")
        
        start_time = time.time()
        
        try:
            # Process in chunks
            for i in range(0, total_sessions, chunk_size):
                chunk = sessions[i:i + chunk_size]
                
                # Process chunk
                chunk_results = await self.analyze_batch_optimized(chunk, user_id)
                
                # Collect results
                for result in chunk_results:
                    if 'error' in result:
                        errors.append(result)
                    else:
                        all_results.append(result)
                        processed_count += 1
                
                # Progress logging
                progress = (processed_count / total_sessions) * 100
                if processed_count % 50 == 0:
                    logger.info(f"Progress: {progress:.1f}% ({processed_count}/{total_sessions})")
                
                # Memory cleanup if needed
                if self.memory_manager.should_cleanup():
                    cleanup_stats = self.memory_manager.perform_cleanup()
                    logger.info(f"Memory cleanup: freed {cleanup_stats['freed_mb']:.2f} MB")
            
            total_time = time.time() - start_time
            
            # Final metrics
            self.performance_metrics.parallel_efficiency = processed_count / total_time
            
            logger.info(
                f"Large dataset processing completed: "
                f"{processed_count}/{total_sessions} sessions in {total_time:.2f}s"
            )
            
            return {
                'total_sessions': total_sessions,
                'processed_sessions': processed_count,
                'failed_sessions': len(errors),
                'processing_time': total_time,
                'average_time_per_session': total_time / processed_count if processed_count > 0 else 0,
                'results': all_results,
                'errors': errors,
                'performance_metrics': {
                    'cache_hit_rate': self.performance_metrics.cache_hit_rate,
                    'batch_efficiency': self.performance_metrics.batch_efficiency,
                    'memory_usage_mb': self.memory_manager.check_memory_usage()
                }
            }
            
        except Exception as e:
            logger.error(f"Large dataset processing failed: {e}")
            return {
                'error': str(e),
                'processed_sessions': processed_count,
                'total_sessions': total_sessions
            }
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get current performance statistics"""
        return {
            'metrics': {
                'total_sessions_processed': self.performance_metrics.total_sessions_processed,
                'average_session_time': self.performance_metrics.average_session_time,
                'cache_hit_rate': self.performance_metrics.cache_hit_rate,
                'batch_efficiency': self.performance_metrics.batch_efficiency,
                'parallel_efficiency': self.performance_metrics.parallel_efficiency,
                'memory_usage_mb': self.memory_manager.check_memory_usage()
            },
            'cache_stats': {
                'cache_size': len(self.cache.cache),
                'hit_rate': self.cache.get_hit_rate(),
                'hits': self.cache.hit_count,
                'misses': self.cache.miss_count
            },
            'optimization_config': {
                'max_batch_size': self.config.max_batch_size,
                'cache_size': self.config.cache_size,
                'parallel_workers': self.config.parallel_workers,
                'max_memory_usage_mb': self.config.max_memory_usage_mb
            }
        }
    
    async def shutdown(self) -> None:
        """Shutdown performance optimizer"""
        self.parallel_processor.shutdown()
        self.cache.clear()
        logger.info("Performance-optimized bias detector shutdown complete")


# Global instance
performance_optimizer: Optional[PerformanceOptimizedBiasDetector] = None


async def initialize_performance_optimizer(
    config: Optional[OptimizationConfig] = None
) -> PerformanceOptimizedBiasDetector:
    """Initialize global performance optimizer"""
    global performance_optimizer
    
    if performance_optimizer is None:
        performance_optimizer = PerformanceOptimizedBiasDetector(config)
        logger.info("Global performance optimizer initialized")
    
    return performance_optimizer


async def get_performance_optimizer() -> PerformanceOptimizedBiasDetector:
    """Get global performance optimizer instance"""
    if performance_optimizer is None:
        await initialize_performance_optimizer()
    return performance_optimizer


# API endpoints for performance optimization
async def analyze_session_with_performance(
    session_data: SessionData,
    user_id: str,
    use_cache: bool = True
) -> Dict[str, Any]:
    """API endpoint for performance-optimized analysis"""
    optimizer = await get_performance_optimizer()
    return await optimizer.analyze_session_optimized(session_data, user_id, use_cache)


async def analyze_batch_with_performance(
    sessions: List[SessionData],
    user_id: str,
    use_parallel: bool = True
) -> List[Dict[str, Any]]:
    """API endpoint for batch analysis with performance optimization"""
    optimizer = await get_performance_optimizer()
    return await optimizer.analyze_batch_optimized(sessions, user_id, use_parallel)


async def process_large_dataset(
    sessions: List[SessionData],
    user_id: str,
    chunk_size: int = 100
) -> Dict[str, Any]:
    """API endpoint for large dataset processing"""
    optimizer = await get_performance_optimizer()
    return await optimizer.process_large_dataset(sessions, user_id, chunk_size)


async def get_performance_stats() -> Dict[str, Any]:
    """API endpoint for performance statistics"""
    optimizer = await get_performance_optimizer()
    return optimizer.get_performance_stats()


if __name__ == "__main__":
    # Example usage
    async def example():
        optimizer = await initialize_performance_optimizer()
        
        # Create test sessions
        test_sessions = []
        for i in range(10):
            session_data = SessionData(
                session_id=f"test_session_{i}",
                participant_demographics={"age": "26-35", "gender": "female"},
                training_scenario={"type": "individual"},
                content={"text": f"Test conversation content {i}"},
                ai_responses=[],
                expected_outcomes=[],
                transcripts=[],
                metadata={"test": True}
            )
            test_sessions.append(session_data)
        
        # Test batch processing
        results = await optimizer.analyze_batch_optimized(test_sessions, "test_user")
        print(f"Processed {len(results)} sessions")
        
        # Test performance stats
        stats = optimizer.get_performance_stats()
        print(f"Performance stats: {stats}")
        
        # Shutdown
        await optimizer.shutdown()

    asyncio.run(example())
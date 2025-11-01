#!/usr/bin/env python3
"""
Parallel Processing Optimization System for Pixelated Empathy AI
Comprehensive parallel processing with threading, async, multiprocessing, and optimization.
"""

import os
import json
import logging
import time
import threading
import asyncio
import multiprocessing
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable, Union, Tuple
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from enum import Enum
import statistics
import concurrent.futures
from collections import defaultdict, deque
import queue
import psutil

class ProcessingType(Enum):
    """Types of parallel processing."""
    THREADING = "threading"
    ASYNC = "async"
    MULTIPROCESSING = "multiprocessing"
    HYBRID = "hybrid"

class TaskPriority(Enum):
    """Task priority levels."""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4

class TaskStatus(Enum):
    """Task execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class Task:
    """Parallel processing task."""
    task_id: str
    function: Callable
    args: Tuple = field(default_factory=tuple)
    kwargs: Dict[str, Any] = field(default_factory=dict)
    priority: TaskPriority = TaskPriority.NORMAL
    timeout: Optional[int] = None
    retry_count: int = 0
    max_retries: int = 3
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: TaskStatus = TaskStatus.PENDING
    result: Any = None
    error: Optional[str] = None

@dataclass
class ProcessingStats:
    """Parallel processing statistics."""
    total_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    cancelled_tasks: int = 0
    avg_execution_time: float = 0.0
    throughput: float = 0.0  # tasks per second
    cpu_utilization: float = 0.0
    memory_usage: float = 0.0
    active_workers: int = 0
    queue_size: int = 0

class ThreadPoolManager:
    """Manages thread pool for parallel processing."""
    
    def __init__(self, max_workers: int = None, queue_size: int = 1000):
        self.max_workers = max_workers or min(32, (os.cpu_count() or 1) + 4)
        self.queue_size = queue_size
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers)
        self.task_queue = queue.PriorityQueue(maxsize=queue_size)
        self.active_tasks: Dict[str, Task] = {}
        self.completed_tasks: List[Task] = []
        self.stats = ProcessingStats()
        self.running = False
        self.worker_threads: List[threading.Thread] = []
        self.logger = logging.getLogger(__name__)

    def start(self):
        """Start the thread pool manager."""
        if self.running:
            return
        
        self.running = True
        
        # Start worker threads
        for i in range(self.max_workers):
            worker = threading.Thread(target=self._worker_loop, args=(i,))
            worker.daemon = True
            worker.start()
            self.worker_threads.append(worker)
        
        self.logger.info(f"Started thread pool with {self.max_workers} workers")

    def stop(self):
        """Stop the thread pool manager."""
        self.running = False
        self.executor.shutdown(wait=True)
        self.logger.info("Thread pool stopped")

    def submit_task(self, task: Task) -> bool:
        """Submit a task for execution."""
        try:
            # Use negative priority for priority queue (higher priority = lower number)
            priority_value = -task.priority.value
            self.task_queue.put((priority_value, task.created_at, task), timeout=1)
            self.stats.total_tasks += 1
            self.stats.queue_size = self.task_queue.qsize()
            return True
        except queue.Full:
            self.logger.warning(f"Task queue full, rejecting task {task.task_id}")
            return False

    def _worker_loop(self, worker_id: int):
        """Main worker loop."""
        while self.running:
            try:
                # Get task from queue
                try:
                    priority, created_at, task = self.task_queue.get(timeout=1)
                except queue.Empty:
                    continue
                
                # Execute task
                self._execute_task(task, worker_id)
                self.task_queue.task_done()
                
            except Exception as e:
                self.logger.error(f"Worker {worker_id} error: {e}")

    def _execute_task(self, task: Task, worker_id: int):
        """Execute a single task."""
        task.status = TaskStatus.RUNNING
        task.started_at = datetime.now()
        self.active_tasks[task.task_id] = task
        self.stats.active_workers += 1
        
        try:
            # Execute with timeout
            future = self.executor.submit(task.function, *task.args, **task.kwargs)
            
            if task.timeout:
                result = future.result(timeout=task.timeout)
            else:
                result = future.result()
            
            # Task completed successfully
            task.result = result
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.now()
            self.stats.completed_tasks += 1
            
            self.logger.debug(f"Worker {worker_id} completed task {task.task_id}")
            
        except concurrent.futures.TimeoutError:
            task.status = TaskStatus.FAILED
            task.error = "Task timeout"
            task.completed_at = datetime.now()
            self.stats.failed_tasks += 1
            
            self.logger.warning(f"Task {task.task_id} timed out")
            
        except Exception as e:
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.completed_at = datetime.now()
            
            # Retry logic
            if task.retry_count < task.max_retries:
                task.retry_count += 1
                task.status = TaskStatus.PENDING
                self.submit_task(task)
                self.logger.info(f"Retrying task {task.task_id} (attempt {task.retry_count})")
            else:
                self.stats.failed_tasks += 1
                self.logger.error(f"Task {task.task_id} failed after {task.max_retries} retries: {e}")
        
        finally:
            # Cleanup
            if task.task_id in self.active_tasks:
                del self.active_tasks[task.task_id]
            
            self.completed_tasks.append(task)
            self.stats.active_workers -= 1
            self.stats.queue_size = self.task_queue.qsize()
            
            # Update statistics
            self._update_stats()

    def _update_stats(self):
        """Update processing statistics."""
        if self.completed_tasks:
            # Calculate average execution time
            execution_times = []
            for task in self.completed_tasks:
                if task.started_at and task.completed_at:
                    duration = (task.completed_at - task.started_at).total_seconds()
                    execution_times.append(duration)
            
            if execution_times:
                self.stats.avg_execution_time = statistics.mean(execution_times)
                
                # Calculate throughput (tasks per second)
                total_time = sum(execution_times)
                if total_time > 0:
                    self.stats.throughput = len(execution_times) / total_time

    def get_stats(self) -> ProcessingStats:
        """Get current processing statistics."""
        # Update system metrics
        self.stats.cpu_utilization = psutil.cpu_percent()
        self.stats.memory_usage = psutil.virtual_memory().percent
        
        return self.stats

class AsyncProcessingManager:
    """Manages async processing for I/O-bound tasks."""
    
    def __init__(self, max_concurrent: int = 100):
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.active_tasks: Dict[str, Task] = {}
        self.completed_tasks: List[Task] = []
        self.stats = ProcessingStats()
        self.logger = logging.getLogger(__name__)

    async def submit_task(self, task: Task) -> Any:
        """Submit an async task for execution."""
        async with self.semaphore:
            return await self._execute_async_task(task)

    async def submit_batch(self, tasks: List[Task]) -> List[Any]:
        """Submit a batch of async tasks."""
        self.logger.info(f"Submitting batch of {len(tasks)} async tasks")
        
        # Create coroutines
        coroutines = [self.submit_task(task) for task in tasks]
        
        # Execute concurrently
        results = await asyncio.gather(*coroutines, return_exceptions=True)
        
        return results

    async def _execute_async_task(self, task: Task) -> Any:
        """Execute a single async task."""
        task.status = TaskStatus.RUNNING
        task.started_at = datetime.now()
        self.active_tasks[task.task_id] = task
        self.stats.total_tasks += 1
        
        try:
            # Execute async function
            if asyncio.iscoroutinefunction(task.function):
                if task.timeout:
                    result = await asyncio.wait_for(
                        task.function(*task.args, **task.kwargs),
                        timeout=task.timeout
                    )
                else:
                    result = await task.function(*task.args, **task.kwargs)
            else:
                # Run sync function in thread pool
                loop = asyncio.get_event_loop()
                if task.timeout:
                    result = await asyncio.wait_for(
                        loop.run_in_executor(None, task.function, *task.args),
                        timeout=task.timeout
                    )
                else:
                    result = await loop.run_in_executor(None, task.function, *task.args)
            
            # Task completed successfully
            task.result = result
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.now()
            self.stats.completed_tasks += 1
            
            return result
            
        except asyncio.TimeoutError:
            task.status = TaskStatus.FAILED
            task.error = "Task timeout"
            task.completed_at = datetime.now()
            self.stats.failed_tasks += 1
            raise
            
        except Exception as e:
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.completed_at = datetime.now()
            self.stats.failed_tasks += 1
            raise
        
        finally:
            if task.task_id in self.active_tasks:
                del self.active_tasks[task.task_id]
            
            self.completed_tasks.append(task)

class MultiprocessingManager:
    """Manages multiprocessing for CPU-bound tasks."""
    
    def __init__(self, max_processes: int = None):
        self.max_processes = max_processes or os.cpu_count()
        self.process_pool = multiprocessing.Pool(processes=self.max_processes)
        self.active_tasks: Dict[str, Task] = {}
        self.completed_tasks: List[Task] = []
        self.stats = ProcessingStats()
        self.logger = logging.getLogger(__name__)

    def submit_task(self, task: Task) -> Any:
        """Submit a task for multiprocessing execution."""
        task.status = TaskStatus.RUNNING
        task.started_at = datetime.now()
        self.active_tasks[task.task_id] = task
        self.stats.total_tasks += 1
        
        # Submit to process pool
        async_result = self.process_pool.apply_async(
            task.function,
            task.args,
            task.kwargs,
            callback=lambda result: self._task_completed(task, result),
            error_callback=lambda error: self._task_failed(task, error)
        )
        
        return async_result

    def submit_batch(self, tasks: List[Task]) -> List[Any]:
        """Submit a batch of tasks for multiprocessing."""
        self.logger.info(f"Submitting batch of {len(tasks)} multiprocessing tasks")
        
        results = []
        for task in tasks:
            result = self.submit_task(task)
            results.append(result)
        
        return results

    def _task_completed(self, task: Task, result: Any):
        """Handle task completion."""
        task.result = result
        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.now()
        self.stats.completed_tasks += 1
        
        if task.task_id in self.active_tasks:
            del self.active_tasks[task.task_id]
        
        self.completed_tasks.append(task)

    def _task_failed(self, task: Task, error: Exception):
        """Handle task failure."""
        task.status = TaskStatus.FAILED
        task.error = str(error)
        task.completed_at = datetime.now()
        self.stats.failed_tasks += 1
        
        if task.task_id in self.active_tasks:
            del self.active_tasks[task.task_id]
        
        self.completed_tasks.append(task)

    def shutdown(self):
        """Shutdown the process pool."""
        self.process_pool.close()
        self.process_pool.join()
        self.logger.info("Multiprocessing pool shutdown")

class ParallelProcessingOptimizer:
    """Main parallel processing optimization system."""
    
    def __init__(self):
        self.logger = self._setup_logging()
        self.thread_manager = ThreadPoolManager()
        self.async_manager = AsyncProcessingManager()
        self.multiprocessing_manager = MultiprocessingManager()
        
        # Performance monitoring
        self.performance_history: deque = deque(maxlen=1000)
        self.optimization_enabled = True

    def _setup_logging(self) -> logging.Logger:
        """Setup logging for parallel processing."""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        return logging.getLogger(__name__)

    def start(self):
        """Start all processing managers."""
        self.thread_manager.start()
        self.logger.info("Parallel processing system started")

    def stop(self):
        """Stop all processing managers."""
        self.thread_manager.stop()
        self.multiprocessing_manager.shutdown()
        self.logger.info("Parallel processing system stopped")

    def submit_task(self, task: Task, processing_type: ProcessingType = ProcessingType.THREADING) -> Any:
        """Submit a task with the specified processing type."""
        if processing_type == ProcessingType.THREADING:
            return self.thread_manager.submit_task(task)
        elif processing_type == ProcessingType.MULTIPROCESSING:
            return self.multiprocessing_manager.submit_task(task)
        else:
            raise ValueError(f"Unsupported processing type: {processing_type}")

    async def submit_async_task(self, task: Task) -> Any:
        """Submit an async task."""
        return await self.async_manager.submit_task(task)

    async def submit_async_batch(self, tasks: List[Task]) -> List[Any]:
        """Submit a batch of async tasks."""
        return await self.async_manager.submit_batch(tasks)

    def optimize_workload(self, tasks: List[Task]) -> Dict[ProcessingType, List[Task]]:
        """Optimize task distribution across processing types."""
        if not self.optimization_enabled:
            return {ProcessingType.THREADING: tasks}
        
        optimized_distribution = {
            ProcessingType.THREADING: [],
            ProcessingType.ASYNC: [],
            ProcessingType.MULTIPROCESSING: []
        }
        
        for task in tasks:
            # Simple heuristic for task distribution
            if self._is_io_bound_task(task):
                optimized_distribution[ProcessingType.ASYNC].append(task)
            elif self._is_cpu_bound_task(task):
                optimized_distribution[ProcessingType.MULTIPROCESSING].append(task)
            else:
                optimized_distribution[ProcessingType.THREADING].append(task)
        
        return optimized_distribution

    def _is_io_bound_task(self, task: Task) -> bool:
        """Determine if a task is I/O bound."""
        # Simple heuristic based on function name and metadata
        function_name = task.function.__name__.lower()
        io_keywords = ['request', 'fetch', 'download', 'upload', 'read', 'write', 'query', 'api']
        
        return any(keyword in function_name for keyword in io_keywords)

    def _is_cpu_bound_task(self, task: Task) -> bool:
        """Determine if a task is CPU bound."""
        # Simple heuristic based on function name and metadata
        function_name = task.function.__name__.lower()
        cpu_keywords = ['compute', 'calculate', 'process', 'analyze', 'transform', 'encode', 'decode']
        
        return any(keyword in function_name for keyword in cpu_keywords)

    def get_combined_stats(self) -> Dict[str, ProcessingStats]:
        """Get statistics from all processing managers."""
        return {
            'threading': self.thread_manager.get_stats(),
            'async': self.async_manager.stats,
            'multiprocessing': self.multiprocessing_manager.stats
        }

    def generate_performance_report(self) -> str:
        """Generate comprehensive performance report."""
        report_file = f"parallel_processing_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        stats = self.get_combined_stats()
        
        # Calculate overall metrics
        total_tasks = sum(s.total_tasks for s in stats.values())
        total_completed = sum(s.completed_tasks for s in stats.values())
        total_failed = sum(s.failed_tasks for s in stats.values())
        
        report = {
            'generated_at': datetime.now().isoformat(),
            'overall_metrics': {
                'total_tasks': total_tasks,
                'completed_tasks': total_completed,
                'failed_tasks': total_failed,
                'success_rate': (total_completed / total_tasks * 100) if total_tasks > 0 else 0.0
            },
            'processing_type_stats': {
                name: asdict(stat) for name, stat in stats.items()
            },
            'system_metrics': {
                'cpu_utilization': psutil.cpu_percent(),
                'memory_usage': psutil.virtual_memory().percent,
                'cpu_count': os.cpu_count(),
                'thread_count': threading.active_count()
            }
        }
        
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        self.logger.info(f"Performance report saved to {report_file}")
        return report_file

# Example task functions for testing
def cpu_intensive_task(n: int) -> int:
    """CPU-intensive task for testing."""
    result = 0
    for i in range(n):
        result += i ** 2
    return result

def io_intensive_task(delay: float) -> str:
    """I/O-intensive task simulation."""
    time.sleep(delay)
    return f"Completed after {delay}s delay"

async def async_task(delay: float) -> str:
    """Async task for testing."""
    await asyncio.sleep(delay)
    return f"Async task completed after {delay}s"

def main():
    """Main function for testing the parallel processing system."""
    print("⚡ PARALLEL PROCESSING OPTIMIZATION TEST")
    print("=" * 50)
    
    # Initialize parallel processing system
    processor = ParallelProcessingOptimizer()
    processor.start()
    
    # Create test tasks
    tasks = []
    
    # CPU-bound tasks
    for i in range(5):
        task = Task(
            task_id=f"cpu_task_{i}",
            function=cpu_intensive_task,
            args=(10000,),
            priority=TaskPriority.NORMAL
        )
        tasks.append(task)
    
    # I/O-bound tasks
    for i in range(5):
        task = Task(
            task_id=f"io_task_{i}",
            function=io_intensive_task,
            args=(0.1,),
            priority=TaskPriority.HIGH
        )
        tasks.append(task)
    
    print(f"✅ Created {len(tasks)} test tasks")
    
    # Optimize workload distribution
    optimized_tasks = processor.optimize_workload(tasks)
    
    for processing_type, task_list in optimized_tasks.items():
        if task_list:
            print(f"✅ {processing_type.value}: {len(task_list)} tasks")
    
    # Submit threading tasks
    threading_tasks = optimized_tasks[ProcessingType.THREADING]
    for task in threading_tasks:
        processor.submit_task(task, ProcessingType.THREADING)
    
    # Submit multiprocessing tasks
    mp_tasks = optimized_tasks[ProcessingType.MULTIPROCESSING]
    for task in mp_tasks:
        processor.submit_task(task, ProcessingType.MULTIPROCESSING)
    
    # Submit async tasks
    async def run_async_tasks():
        async_tasks = optimized_tasks[ProcessingType.ASYNC]
        if async_tasks:
            results = await processor.submit_async_batch(async_tasks)
            return results
        return []
    
    # Run async tasks
    if optimized_tasks[ProcessingType.ASYNC]:
        async_results = asyncio.run(run_async_tasks())
        print(f"✅ Async tasks completed: {len(async_results)} results")
    
    # Wait for completion
    time.sleep(2)
    
    # Get statistics
    stats = processor.get_combined_stats()
    
    for processing_type, stat in stats.items():
        if stat.total_tasks > 0:
            print(f"✅ {processing_type} stats:")
            print(f"  - Total tasks: {stat.total_tasks}")
            print(f"  - Completed: {stat.completed_tasks}")
            print(f"  - Failed: {stat.failed_tasks}")
            print(f"  - Avg execution time: {stat.avg_execution_time:.3f}s")
    
    # Generate report
    report_file = processor.generate_performance_report()
    print(f"✅ Performance report: {report_file}")
    
    # Cleanup
    processor.stop()
    
    print("\n🎉 Parallel processing optimization system is functional!")

if __name__ == "__main__":
    main()


# Alias for compatibility
ParallelProcessor = ProcessingType


class ParallelProcessor:
    """Complete parallel processing system."""
    
    def __init__(self, max_workers: int = None):
        self.logger = logging.getLogger(__name__)
        self.max_workers = max_workers or os.cpu_count()
        self.processing_history = []
    
    def process_parallel(self, tasks: List, worker_function, **kwargs) -> Dict:
        """Process tasks in parallel using threading."""
        try:
            import concurrent.futures
            
            self.logger.info(f"Processing {len(tasks)} tasks with {self.max_workers} workers")
            
            start_time = time.time()
            results = []
            
            with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                future_to_task = {executor.submit(worker_function, task, **kwargs): task for task in tasks}
                
                for future in concurrent.futures.as_completed(future_to_task):
                    task = future_to_task[future]
                    try:
                        result = future.result()
                        results.append({'task': task, 'result': result, 'status': 'success'})
                    except Exception as e:
                        results.append({'task': task, 'error': str(e), 'status': 'failed'})
            
            end_time = time.time()
            
            processing_result = {
                'total_tasks': len(tasks),
                'successful_tasks': sum(1 for r in results if r['status'] == 'success'),
                'failed_tasks': sum(1 for r in results if r['status'] == 'failed'),
                'duration': end_time - start_time,
                'results': results,
                'timestamp': datetime.now().isoformat()
            }
            
            self.processing_history.append(processing_result)
            return processing_result
            
        except Exception as e:
            self.logger.error(f"Parallel processing failed: {e}")
            return {'status': 'failed', 'error': str(e)}
    
    def process_multiprocessing(self, tasks: List, worker_function, **kwargs) -> Dict:
        """Process tasks using multiprocessing."""
        try:
            import multiprocessing
            
            self.logger.info(f"Processing {len(tasks)} tasks with multiprocessing")
            
            start_time = time.time()
            
            with multiprocessing.Pool(processes=self.max_workers) as pool:
                results = pool.starmap(worker_function, [(task, kwargs) for task in tasks])
            
            end_time = time.time()
            
            processing_result = {
                'total_tasks': len(tasks),
                'duration': end_time - start_time,
                'results': results,
                'processing_type': 'multiprocessing',
                'timestamp': datetime.now().isoformat()
            }
            
            self.processing_history.append(processing_result)
            return processing_result
            
        except Exception as e:
            self.logger.error(f"Multiprocessing failed: {e}")
            return {'status': 'failed', 'error': str(e)}
    
    def process(self, tasks: List, worker_function, method: str = 'threading', **kwargs) -> Dict:
        """Process tasks using specified method."""
        if method == 'threading':
            return self.process_parallel(tasks, worker_function, **kwargs)
        elif method == 'multiprocessing':
            return self.process_multiprocessing(tasks, worker_function, **kwargs)
        else:
            return {'status': 'failed', 'error': f'Unknown processing method: {method}'}
    
    def get_processing_history(self) -> List[Dict]:
        """Get processing history."""
        return self.processing_history

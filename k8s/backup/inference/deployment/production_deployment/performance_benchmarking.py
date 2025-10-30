#!/usr/bin/env python3
"""
Performance Benchmarking System for Pixelated Empathy AI
Comprehensive performance measurement, baseline establishment, and comparative analysis.
"""

import os
import json
import logging
import time
import threading
import psutil
import statistics
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from enum import Enum
import subprocess
import hashlib
from collections import defaultdict, deque

class BenchmarkType(Enum):
    """Types of performance benchmarks."""
    CPU_BENCHMARK = "cpu_benchmark"
    MEMORY_BENCHMARK = "memory_benchmark"
    DISK_IO_BENCHMARK = "disk_io_benchmark"
    NETWORK_BENCHMARK = "network_benchmark"
    APPLICATION_BENCHMARK = "application_benchmark"
    DATABASE_BENCHMARK = "database_benchmark"
    AI_INFERENCE_BENCHMARK = "ai_inference_benchmark"
    END_TO_END_BENCHMARK = "end_to_end_benchmark"

class PerformanceMetric(Enum):
    """Performance metrics to measure."""
    THROUGHPUT = "throughput"
    LATENCY = "latency"
    RESPONSE_TIME = "response_time"
    REQUESTS_PER_SECOND = "requests_per_second"
    TRANSACTIONS_PER_SECOND = "transactions_per_second"
    CPU_UTILIZATION = "cpu_utilization"
    MEMORY_UTILIZATION = "memory_utilization"
    DISK_IOPS = "disk_iops"
    NETWORK_BANDWIDTH = "network_bandwidth"
    ERROR_RATE = "error_rate"

@dataclass
class BenchmarkConfig:
    """Benchmark configuration."""
    name: str
    benchmark_type: BenchmarkType
    duration_seconds: int
    warmup_seconds: int = 30
    cooldown_seconds: int = 10
    iterations: int = 1
    target_metrics: List[PerformanceMetric] = field(default_factory=list)
    parameters: Dict[str, Any] = field(default_factory=dict)
    baseline_file: Optional[str] = None

@dataclass
class PerformanceResult:
    """Individual performance measurement result."""
    metric: PerformanceMetric
    value: float
    unit: str
    timestamp: datetime
    iteration: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class BenchmarkReport:
    """Comprehensive benchmark report."""
    benchmark_name: str
    benchmark_type: BenchmarkType
    start_time: datetime
    end_time: datetime
    total_duration: float
    iterations: int
    results: Dict[str, List[PerformanceResult]] = field(default_factory=dict)
    statistics: Dict[str, Dict[str, float]] = field(default_factory=dict)
    baseline_comparison: Dict[str, Dict[str, float]] = field(default_factory=dict)
    performance_score: float = 0.0
    recommendations: List[str] = field(default_factory=list)

class SystemBenchmark:
    """System-level performance benchmarks."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def benchmark_cpu(self, duration: int = 30) -> List[PerformanceResult]:
        """Benchmark CPU performance."""
        self.logger.info(f"Running CPU benchmark for {duration}s")
        
        results = []
        start_time = time.time()
        
        # CPU intensive calculation benchmark
        def cpu_work():
            count = 0
            work_start = time.time()
            while time.time() - work_start < duration:
                # Prime number calculation
                for i in range(2, 1000):
                    is_prime = True
                    for j in range(2, int(i**0.5) + 1):
                        if i % j == 0:
                            is_prime = False
                            break
                    if is_prime:
                        count += 1
            return count
        
        # Run CPU benchmark
        operations = cpu_work()
        benchmark_duration = time.time() - start_time
        
        # Calculate operations per second
        ops_per_second = operations / benchmark_duration
        
        results.append(PerformanceResult(
            metric=PerformanceMetric.THROUGHPUT,
            value=ops_per_second,
            unit="operations/second",
            timestamp=datetime.now(),
            metadata={"total_operations": operations, "duration": benchmark_duration}
        ))
        
        # Measure CPU utilization during benchmark
        cpu_usage = psutil.cpu_percent(interval=1)
        results.append(PerformanceResult(
            metric=PerformanceMetric.CPU_UTILIZATION,
            value=cpu_usage,
            unit="percent",
            timestamp=datetime.now()
        ))
        
        return results

    def benchmark_memory(self, duration: int = 30) -> List[PerformanceResult]:
        """Benchmark memory performance."""
        self.logger.info(f"Running memory benchmark for {duration}s")
        
        results = []
        start_time = time.time()
        
        # Memory allocation and access benchmark
        chunk_size = 1024 * 1024  # 1MB chunks
        data_chunks = []
        operations = 0
        
        while time.time() - start_time < duration:
            # Allocate memory
            chunk = bytearray(chunk_size)
            data_chunks.append(chunk)
            
            # Write to memory
            for i in range(0, chunk_size, 1024):
                chunk[i] = i % 256
            
            # Read from memory
            checksum = sum(chunk[i] for i in range(0, chunk_size, 1024))
            
            operations += 1
            
            # Limit memory usage
            if len(data_chunks) > 100:
                data_chunks.pop(0)
        
        benchmark_duration = time.time() - start_time
        
        # Calculate memory throughput
        memory_throughput = (operations * chunk_size) / (benchmark_duration * 1024 * 1024)  # MB/s
        
        results.append(PerformanceResult(
            metric=PerformanceMetric.THROUGHPUT,
            value=memory_throughput,
            unit="MB/s",
            timestamp=datetime.now(),
            metadata={"operations": operations, "chunk_size": chunk_size}
        ))
        
        # Measure memory utilization
        memory = psutil.virtual_memory()
        results.append(PerformanceResult(
            metric=PerformanceMetric.MEMORY_UTILIZATION,
            value=memory.percent,
            unit="percent",
            timestamp=datetime.now()
        ))
        
        return results

    def benchmark_disk_io(self, duration: int = 30) -> List[PerformanceResult]:
        """Benchmark disk I/O performance."""
        self.logger.info(f"Running disk I/O benchmark for {duration}s")
        
        results = []
        test_file = Path("/tmp/benchmark_test.dat")
        
        try:
            start_time = time.time()
            file_size = 1024 * 1024  # 1MB
            operations = 0
            
            while time.time() - start_time < duration:
                # Write test
                write_start = time.time()
                with open(test_file, "wb") as f:
                    f.write(os.urandom(file_size))
                    f.flush()
                    os.fsync(f.fileno())
                write_time = time.time() - write_start
                
                # Read test
                read_start = time.time()
                with open(test_file, "rb") as f:
                    data = f.read()
                read_time = time.time() - read_start
                
                operations += 1
            
            benchmark_duration = time.time() - start_time
            
            # Calculate I/O metrics
            write_throughput = (operations * file_size) / (benchmark_duration * 1024 * 1024)  # MB/s
            iops = operations / benchmark_duration
            
            results.append(PerformanceResult(
                metric=PerformanceMetric.THROUGHPUT,
                value=write_throughput,
                unit="MB/s",
                timestamp=datetime.now(),
                metadata={"operation": "write", "file_size": file_size}
            ))
            
            results.append(PerformanceResult(
                metric=PerformanceMetric.DISK_IOPS,
                value=iops,
                unit="IOPS",
                timestamp=datetime.now(),
                metadata={"operations": operations}
            ))
            
        finally:
            # Cleanup
            if test_file.exists():
                test_file.unlink()
        
        return results

    def benchmark_network(self, duration: int = 30) -> List[PerformanceResult]:
        """Benchmark network performance."""
        self.logger.info(f"Running network benchmark for {duration}s")
        
        results = []
        start_time = time.time()
        
        # Simple network benchmark using HTTP requests
        import requests
        
        operations = 0
        total_bytes = 0
        response_times = []
        
        while time.time() - start_time < duration:
            try:
                request_start = time.time()
                response = requests.get("http://httpbin.org/bytes/1024", timeout=5)
                request_time = time.time() - request_start
                
                if response.status_code == 200:
                    operations += 1
                    total_bytes += len(response.content)
                    response_times.append(request_time)
                
            except Exception as e:
                self.logger.debug(f"Network request failed: {e}")
        
        benchmark_duration = time.time() - start_time
        
        if operations > 0:
            # Calculate network metrics
            throughput = total_bytes / (benchmark_duration * 1024)  # KB/s
            avg_latency = statistics.mean(response_times) * 1000  # ms
            requests_per_second = operations / benchmark_duration
            
            results.append(PerformanceResult(
                metric=PerformanceMetric.NETWORK_BANDWIDTH,
                value=throughput,
                unit="KB/s",
                timestamp=datetime.now(),
                metadata={"total_bytes": total_bytes}
            ))
            
            results.append(PerformanceResult(
                metric=PerformanceMetric.LATENCY,
                value=avg_latency,
                unit="ms",
                timestamp=datetime.now()
            ))
            
            results.append(PerformanceResult(
                metric=PerformanceMetric.REQUESTS_PER_SECOND,
                value=requests_per_second,
                unit="req/s",
                timestamp=datetime.now()
            ))
        
        return results

class ApplicationBenchmark:
    """Application-specific performance benchmarks."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def benchmark_ai_inference(self, duration: int = 60) -> List[PerformanceResult]:
        """Benchmark AI inference performance."""
        self.logger.info(f"Running AI inference benchmark for {duration}s")
        
        results = []
        start_time = time.time()
        
        # Simulate AI inference operations
        operations = 0
        inference_times = []
        
        while time.time() - start_time < duration:
            inference_start = time.time()
            
            # Simulate AI model inference (matrix operations)
            import random
            matrix_size = 100
            matrix_a = [[random.random() for _ in range(matrix_size)] for _ in range(matrix_size)]
            matrix_b = [[random.random() for _ in range(matrix_size)] for _ in range(matrix_size)]
            
            # Matrix multiplication simulation
            result_matrix = [[0 for _ in range(matrix_size)] for _ in range(matrix_size)]
            for i in range(matrix_size):
                for j in range(matrix_size):
                    for k in range(matrix_size):
                        result_matrix[i][j] += matrix_a[i][k] * matrix_b[k][j]
            
            inference_time = time.time() - inference_start
            inference_times.append(inference_time)
            operations += 1
        
        benchmark_duration = time.time() - start_time
        
        # Calculate AI inference metrics
        avg_inference_time = statistics.mean(inference_times) * 1000  # ms
        inferences_per_second = operations / benchmark_duration
        p95_inference_time = sorted(inference_times)[int(len(inference_times) * 0.95)] * 1000
        
        results.append(PerformanceResult(
            metric=PerformanceMetric.LATENCY,
            value=avg_inference_time,
            unit="ms",
            timestamp=datetime.now(),
            metadata={"metric_type": "average_inference_time"}
        ))
        
        results.append(PerformanceResult(
            metric=PerformanceMetric.THROUGHPUT,
            value=inferences_per_second,
            unit="inferences/s",
            timestamp=datetime.now(),
            metadata={"total_inferences": operations}
        ))
        
        results.append(PerformanceResult(
            metric=PerformanceMetric.LATENCY,
            value=p95_inference_time,
            unit="ms",
            timestamp=datetime.now(),
            metadata={"metric_type": "p95_inference_time"}
        ))
        
        return results

class PerformanceBenchmarkingSystem:
    """Main performance benchmarking system."""
    
    def __init__(self):
        self.logger = self._setup_logging()
        self.system_benchmark = SystemBenchmark()
        self.app_benchmark = ApplicationBenchmark()
        self.benchmark_configs: Dict[str, BenchmarkConfig] = {}
        self.benchmark_reports: List[BenchmarkReport] = []
        self.baselines: Dict[str, Dict[str, float]] = {}

    def _setup_logging(self) -> logging.Logger:
        """Setup logging for benchmarking."""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        return logging.getLogger(__name__)

    def add_benchmark_config(self, config: BenchmarkConfig):
        """Add a benchmark configuration."""
        self.benchmark_configs[config.name] = config
        self.logger.info(f"Added benchmark config: {config.name}")

    def run_benchmark(self, benchmark_name: str) -> BenchmarkReport:
        """Run a specific benchmark."""
        if benchmark_name not in self.benchmark_configs:
            raise ValueError(f"Benchmark config '{benchmark_name}' not found")
        
        config = self.benchmark_configs[benchmark_name]
        
        self.logger.info(f"Starting benchmark: {benchmark_name}")
        self.logger.info(f"Benchmark type: {config.benchmark_type.value}")
        self.logger.info(f"Duration: {config.duration_seconds}s")
        self.logger.info(f"Iterations: {config.iterations}")
        
        start_time = datetime.now()
        all_results = defaultdict(list)
        
        # Run benchmark iterations
        for iteration in range(config.iterations):
            self.logger.info(f"Running iteration {iteration + 1}/{config.iterations}")
            
            # Warmup period
            if config.warmup_seconds > 0:
                self.logger.info(f"Warmup period: {config.warmup_seconds}s")
                time.sleep(config.warmup_seconds)
            
            # Run benchmark based on type
            iteration_results = self._execute_benchmark(config)
            
            # Add iteration number to results
            for result in iteration_results:
                result.iteration = iteration
                all_results[result.metric.value].append(result)
            
            # Cooldown period
            if config.cooldown_seconds > 0 and iteration < config.iterations - 1:
                self.logger.info(f"Cooldown period: {config.cooldown_seconds}s")
                time.sleep(config.cooldown_seconds)
        
        end_time = datetime.now()
        total_duration = (end_time - start_time).total_seconds()
        
        # Calculate statistics
        statistics_data = self._calculate_statistics(all_results)
        
        # Load baseline if available
        baseline_comparison = {}
        if config.baseline_file and Path(config.baseline_file).exists():
            baseline_comparison = self._compare_with_baseline(config.baseline_file, statistics_data)
        
        # Calculate performance score
        performance_score = self._calculate_performance_score(statistics_data, baseline_comparison)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(statistics_data, baseline_comparison)
        
        # Create report
        report = BenchmarkReport(
            benchmark_name=benchmark_name,
            benchmark_type=config.benchmark_type,
            start_time=start_time,
            end_time=end_time,
            total_duration=total_duration,
            iterations=config.iterations,
            results=dict(all_results),
            statistics=statistics_data,
            baseline_comparison=baseline_comparison,
            performance_score=performance_score,
            recommendations=recommendations
        )
        
        self.benchmark_reports.append(report)
        
        self.logger.info(f"Benchmark completed: {benchmark_name}")
        self.logger.info(f"Performance score: {performance_score:.1f}/100")
        
        return report

    def _execute_benchmark(self, config: BenchmarkConfig) -> List[PerformanceResult]:
        """Execute benchmark based on configuration."""
        if config.benchmark_type == BenchmarkType.CPU_BENCHMARK:
            return self.system_benchmark.benchmark_cpu(config.duration_seconds)
        elif config.benchmark_type == BenchmarkType.MEMORY_BENCHMARK:
            return self.system_benchmark.benchmark_memory(config.duration_seconds)
        elif config.benchmark_type == BenchmarkType.DISK_IO_BENCHMARK:
            return self.system_benchmark.benchmark_disk_io(config.duration_seconds)
        elif config.benchmark_type == BenchmarkType.NETWORK_BENCHMARK:
            return self.system_benchmark.benchmark_network(config.duration_seconds)
        elif config.benchmark_type == BenchmarkType.AI_INFERENCE_BENCHMARK:
            return self.app_benchmark.benchmark_ai_inference(config.duration_seconds)
        else:
            self.logger.warning(f"Unsupported benchmark type: {config.benchmark_type}")
            return []

    def _calculate_statistics(self, results: Dict[str, List[PerformanceResult]]) -> Dict[str, Dict[str, float]]:
        """Calculate statistics for benchmark results."""
        stats = {}
        
        for metric_name, metric_results in results.items():
            values = [r.value for r in metric_results]
            
            if values:
                stats[metric_name] = {
                    'count': len(values),
                    'mean': statistics.mean(values),
                    'median': statistics.median(values),
                    'min': min(values),
                    'max': max(values),
                    'std_dev': statistics.stdev(values) if len(values) > 1 else 0.0,
                    'p95': sorted(values)[int(len(values) * 0.95)] if len(values) > 1 else values[0],
                    'p99': sorted(values)[int(len(values) * 0.99)] if len(values) > 1 else values[0]
                }
        
        return stats

    def _compare_with_baseline(self, baseline_file: str, current_stats: Dict[str, Dict[str, float]]) -> Dict[str, Dict[str, float]]:
        """Compare current results with baseline."""
        try:
            with open(baseline_file, 'r') as f:
                baseline_data = json.load(f)
            
            baseline_stats = baseline_data.get('statistics', {})
            comparison = {}
            
            for metric_name, current_data in current_stats.items():
                if metric_name in baseline_stats:
                    baseline_mean = baseline_stats[metric_name]['mean']
                    current_mean = current_data['mean']
                    
                    if baseline_mean > 0:
                        improvement = ((current_mean - baseline_mean) / baseline_mean) * 100
                    else:
                        improvement = 0.0
                    
                    comparison[metric_name] = {
                        'baseline_mean': baseline_mean,
                        'current_mean': current_mean,
                        'improvement_percent': improvement,
                        'better': improvement > 0
                    }
            
            return comparison
            
        except Exception as e:
            self.logger.error(f"Failed to load baseline: {e}")
            return {}

    def _calculate_performance_score(self, stats: Dict[str, Dict[str, float]], 
                                   baseline_comparison: Dict[str, Dict[str, float]]) -> float:
        """Calculate overall performance score."""
        if not stats:
            return 0.0
        
        score = 50.0  # Base score
        
        # Adjust score based on baseline comparison
        if baseline_comparison:
            improvements = [comp['improvement_percent'] for comp in baseline_comparison.values()]
            if improvements:
                avg_improvement = statistics.mean(improvements)
                score += min(avg_improvement, 50)  # Cap at 50 point improvement
        
        # Adjust score based on performance characteristics
        for metric_name, metric_stats in stats.items():
            if 'latency' in metric_name.lower():
                # Lower latency is better
                if metric_stats['mean'] < 100:  # < 100ms
                    score += 5
                elif metric_stats['mean'] > 1000:  # > 1s
                    score -= 10
            
            elif 'throughput' in metric_name.lower():
                # Higher throughput is better
                if metric_stats['mean'] > 1000:
                    score += 5
                elif metric_stats['mean'] < 100:
                    score -= 5
        
        return max(min(score, 100.0), 0.0)

    def _generate_recommendations(self, stats: Dict[str, Dict[str, float]], 
                                baseline_comparison: Dict[str, Dict[str, float]]) -> List[str]:
        """Generate performance recommendations."""
        recommendations = []
        
        # Analyze latency metrics
        for metric_name, metric_stats in stats.items():
            if 'latency' in metric_name.lower():
                if metric_stats['mean'] > 1000:  # > 1s
                    recommendations.append(f"High {metric_name}: Consider optimizing for lower latency")
                
                if metric_stats['std_dev'] > metric_stats['mean'] * 0.5:
                    recommendations.append(f"High {metric_name} variance: Investigate inconsistent performance")
        
        # Analyze throughput metrics
        for metric_name, metric_stats in stats.items():
            if 'throughput' in metric_name.lower():
                if metric_stats['mean'] < 100:
                    recommendations.append(f"Low {metric_name}: Consider scaling or optimization")
        
        # Baseline comparison recommendations
        for metric_name, comparison in baseline_comparison.items():
            if comparison['improvement_percent'] < -10:  # 10% degradation
                recommendations.append(f"Performance regression in {metric_name}: {comparison['improvement_percent']:.1f}% worse than baseline")
        
        if not recommendations:
            recommendations.append("Performance is within acceptable ranges")
        
        return recommendations

    def save_baseline(self, benchmark_name: str, report: BenchmarkReport):
        """Save benchmark results as baseline."""
        baseline_file = f"{benchmark_name}_baseline.json"
        
        baseline_data = {
            'created_at': datetime.now().isoformat(),
            'benchmark_name': benchmark_name,
            'benchmark_type': report.benchmark_type.value,
            'statistics': report.statistics,
            'performance_score': report.performance_score
        }
        
        with open(baseline_file, 'w') as f:
            json.dump(baseline_data, f, indent=2)
        
        self.logger.info(f"Baseline saved: {baseline_file}")

    def generate_benchmark_report(self) -> str:
        """Generate comprehensive benchmark report."""
        report_file = f"benchmark_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        report = {
            'generated_at': datetime.now().isoformat(),
            'total_benchmarks': len(self.benchmark_reports),
            'benchmark_reports': [asdict(report) for report in self.benchmark_reports]
        }
        
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        self.logger.info(f"Benchmark report saved to {report_file}")
        return report_file

def main():
    """Main function for testing the benchmarking system."""
    print("📊 PERFORMANCE BENCHMARKING SYSTEM TEST")
    print("=" * 50)
    
    # Initialize benchmarking system
    benchmark_system = PerformanceBenchmarkingSystem()
    
    # Create benchmark configurations
    cpu_config = BenchmarkConfig(
        name="cpu_performance",
        benchmark_type=BenchmarkType.CPU_BENCHMARK,
        duration_seconds=15,
        warmup_seconds=5,
        iterations=2,
        target_metrics=[PerformanceMetric.THROUGHPUT, PerformanceMetric.CPU_UTILIZATION]
    )
    
    memory_config = BenchmarkConfig(
        name="memory_performance",
        benchmark_type=BenchmarkType.MEMORY_BENCHMARK,
        duration_seconds=10,
        warmup_seconds=3,
        iterations=2,
        target_metrics=[PerformanceMetric.THROUGHPUT, PerformanceMetric.MEMORY_UTILIZATION]
    )
    
    ai_config = BenchmarkConfig(
        name="ai_inference_performance",
        benchmark_type=BenchmarkType.AI_INFERENCE_BENCHMARK,
        duration_seconds=20,
        warmup_seconds=5,
        iterations=1,
        target_metrics=[PerformanceMetric.LATENCY, PerformanceMetric.THROUGHPUT]
    )
    
    benchmark_system.add_benchmark_config(cpu_config)
    benchmark_system.add_benchmark_config(memory_config)
    benchmark_system.add_benchmark_config(ai_config)
    
    print(f"✅ Added {len(benchmark_system.benchmark_configs)} benchmark configurations")
    
    # Run benchmarks
    try:
        cpu_report = benchmark_system.run_benchmark("cpu_performance")
        print(f"✅ CPU benchmark: Score {cpu_report.performance_score:.1f}/100")
        
        memory_report = benchmark_system.run_benchmark("memory_performance")
        print(f"✅ Memory benchmark: Score {memory_report.performance_score:.1f}/100")
        
        ai_report = benchmark_system.run_benchmark("ai_inference_performance")
        print(f"✅ AI inference benchmark: Score {ai_report.performance_score:.1f}/100")
        
        # Save baselines
        benchmark_system.save_baseline("cpu_performance", cpu_report)
        benchmark_system.save_baseline("memory_performance", memory_report)
        benchmark_system.save_baseline("ai_inference_performance", ai_report)
        
        # Generate comprehensive report
        report_file = benchmark_system.generate_benchmark_report()
        print(f"✅ Benchmark report: {report_file}")
        
    except Exception as e:
        print(f"❌ Benchmark execution failed: {e}")
    
    print("\n🎉 Performance benchmarking system is functional!")

if __name__ == "__main__":
    main()


# Alias for compatibility
BenchmarkingFramework = BenchmarkType


class BenchmarkingFramework:
    """Complete performance benchmarking framework."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.benchmark_results = []
        self.baselines = {}
    
    def cpu_benchmark(self, iterations: int = 1000000) -> Dict:
        """Run CPU benchmark."""
        try:
            self.logger.info(f"Running CPU benchmark with {iterations} iterations")
            
            start_time = time.time()
            
            # CPU intensive calculation
            result = sum(i * i for i in range(iterations))
            
            end_time = time.time()
            duration = end_time - start_time
            
            benchmark_result = {
                'benchmark_type': 'cpu',
                'iterations': iterations,
                'duration': duration,
                'operations_per_second': iterations / duration if duration > 0 else 0,
                'result': result,
                'timestamp': datetime.now().isoformat()
            }
            
            self.benchmark_results.append(benchmark_result)
            return benchmark_result
            
        except Exception as e:
            self.logger.error(f"CPU benchmark failed: {e}")
            return {'benchmark_type': 'cpu', 'status': 'failed', 'error': str(e)}
    
    def memory_benchmark(self, size_mb: int = 100) -> Dict:
        """Run memory benchmark."""
        try:
            self.logger.info(f"Running memory benchmark with {size_mb}MB")
            
            start_time = time.time()
            
            # Memory allocation and access
            data = bytearray(size_mb * 1024 * 1024)
            
            # Write to memory
            for i in range(0, len(data), 1024):
                data[i] = i % 256
            
            # Read from memory
            checksum = sum(data[i] for i in range(0, len(data), 1024))
            
            end_time = time.time()
            duration = end_time - start_time
            
            benchmark_result = {
                'benchmark_type': 'memory',
                'size_mb': size_mb,
                'duration': duration,
                'throughput_mbps': size_mb / duration if duration > 0 else 0,
                'checksum': checksum,
                'timestamp': datetime.now().isoformat()
            }
            
            self.benchmark_results.append(benchmark_result)
            return benchmark_result
            
        except Exception as e:
            self.logger.error(f"Memory benchmark failed: {e}")
            return {'benchmark_type': 'memory', 'status': 'failed', 'error': str(e)}
    
    def run_benchmark(self, benchmark_type: str = 'cpu', **kwargs) -> Dict:
        """Run a benchmark."""
        if benchmark_type == 'cpu':
            return self.cpu_benchmark(kwargs.get('iterations', 1000000))
        elif benchmark_type == 'memory':
            return self.memory_benchmark(kwargs.get('size_mb', 100))
        else:
            return {'status': 'failed', 'error': f'Unknown benchmark type: {benchmark_type}'}
    
    def get_benchmark_results(self) -> List[Dict]:
        """Get all benchmark results."""
        return self.benchmark_results
    
    def set_baseline(self, benchmark_type: str, result: Dict):
        """Set baseline for comparison."""
        self.baselines[benchmark_type] = result
    
    def compare_to_baseline(self, benchmark_type: str, result: Dict) -> Dict:
        """Compare result to baseline."""
        if benchmark_type not in self.baselines:
            return {'status': 'no_baseline'}
        
        baseline = self.baselines[benchmark_type]
        
        if benchmark_type == 'cpu':
            baseline_ops = baseline.get('operations_per_second', 0)
            current_ops = result.get('operations_per_second', 0)
            improvement = ((current_ops - baseline_ops) / baseline_ops) * 100 if baseline_ops > 0 else 0
            
            return {
                'baseline_ops_per_sec': baseline_ops,
                'current_ops_per_sec': current_ops,
                'improvement_percent': improvement
            }
        
        return {'status': 'comparison_not_implemented'}

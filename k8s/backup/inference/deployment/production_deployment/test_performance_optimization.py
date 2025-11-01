import pytest
#!/usr/bin/env python3
"""
Performance Optimization Test Suite - Task 5.5.2.10

Comprehensive testing of export performance optimizations:
- Baseline vs optimized performance comparison
- Memory usage analysis
- Throughput benchmarking
- Scalability testing
- Optimization effectiveness measurement
"""

import time
import psutil
import statistics
from .pathlib import Path
from .typing import Dict, List, Any
from .dataclasses import dataclass

from .dataset_exporter import DatasetExporter, ExportConfiguration
from .conversation_database import ConversationDatabase
from .export_performance_optimizer import ExportPerformanceOptimizer, OptimizationConfig

@dataclass
class BenchmarkResult:
    """Benchmark test result."""
    test_name: str
    conversations_count: int
    export_time: float
    memory_peak_mb: float
    file_size_mb: float
    throughput_records_per_sec: float
    validation_passed: bool
    optimizations_used: List[str]

class PerformanceBenchmark:
    """Performance benchmarking system."""
    
    def __init__(self):
        self.db = ConversationDatabase()
        self.results = []
    
    def run_baseline_test(self, conversation_ids: List[str], format_name: str) -> BenchmarkResult:
        """Run baseline test without optimizations."""
        print(f"🔄 Running baseline test for {format_name} with {len(conversation_ids)} conversations...")
        
        # Configure without optimizations
        config = ExportConfiguration(
            include_metadata=True,
            include_quality_metrics=True,
            include_tags=True,
            validate_output=True,
            optimize_performance=False,
            compress_output=False
        )
        
        exporter = DatasetExporter(self.db, config)
        
        # Monitor memory
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024
        
        start_time = time.time()
        
        result = exporter.export_dataset(
            conversation_ids=conversation_ids,
            format_name=format_name,
            output_dir=Path("/home/vivi/pixelated/ai/production_deployment/exports"),
            filename_prefix=f"baseline_{format_name}"
        )
        
        end_time = time.time()
        final_memory = process.memory_info().rss / 1024 / 1024
        
        return BenchmarkResult(
            test_name=f"baseline_{format_name}",
            conversations_count=len(conversation_ids),
            export_time=end_time - start_time,
            memory_peak_mb=max(initial_memory, final_memory),
            file_size_mb=sum(result.file_sizes_mb.values()),
            throughput_records_per_sec=len(conversation_ids) / (end_time - start_time),
            validation_passed=result.validation_passed,
            optimizations_used=[]
        )
    
    def run_optimized_test(self, conversation_ids: List[str], format_name: str) -> BenchmarkResult:
        """Run optimized test with all optimizations enabled."""
        print(f"⚡ Running optimized test for {format_name} with {len(conversation_ids)} conversations...")
        
        # Configure with all optimizations
        config = ExportConfiguration(
            include_metadata=True,
            include_quality_metrics=True,
            include_tags=True,
            validate_output=True,
            optimize_performance=True,
            compress_output=True
        )
        
        exporter = DatasetExporter(self.db, config)
        
        # Monitor memory
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024
        
        start_time = time.time()
        
        result = exporter.export_dataset(
            conversation_ids=conversation_ids,
            format_name=format_name,
            output_dir=Path("/home/vivi/pixelated/ai/production_deployment/exports"),
            filename_prefix=f"optimized_{format_name}"
        )
        
        end_time = time.time()
        final_memory = process.memory_info().rss / 1024 / 1024
        
        optimizations = getattr(result, 'optimizations_applied', [])
        
        return BenchmarkResult(
            test_name=f"optimized_{format_name}",
            conversations_count=len(conversation_ids),
            export_time=end_time - start_time,
            memory_peak_mb=max(initial_memory, final_memory),
            file_size_mb=sum(result.file_sizes_mb.values()),
            throughput_records_per_sec=len(conversation_ids) / (end_time - start_time),
            validation_passed=result.validation_passed,
            optimizations_used=optimizations
        )
    
    def run_scalability_test(self, format_name: str) -> List[BenchmarkResult]:
        """Run scalability test with different dataset sizes."""
        print(f"📈 Running scalability test for {format_name}...")
        
        # Get conversation IDs for different scales
        with self.db._get_connection() as conn:
            cursor = conn.execute('SELECT conversation_id FROM conversations WHERE dataset_source != "test_dataset" LIMIT 10000')
            all_conversation_ids = [row[0] for row in cursor.fetchall()]
        
        # Test different scales
        scales = [100, 500, 1000, 2000, 5000]
        scalability_results = []
        
        for scale in scales:
            if scale <= len(all_conversation_ids):
                conversation_ids = all_conversation_ids[:scale]
                result = self.run_optimized_test(conversation_ids, format_name)
                scalability_results.append(result)
        
        return scalability_results
    
    def compare_performance(self, baseline: BenchmarkResult, optimized: BenchmarkResult) -> Dict[str, Any]:
        """Compare baseline vs optimized performance."""
        time_improvement = ((baseline.export_time - optimized.export_time) / baseline.export_time) * 100
        throughput_improvement = ((optimized.throughput_records_per_sec - baseline.throughput_records_per_sec) / baseline.throughput_records_per_sec) * 100
        memory_change = ((optimized.memory_peak_mb - baseline.memory_peak_mb) / baseline.memory_peak_mb) * 100
        size_change = ((optimized.file_size_mb - baseline.file_size_mb) / baseline.file_size_mb) * 100
        
        return {
            'time_improvement_percent': time_improvement,
            'throughput_improvement_percent': throughput_improvement,
            'memory_change_percent': memory_change,
            'file_size_change_percent': size_change,
            'baseline_throughput': baseline.throughput_records_per_sec,
            'optimized_throughput': optimized.throughput_records_per_sec,
            'optimizations_applied': optimized.optimizations_used
        }
    
    def generate_benchmark_report(self, results: List[BenchmarkResult]) -> Dict[str, Any]:
        """Generate comprehensive benchmark report."""
        if not results:
            return {'error': 'No benchmark results available'}
        
        # Group results by test type
        baseline_results = [r for r in results if 'baseline' in r.test_name]
        optimized_results = [r for r in results if 'optimized' in r.test_name]
        
        # Calculate aggregate statistics
        avg_baseline_throughput = statistics.mean([r.throughput_records_per_sec for r in baseline_results]) if baseline_results else 0
        avg_optimized_throughput = statistics.mean([r.throughput_records_per_sec for r in optimized_results]) if optimized_results else 0
        
        avg_baseline_memory = statistics.mean([r.memory_peak_mb for r in baseline_results]) if baseline_results else 0
        avg_optimized_memory = statistics.mean([r.memory_peak_mb for r in optimized_results]) if optimized_results else 0
        
        # Performance comparisons
        comparisons = []
        for baseline in baseline_results:
            format_name = baseline.test_name.replace('baseline_', '')
            optimized = next((r for r in optimized_results if f'optimized_{format_name}' == r.test_name), None)
            
            if optimized:
                comparison = self.compare_performance(baseline, optimized)
                comparison['format'] = format_name
                comparisons.append(comparison)
        
        report = {
            'summary': {
                'total_tests': len(results),
                'baseline_tests': len(baseline_results),
                'optimized_tests': len(optimized_results),
                'average_baseline_throughput': avg_baseline_throughput,
                'average_optimized_throughput': avg_optimized_throughput,
                'average_throughput_improvement': ((avg_optimized_throughput - avg_baseline_throughput) / avg_baseline_throughput * 100) if avg_baseline_throughput > 0 else 0,
                'average_baseline_memory': avg_baseline_memory,
                'average_optimized_memory': avg_optimized_memory,
                'average_memory_change': ((avg_optimized_memory - avg_baseline_memory) / avg_baseline_memory * 100) if avg_baseline_memory > 0 else 0
            },
            'format_comparisons': comparisons,
            'detailed_results': [
                {
                    'test_name': r.test_name,
                    'conversations': r.conversations_count,
                    'export_time': r.export_time,
                    'throughput': r.throughput_records_per_sec,
                    'memory_peak_mb': r.memory_peak_mb,
                    'file_size_mb': r.file_size_mb,
                    'validation_passed': r.validation_passed,
                    'optimizations': r.optimizations_used
                }
                for r in results
            ]
        }
        
        return report
    
    def close(self):
        """Close database connection."""
        self.db.close()

def main():
    """Run comprehensive performance benchmark."""
    print("⚡ EXPORT PERFORMANCE OPTIMIZATION BENCHMARK - Task 5.5.2.10")
    print("=" * 70)
    
    benchmark = PerformanceBenchmark()
    
    try:
        # Get test conversation IDs
        with benchmark.db._get_connection() as conn:
            cursor = conn.execute('SELECT conversation_id FROM conversations WHERE dataset_source != "test_dataset" LIMIT 3000')
            conversation_ids = [row[0] for row in cursor.fetchall()]
        
        print(f"✅ Found {len(conversation_ids)} conversations for benchmarking")
        
        # Test different dataset sizes
        test_sizes = [500, 1000, 2000]
        formats_to_test = ['jsonl', 'csv']
        
        all_results = []
        
        for size in test_sizes:
            if size <= len(conversation_ids):
                test_conversations = conversation_ids[:size]
                
                print(f"\n📊 Testing with {size} conversations:")
                print("-" * 50)
                
                for format_name in formats_to_test:
                    # Run baseline test
                    baseline_result = benchmark.run_baseline_test(test_conversations, format_name)
                    all_results.append(baseline_result)
                    
                    # Run optimized test
                    optimized_result = benchmark.run_optimized_test(test_conversations, format_name)
                    all_results.append(optimized_result)
                    
                    # Compare results
                    comparison = benchmark.compare_performance(baseline_result, optimized_result)
                    
                    print(f"\n{format_name.upper()} Results:")
                    print(f"  Baseline:  {baseline_result.throughput_records_per_sec:.1f} records/sec, {baseline_result.memory_peak_mb:.1f}MB memory")
                    print(f"  Optimized: {optimized_result.throughput_records_per_sec:.1f} records/sec, {optimized_result.memory_peak_mb:.1f}MB memory")
                    print(f"  Improvement: {comparison['time_improvement_percent']:.1f}% faster, {comparison['throughput_improvement_percent']:.1f}% higher throughput")
                    print(f"  Memory change: {comparison['memory_change_percent']:.1f}%")
                    print(f"  File size change: {comparison['file_size_change_percent']:.1f}%")
                    if optimized_result.optimizations_used:
                        print(f"  Optimizations: {', '.join(optimized_result.optimizations_used)}")
        
        # Generate final report
        print(f"\n📋 FINAL BENCHMARK REPORT:")
        print("=" * 50)
        
        report = benchmark.generate_benchmark_report(all_results)
        
        print(f"Total tests run: {report['summary']['total_tests']}")
        print(f"Average baseline throughput: {report['summary']['average_baseline_throughput']:.1f} records/sec")
        print(f"Average optimized throughput: {report['summary']['average_optimized_throughput']:.1f} records/sec")
        print(f"Overall throughput improvement: {report['summary']['average_throughput_improvement']:.1f}%")
        print(f"Average memory change: {report['summary']['average_memory_change']:.1f}%")
        
        print(f"\n🎯 OPTIMIZATION EFFECTIVENESS:")
        for comparison in report['format_comparisons']:
            print(f"  {comparison['format']}: {comparison['time_improvement_percent']:.1f}% faster")
        
        print(f"\n✅ Performance optimization benchmark completed successfully!")
        
    finally:
        benchmark.close()

if __name__ == "__main__":
    main()

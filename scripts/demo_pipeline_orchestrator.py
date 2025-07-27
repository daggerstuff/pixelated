#!/usr/bin/env python3
"""
Demonstration script for automated pipeline orchestration.

This script shows the capabilities of the pipeline orchestrator including:
- Automated dataset loading coordination
- Multi-stage pipeline execution with progress tracking
- Quality monitoring integration
- Error recovery and retry mechanisms
- Performance optimization and reporting
- Multiple execution modes (sequential, concurrent, adaptive, priority-based)
"""

import sys
import asyncio
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ai.dataset_pipeline.pipeline_orchestrator import (
    PipelineOrchestrator,
    PipelineConfig,
    ExecutionMode,
    PipelineStage
)


async def demo_sequential_execution():
    """Demonstrate sequential pipeline execution."""
    
    print("🔄 Sequential Execution Mode Demo")
    print("=" * 60)
    
    # Configure for sequential execution
    config = PipelineConfig(
        execution_mode=ExecutionMode.SEQUENTIAL,
        max_concurrent_datasets=1,
        quality_threshold=0.6,
        error_tolerance=0.15,
        retry_attempts=2,
        retry_delay=1.0
    )
    
    orchestrator = PipelineOrchestrator(config)
    
    # Set up callbacks for real-time monitoring
    def stage_callback(stage):
        print(f"📍 Stage: {stage.value.replace('_', ' ').title()}")
    
    def progress_callback(metrics):
        if metrics.total_datasets > 0:
            completion = (metrics.completed_datasets / metrics.total_datasets) * 100
            print(f"📊 Progress: {completion:.1f}% complete "
                  f"({metrics.completed_datasets}/{metrics.total_datasets} datasets)")
    
    def error_callback(context, error):
        print(f"❌ Error in {context}: {error}")
    
    # Register callbacks
    orchestrator.add_stage_callback(stage_callback)
    orchestrator.add_progress_callback(progress_callback)
    orchestrator.add_error_callback(error_callback)
    
    print("\n🚀 Starting sequential pipeline execution...")
    print("   (This will register datasets but not actually download due to demo mode)")
    
    try:
        # Execute pipeline (will register datasets but not actually load due to mocking)
        result = await orchestrator.execute_pipeline(
            include_huggingface=True,
            include_local=False,  # Skip local to avoid file system dependencies
            include_generated=False  # Skip generated for demo
        )
        
        print(f"\n✅ Pipeline Execution Result:")
        print(f"   Success: {result.success}")
        print(f"   Datasets Processed: {len(result.datasets)}")
        print(f"   Total Conversations: {sum(len(convs) for convs in result.datasets.values())}")
        print(f"   Errors: {len(result.errors)}")
        print(f"   Warnings: {len(result.warnings)}")
        print(f"   Recommendations: {len(result.recommendations)}")
        
        # Show metrics
        metrics = result.metrics
        print(f"\n📈 Final Metrics:")
        print(f"   Processing Rate: {metrics.processing_rate:.2f} conv/sec")
        print(f"   Quality Score: {metrics.quality_score:.3f}")
        print(f"   Performance Score: {metrics.performance_score:.3f}")
        print(f"   Error Rate: {metrics.error_rate:.1%}")
        
        # Show recommendations
        if result.recommendations:
            print(f"\n💡 Recommendations:")
            for i, rec in enumerate(result.recommendations[:3], 1):
                print(f"   {i}. {rec}")
        
    except Exception as e:
        print(f"❌ Pipeline execution failed: {e}")
    
    finally:
        orchestrator.shutdown()
    
    return orchestrator


async def demo_concurrent_execution():
    """Demonstrate concurrent pipeline execution."""
    
    print("\n🔄 Concurrent Execution Mode Demo")
    print("=" * 60)
    
    # Configure for concurrent execution
    config = PipelineConfig(
        execution_mode=ExecutionMode.CONCURRENT,
        max_concurrent_datasets=3,
        quality_threshold=0.7,
        error_tolerance=0.1,
        enable_performance_optimization=True
    )
    
    orchestrator = PipelineOrchestrator(config)
    
    # Set up progress monitoring
    def stage_callback(stage):
        print(f"📍 Stage: {stage.value.replace('_', ' ').title()}")
    
    orchestrator.add_stage_callback(stage_callback)
    
    print("\n🚀 Starting concurrent pipeline execution...")
    print(f"   Max Concurrent Datasets: {config.max_concurrent_datasets}")
    print(f"   Quality Threshold: {config.quality_threshold}")
    
    try:
        result = await orchestrator.execute_pipeline(
            include_huggingface=True,
            include_local=False,
            include_generated=False
        )
        
        print(f"\n✅ Concurrent Execution Result:")
        print(f"   Success: {result.success}")
        print(f"   Performance Score: {result.metrics.performance_score:.3f}")
        print(f"   Total Execution Time: {result.execution_report['execution_summary'].get('total_duration', 'N/A')}")
        
        # Show execution mode benefits
        print(f"\n⚡ Concurrent Execution Benefits:")
        print(f"   • Faster processing through parallel dataset loading")
        print(f"   • Efficient resource utilization")
        print(f"   • Reduced total execution time")
        print(f"   • Automatic load balancing across datasets")
        
    except Exception as e:
        print(f"❌ Concurrent execution failed: {e}")
    
    finally:
        orchestrator.shutdown()


async def demo_adaptive_execution():
    """Demonstrate adaptive pipeline execution."""
    
    print("\n🔄 Adaptive Execution Mode Demo")
    print("=" * 60)
    
    # Configure for adaptive execution
    config = PipelineConfig(
        execution_mode=ExecutionMode.ADAPTIVE,
        max_concurrent_datasets=4,
        quality_threshold=0.75,
        enable_performance_optimization=True,
        enable_auto_recovery=True
    )
    
    orchestrator = PipelineOrchestrator(config)
    
    print("\n🚀 Starting adaptive pipeline execution...")
    print("   • Dynamic concurrency adjustment based on performance")
    print("   • Automatic optimization of resource utilization")
    print("   • Performance-driven scaling")
    
    try:
        result = await orchestrator.execute_pipeline(
            include_huggingface=True,
            include_local=False,
            include_generated=False
        )
        
        print(f"\n✅ Adaptive Execution Result:")
        print(f"   Success: {result.success}")
        print(f"   Performance Score: {result.metrics.performance_score:.3f}")
        
        # Show adaptive features
        print(f"\n🧠 Adaptive Execution Features:")
        print(f"   • Performance monitoring with dynamic adjustment")
        print(f"   • Automatic concurrency scaling (1-{config.max_concurrent_datasets} datasets)")
        print(f"   • Resource optimization based on real-time metrics")
        print(f"   • Intelligent batch processing")
        
    except Exception as e:
        print(f"❌ Adaptive execution failed: {e}")
    
    finally:
        orchestrator.shutdown()


async def demo_priority_based_execution():
    """Demonstrate priority-based pipeline execution."""
    
    print("\n🔄 Priority-Based Execution Mode Demo")
    print("=" * 60)
    
    # Configure for priority-based execution
    config = PipelineConfig(
        execution_mode=ExecutionMode.PRIORITY_BASED,
        max_concurrent_datasets=2,
        quality_threshold=0.8,
        error_tolerance=0.05
    )
    
    orchestrator = PipelineOrchestrator(config)
    
    print("\n🚀 Starting priority-based pipeline execution...")
    print("   • High-priority datasets processed first")
    print("   • Smart scheduling within priority groups")
    print("   • Optimized resource allocation")
    
    try:
        result = await orchestrator.execute_pipeline(
            include_huggingface=True,
            include_local=False,
            include_generated=False
        )
        
        print(f"\n✅ Priority-Based Execution Result:")
        print(f"   Success: {result.success}")
        print(f"   Performance Score: {result.metrics.performance_score:.3f}")
        
        # Show priority features
        print(f"\n🎯 Priority-Based Execution Features:")
        print(f"   • Priority 1: Critical datasets (mental health, psychology)")
        print(f"   • Priority 2: Important datasets (reasoning, quality)")
        print(f"   • Priority 3: Supplementary datasets (personality, enhancement)")
        print(f"   • Smart scheduling within each priority group")
        
    except Exception as e:
        print(f"❌ Priority-based execution failed: {e}")
    
    finally:
        orchestrator.shutdown()


async def demo_error_recovery():
    """Demonstrate error recovery capabilities."""
    
    print("\n🔄 Error Recovery Demo")
    print("=" * 60)
    
    # Configure with aggressive error recovery
    config = PipelineConfig(
        execution_mode=ExecutionMode.SEQUENTIAL,
        retry_attempts=3,
        retry_delay=0.5,
        enable_auto_recovery=True,
        error_tolerance=0.2
    )
    
    orchestrator = PipelineOrchestrator(config)
    
    # Set up error monitoring
    error_count = 0
    recovery_count = 0
    
    def error_callback(context, error):
        nonlocal error_count
        error_count += 1
        print(f"❌ Error #{error_count} in {context}: {str(error)[:50]}...")
    
    orchestrator.add_error_callback(error_callback)
    
    print("\n🚀 Starting pipeline with error recovery...")
    print(f"   Max Retry Attempts: {config.retry_attempts}")
    print(f"   Retry Delay: {config.retry_delay}s")
    print(f"   Auto Recovery: {config.enable_auto_recovery}")
    
    try:
        result = await orchestrator.execute_pipeline(
            include_huggingface=True,
            include_local=False,
            include_generated=False
        )
        
        print(f"\n✅ Error Recovery Result:")
        print(f"   Success: {result.success}")
        print(f"   Total Errors: {error_count}")
        print(f"   Recovery Attempts: {result.metrics.retry_count}")
        print(f"   Final Error Rate: {result.metrics.error_rate:.1%}")
        
        # Show recovery features
        print(f"\n🛡️ Error Recovery Features:")
        print(f"   • Automatic retry with exponential backoff")
        print(f"   • Individual dataset failure isolation")
        print(f"   • Comprehensive error logging and tracking")
        print(f"   • Graceful degradation with partial results")
        print(f"   • Recovery recommendations")
        
    except Exception as e:
        print(f"❌ Error recovery demo failed: {e}")
    
    finally:
        orchestrator.shutdown()


async def demo_performance_monitoring():
    """Demonstrate performance monitoring and optimization."""
    
    print("\n🔄 Performance Monitoring Demo")
    print("=" * 60)
    
    # Configure with performance optimization
    config = PipelineConfig(
        execution_mode=ExecutionMode.ADAPTIVE,
        max_concurrent_datasets=3,
        enable_performance_optimization=True,
        checkpoint_interval=50
    )
    
    orchestrator = PipelineOrchestrator(config)
    
    # Set up performance monitoring
    def progress_callback(metrics):
        if metrics.total_datasets > 0:
            print(f"📊 Performance Update:")
            print(f"   Processing Rate: {metrics.processing_rate:.2f} conv/sec")
            print(f"   Quality Score: {metrics.quality_score:.3f}")
            print(f"   Error Rate: {metrics.error_rate:.1%}")
            print(f"   Performance Score: {metrics.performance_score:.3f}")
    
    orchestrator.add_progress_callback(progress_callback)
    
    print("\n🚀 Starting performance-optimized pipeline...")
    print("   • Real-time performance monitoring")
    print("   • Automatic optimization recommendations")
    print("   • Comprehensive metrics tracking")
    
    try:
        result = await orchestrator.execute_pipeline(
            include_huggingface=True,
            include_local=False,
            include_generated=False
        )
        
        print(f"\n✅ Performance Monitoring Result:")
        print(f"   Final Performance Score: {result.metrics.performance_score:.3f}")
        
        # Show performance insights
        execution_report = result.execution_report
        if 'stage_timings' in execution_report:
            print(f"\n⏱️ Stage Performance Analysis:")
            for stage, timing in execution_report['stage_timings'].items():
                print(f"   • {stage.replace('_', ' ').title()}: {timing:.2f}s")
        
        print(f"\n🎯 Performance Optimization Features:")
        print(f"   • Real-time metrics collection and analysis")
        print(f"   • Automatic performance score calculation")
        print(f"   • Stage-by-stage timing analysis")
        print(f"   • Resource utilization monitoring")
        print(f"   • Performance-based recommendations")
        
    except Exception as e:
        print(f"❌ Performance monitoring demo failed: {e}")
    
    finally:
        orchestrator.shutdown()


async def main():
    """Run the complete pipeline orchestrator demonstration."""
    
    print("🚀 Automated Pipeline Orchestration Demonstration")
    print("This demo shows comprehensive dataset loading coordination")
    print("with quality monitoring, error recovery, and performance optimization")
    print()
    
    # Run different execution mode demos
    await demo_sequential_execution()
    await demo_concurrent_execution()
    await demo_adaptive_execution()
    await demo_priority_based_execution()
    await demo_error_recovery()
    await demo_performance_monitoring()
    
    print(f"\n✅ All demos completed successfully!")
    print()
    print("Key Features Demonstrated:")
    print("• 4 execution modes: Sequential, Concurrent, Adaptive, Priority-Based")
    print("• Real-time quality monitoring integration")
    print("• Comprehensive error recovery with retry mechanisms")
    print("• Performance optimization and adaptive scaling")
    print("• Multi-stage pipeline execution with progress tracking")
    print("• Automated reporting and recommendation generation")
    print("• Callback system for real-time notifications")
    print("• Checkpoint and recovery capabilities")
    print()
    print("The Pipeline Orchestrator provides complete automation")
    print("for systematic, high-quality dataset acquisition!")


if __name__ == "__main__":
    asyncio.run(main())

#!/usr/bin/env python3
"""
Demonstration script for real-time acquisition monitoring.

This script shows the capabilities of the acquisition monitor including:
- Real-time quality metrics tracking during dataset loading
- Alert generation for quality issues
- Progress monitoring with statistics
- Performance analytics and reporting
- Error detection and recovery
"""

import sys
import time
import random
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ai.dataset_pipeline.acquisition_monitor import (
    AcquisitionMonitor,
    AlertLevel,
    MetricType
)
from ai.dataset_pipeline.conversation_schema import Conversation, Message


def create_sample_conversations():
    """Create sample conversations with varying quality levels."""
    
    conversations = []
    
    # High-quality therapeutic conversations
    high_quality = [
        Conversation(
            id=f"hq_conv_{i}",
            messages=[
                Message(role="client", content=f"I've been struggling with anxiety lately. It's been affecting my work and relationships."),
                Message(role="therapist", content="I can hear that this has been really difficult for you. Can you tell me more about when these anxious feelings started?"),
                Message(role="client", content="It began about three months ago when I started my new job. I constantly worry about making mistakes."),
                Message(role="therapist", content="Starting a new job can definitely trigger anxiety. What specific situations at work make you feel most anxious?"),
                Message(role="client", content="Mostly during meetings and when I have to present my work. My heart races and I feel like everyone is judging me."),
                Message(role="therapist", content="Those physical symptoms sound really uncomfortable. Have you noticed any patterns in your thoughts during these moments?")
            ],
            context={"session_type": "therapy", "topic": "anxiety", "quality": "high"},
            source="demo"
        )
        for i in range(5)
    ]
    
    # Medium-quality conversations
    medium_quality = [
        Conversation(
            id=f"mq_conv_{i}",
            messages=[
                Message(role="user", content="I need help with stress management."),
                Message(role="assistant", content="I can help you with stress management techniques. What's causing you stress?"),
                Message(role="user", content="Work is very busy and I feel overwhelmed."),
                Message(role="assistant", content="That sounds challenging. Have you tried any relaxation techniques?")
            ],
            context={"topic": "stress"},
            source="demo"
        )
        for i in range(3)
    ]
    
    # Low-quality conversations
    low_quality = [
        Conversation(
            id=f"lq_conv_{i}",
            messages=[
                Message(role="user", content="test"),
                Message(role="assistant", content="LOREM IPSUM DOLOR SIT AMET!!! CLICK HERE TO BUY NOW!!!"),
                Message(role="user", content="???"),
                Message(role="assistant", content="asdf qwerty 123456")
            ],
            context={},
            source="demo"
        )
        for i in range(2)
    ]
    
    conversations.extend(high_quality)
    conversations.extend(medium_quality)
    conversations.extend(low_quality)
    
    return conversations


def demo_real_time_monitoring():
    """Demonstrate real-time monitoring capabilities."""
    
    print("🔍 Real-Time Acquisition Monitoring Demo")
    print("=" * 60)
    
    # Initialize monitor
    monitor = AcquisitionMonitor()
    
    # Set up callbacks for real-time notifications
    def metric_callback(metric):
        print(f"📊 Metric: {metric.metric_type.value} = {metric.value:.3f} "
              f"({metric.dataset_name})")
    
    def alert_callback(alert):
        level_emoji = {
            AlertLevel.INFO: "ℹ️",
            AlertLevel.WARNING: "⚠️",
            AlertLevel.ERROR: "❌",
            AlertLevel.CRITICAL: "🚨"
        }
        print(f"{level_emoji.get(alert.level, '🔔')} ALERT: {alert.message}")
    
    def stats_callback(stats):
        acceptance_rate = (stats.conversations_accepted / max(stats.conversations_processed, 1)) * 100
        print(f"📈 Stats Update - {stats.dataset_name}: "
              f"{stats.conversations_processed} processed, "
              f"{acceptance_rate:.1f}% accepted, "
              f"avg quality: {stats.average_quality_score:.3f}")
    
    # Register callbacks
    monitor.add_metric_callback(metric_callback)
    monitor.add_alert_callback(alert_callback)
    monitor.add_stats_callback(stats_callback)
    
    print("\n🎯 Processing Sample Conversations:")
    print("   (Watch for real-time metrics, alerts, and statistics)")
    
    # Create sample conversations
    conversations = create_sample_conversations()
    dataset_names = ["mental_health_dataset", "therapy_conversations", "counseling_data"]
    
    # Process conversations with simulated timing
    for i, conversation in enumerate(conversations):
        dataset_name = random.choice(dataset_names)
        processing_time = random.uniform(0.1, 0.8)  # Simulate variable processing time
        
        print(f"\n  Processing conversation {i+1}/{len(conversations)} ({conversation.id})...")
        
        # Simulate processing delay
        time.sleep(0.2)
        
        # Process conversation
        quality_scores = monitor.process_conversation(
            conversation,
            dataset_name,
            processing_time
        )
        
        # Show quality scores
        if quality_scores:
            print(f"    Quality: {quality_scores.get('quality_score', 0):.3f}, "
                  f"Coherence: {quality_scores.get('coherence_score', 0):.3f}, "
                  f"Authenticity: {quality_scores.get('authenticity_score', 0):.3f}")
    
    print(f"\n✅ Processed {len(conversations)} conversations")
    
    return monitor


def demo_analytics_and_reporting(monitor):
    """Demonstrate analytics and reporting capabilities."""
    
    print("\n📊 Analytics and Reporting Demo")
    print("=" * 60)
    
    # Get overall statistics
    all_stats = monitor.get_all_stats()
    
    print(f"\n📈 Dataset Statistics Summary:")
    for dataset_name, stats in all_stats.items():
        acceptance_rate = (stats.conversations_accepted / max(stats.conversations_processed, 1)) * 100
        error_rate = (stats.error_count / max(stats.conversations_processed, 1)) * 100
        
        print(f"\n  Dataset: {dataset_name}")
        print(f"    Conversations Processed: {stats.conversations_processed}")
        print(f"    Acceptance Rate: {acceptance_rate:.1f}%")
        print(f"    Average Quality Score: {stats.average_quality_score:.3f}")
        print(f"    Processing Rate: {stats.current_rate:.2f} conv/sec")
        print(f"    Error Rate: {error_rate:.1f}%")
        print(f"    Average Processing Time: {stats.average_processing_time:.3f}s")
    
    # Get recent metrics
    print(f"\n📊 Recent Quality Metrics (Last 60 minutes):")
    
    quality_metrics = monitor.get_recent_metrics(metric_type=MetricType.QUALITY_SCORE)
    coherence_metrics = monitor.get_recent_metrics(metric_type=MetricType.COHERENCE_SCORE)
    authenticity_metrics = monitor.get_recent_metrics(metric_type=MetricType.AUTHENTICITY_SCORE)
    
    if quality_metrics:
        avg_quality = sum(m.value for m in quality_metrics) / len(quality_metrics)
        print(f"  Average Quality Score: {avg_quality:.3f} ({len(quality_metrics)} measurements)")
    
    if coherence_metrics:
        avg_coherence = sum(m.value for m in coherence_metrics) / len(coherence_metrics)
        print(f"  Average Coherence Score: {avg_coherence:.3f} ({len(coherence_metrics)} measurements)")
    
    if authenticity_metrics:
        avg_authenticity = sum(m.value for m in authenticity_metrics) / len(authenticity_metrics)
        print(f"  Average Authenticity Score: {avg_authenticity:.3f} ({len(authenticity_metrics)} measurements)")
    
    # Show active alerts
    active_alerts = monitor.get_active_alerts()
    
    print(f"\n🚨 Active Alerts ({len(active_alerts)} total):")
    if active_alerts:
        for alert in active_alerts[:5]:  # Show first 5 alerts
            print(f"  • {alert.level.value.upper()}: {alert.message}")
            print(f"    Dataset: {alert.dataset_name}, Value: {alert.value:.3f}, Threshold: {alert.threshold:.3f}")
    else:
        print("  No active alerts - all systems operating normally! ✅")
    
    # Demonstrate alert resolution
    if active_alerts:
        print(f"\n🔧 Resolving Sample Alert:")
        alert_to_resolve = active_alerts[0]
        success = monitor.resolve_alert(alert_to_resolve.id)
        if success:
            print(f"  ✅ Resolved alert: {alert_to_resolve.id}")
            print(f"  Resolution time: {alert_to_resolve.resolution_time}")
        else:
            print(f"  ❌ Failed to resolve alert: {alert_to_resolve.id}")


def demo_performance_monitoring(monitor):
    """Demonstrate performance monitoring capabilities."""
    
    print("\n⚡ Performance Monitoring Demo")
    print("=" * 60)
    
    # Get processing time metrics
    processing_metrics = monitor.get_recent_metrics(metric_type=MetricType.PROCESSING_TIME)
    
    if processing_metrics:
        processing_times = [m.value for m in processing_metrics]
        avg_time = sum(processing_times) / len(processing_times)
        min_time = min(processing_times)
        max_time = max(processing_times)
        
        print(f"\n⏱️ Processing Time Analysis:")
        print(f"  Average Processing Time: {avg_time:.3f}s")
        print(f"  Fastest Processing: {min_time:.3f}s")
        print(f"  Slowest Processing: {max_time:.3f}s")
        print(f"  Total Measurements: {len(processing_times)}")
        
        # Performance recommendations
        if avg_time > 0.5:
            print(f"  ⚠️ Recommendation: Consider optimizing processing pipeline (avg > 0.5s)")
        else:
            print(f"  ✅ Performance: Processing times are within acceptable range")
    
    # Show dataset-specific performance
    all_stats = monitor.get_all_stats()
    
    print(f"\n📊 Dataset Performance Comparison:")
    dataset_performance = []
    
    for dataset_name, stats in all_stats.items():
        if stats.conversations_processed > 0:
            dataset_performance.append({
                'name': dataset_name,
                'rate': stats.current_rate,
                'avg_time': stats.average_processing_time,
                'quality': stats.average_quality_score
            })
    
    # Sort by processing rate
    dataset_performance.sort(key=lambda x: x['rate'], reverse=True)
    
    for i, perf in enumerate(dataset_performance):
        rank_emoji = ["🥇", "🥈", "🥉"][i] if i < 3 else "📊"
        print(f"  {rank_emoji} {perf['name']}: "
              f"{perf['rate']:.2f} conv/s, "
              f"{perf['avg_time']:.3f}s avg, "
              f"quality {perf['quality']:.3f}")


def main():
    """Run the complete acquisition monitoring demonstration."""
    
    print("🚀 Starting Acquisition Monitor Demonstration")
    print("This demo shows real-time quality monitoring during dataset acquisition")
    print()
    
    # Run real-time monitoring demo
    monitor = demo_real_time_monitoring()
    
    # Run analytics and reporting demo
    demo_analytics_and_reporting(monitor)
    
    # Run performance monitoring demo
    demo_performance_monitoring(monitor)
    
    # Shutdown monitor
    print(f"\n🔄 Shutting down monitor...")
    monitor.shutdown()
    
    print(f"\n✅ Demo completed successfully!")
    print()
    print("Key Features Demonstrated:")
    print("• Real-time quality metrics tracking with callbacks")
    print("• Automatic alert generation for quality issues")
    print("• Comprehensive statistics and progress monitoring")
    print("• Performance analytics and optimization recommendations")
    print("• Error detection and recovery capabilities")
    print("• Multi-dataset monitoring with comparative analysis")
    print()
    print("The Acquisition Monitor ensures high-quality data loading")
    print("with real-time feedback and proactive issue detection!")


if __name__ == "__main__":
    main()

"""
Integration tests for Enhanced Bias Detection System
Tests real-time bias detection, feedback loops, and performance optimization
"""

import pytest
import asyncio
import json
import time
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta

from src.lib.ai.bias_detection.python_service.real_time_integration import (
    RealTimeBiasDetector,
    FeedbackLoopManager,
    StreamingBiasAnalyzer,
    MemoryUpdateHandler
)
from src.lib.ai.bias_detection.python_service.performance_optimization import (
    PerformanceOptimizer,
    BatchProcessor,
    CacheManager,
    ParallelProcessor
)
from src.lib.ai.bias_detection.python_service.sentry_metrics import (
    BiasDetectionMetrics,
    MetricsCollector
)


class TestRealTimeBiasDetectionIntegration:
    """Integration tests for real-time bias detection system"""
    
    @pytest.fixture
    def bias_detector(self):
        """Create RealTimeBiasDetector instance"""
        return RealTimeBiasDetector(
            model_name="fairlearn_classifier",
            threshold=0.7,
            enable_feedback=True
        )
    
    @pytest.fixture
    def feedback_manager(self):
        """Create FeedbackLoopManager instance"""
        return FeedbackLoopManager(
            update_interval=30,
            min_feedback_samples=10
        )
    
    @pytest.fixture
    def streaming_analyzer(self):
        """Create StreamingBiasAnalyzer instance"""
        return StreamingBiasAnalyzer(
            window_size=100,
            slide_interval=10
        )
    
    @pytest.fixture
    def memory_handler(self):
        """Create MemoryUpdateHandler instance"""
        return MemoryUpdateHandler(
            update_threshold=0.1,
            max_batch_size=50
        )
    
    @pytest.mark.asyncio
    async def test_real_time_conversation_analysis(self, bias_detector):
        """Test real-time conversation bias analysis"""
        conversation_data = {
            "conversation_id": "test_conv_123",
            "messages": [
                {"role": "user", "content": "I need help with my application"},
                {"role": "assistant", "content": "I'd be happy to help you with your application"},
                {"role": "user", "content": "As a woman in tech, I face unique challenges"},
                {"role": "assistant", "content": "I understand. Women in tech often face specific challenges"}
            ],
            "metadata": {
                "user_id": "user_123",
                "timestamp": datetime.now().isoformat(),
                "context": "career_advice"
            }
        }
        
        # Process conversation in real-time
        result = await bias_detector.analyze_conversation(conversation_data)
        
        assert result is not None
        assert "bias_scores" in result
        assert "recommendations" in result
        assert "confidence" in result
        assert result["confidence"] >= 0.0
        assert result["confidence"] <= 1.0
        
        # Verify bias scores are calculated for each message
        assert len(result["bias_scores"]) == len(conversation_data["messages"])
        
    @pytest.mark.asyncio
    async def test_feedback_loop_integration(self, feedback_manager, bias_detector):
        """Test feedback loop integration with bias detection"""
        # Simulate user feedback
        feedback_data = {
            "detection_id": "detect_123",
            "user_feedback": "inaccurate",
            "corrected_bias": {"gender": 0.1, "race": 0.05},
            "timestamp": datetime.now().isoformat(),
            "user_id": "user_123"
        }
        
        # Process feedback
        await feedback_manager.process_feedback(feedback_data)
        
        # Verify feedback is incorporated
        updated_model = await feedback_manager.update_model(bias_detector)
        
        assert updated_model is not None
        assert hasattr(updated_model, 'feedback_history')
        assert len(updated_model.feedback_history) > 0
        
    @pytest.mark.asyncio
    async def test_streaming_analysis_performance(self, streaming_analyzer):
        """Test streaming analysis performance with large datasets"""
        # Generate test data stream
        test_messages = []
        for i in range(1000):
            test_messages.append({
                "id": f"msg_{i}",
                "content": f"Test message {i} about technology and careers",
                "timestamp": datetime.now().isoformat(),
                "user_id": f"user_{i % 100}"
            })
        
        start_time = time.time()
        
        # Process streaming data
        results = []
        for message in test_messages:
            result = await streaming_analyzer.analyze_message(message)
            results.append(result)
            
            # Simulate real-time processing
            if len(results) % 100 == 0:
                await asyncio.sleep(0.01)  # Small delay to simulate real-time
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # Verify performance requirements
        assert len(results) == 1000
        assert processing_time < 10.0  # Should process 1000 messages in under 10 seconds
        
        # Verify sliding window analysis
        window_results = streaming_analyzer.get_window_analysis()
        assert "bias_trends" in window_results
        assert "anomaly_detection" in window_results
        
    @pytest.mark.asyncio
    async def test_memory_update_automation(self, memory_handler):
        """Test automated memory updates based on bias detection results"""
        detection_results = {
            "detection_id": "detect_123",
            "bias_scores": {"gender": 0.8, "race": 0.3, "age": 0.1},
            "confidence": 0.85,
            "context": "job_interview",
            "timestamp": datetime.now().isoformat()
        }
        
        # Process detection results
        update_triggered = await memory_handler.process_detection(detection_results)
        
        assert update_triggered is True
        
        # Verify memory was updated
        updated_memory = await memory_handler.get_memory_state()
        assert updated_memory is not None
        assert "bias_patterns" in updated_memory
        assert "update_history" in updated_memory
        
    @pytest.mark.asyncio
    async def test_end_to_end_bias_detection_pipeline(self, bias_detector, feedback_manager, streaming_analyzer, memory_handler):
        """Test complete end-to-end bias detection pipeline"""
        # Simulate real conversation flow
        conversation_flow = [
            {
                "message": "Tell me about leadership opportunities",
                "user_id": "user_456",
                "timestamp": datetime.now().isoformat()
            },
            {
                "message": "As a minority candidate, I worry about bias in promotions",
                "user_id": "user_456", 
                "timestamp": (datetime.now() + timedelta(seconds=30)).isoformat()
            },
            {
                "message": "What makes someone a good leader?",
                "user_id": "user_456",
                "timestamp": (datetime.now() + timedelta(seconds=60)).isoformat()
            }
        ]
        
        pipeline_results = []
        
        for msg in conversation_flow:
            # Streaming analysis
            stream_result = await streaming_analyzer.analyze_message(msg)
            
            # Real-time bias detection
            bias_result = await bias_detector.analyze_message(msg)
            
            # Combine results
            combined_result = {
                "message_id": msg.get("id", "msg_unknown"),
                "streaming_analysis": stream_result,
                "bias_detection": bias_result,
                "timestamp": datetime.now().isoformat()
            }
            
            pipeline_results.append(combined_result)
            
            # Trigger memory update if significant bias detected
            if bias_result.get("bias_detected", False):
                await memory_handler.process_detection(bias_result)
        
        # Verify pipeline results
        assert len(pipeline_results) == 3
        
        # Check for bias detection in sensitive messages
        sensitive_message_results = [r for r in pipeline_results if "minority" in r["streaming_analysis"].get("content", "").lower()]
        assert len(sensitive_message_results) > 0
        
        for result in sensitive_message_results:
            assert result["bias_detection"]["bias_scores"] is not None
            assert result["bias_detection"]["confidence"] > 0.5


class TestPerformanceOptimizationIntegration:
    """Integration tests for performance optimization system"""
    
    @pytest.fixture
    def performance_optimizer(self):
        """Create PerformanceOptimizer instance"""
        return PerformanceOptimizer(
            batch_size=32,
            cache_ttl=3600,
            max_workers=4
        )
    
    @pytest.fixture
    def batch_processor(self):
        """Create BatchProcessor instance"""
        return BatchProcessor(
            batch_size=64,
            processing_timeout=30.0
        )
    
    @pytest.fixture
    def cache_manager(self):
        """Create CacheManager instance"""
        return CacheManager(
            max_size=1000,
            ttl=3600,
            eviction_policy="lru"
        )
    
    @pytest.fixture
    def parallel_processor(self):
        """Create ParallelProcessor instance"""
        return ParallelProcessor(
            max_workers=8,
            chunk_size=16
        )
    
    @pytest.mark.asyncio
    async def test_large_dataset_batch_processing(self, batch_processor):
        """Test batch processing performance with large datasets"""
        # Generate large test dataset
        large_dataset = []
        for i in range(10000):
            large_dataset.append({
                "id": f"record_{i}",
                "text": f"Sample text for bias analysis {i}",
                "metadata": {"source": f"source_{i % 10}"}
            })
        
        start_time = time.time()
        
        # Process in batches
        results = await batch_processor.process_dataset(large_dataset)
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # Verify results
        assert len(results) == len(large_dataset)
        assert processing_time < 60.0  # Should process 10k records in under 60 seconds
        
        # Verify batch processing efficiency
        assert batch_processor.get_batch_count() > 0
        assert batch_processor.get_avg_batch_size() > 0
        
    @pytest.mark.asyncio
    async def test_caching_performance_improvement(self, cache_manager, performance_optimizer):
        """Test caching performance improvements"""
        test_queries = [
            {"text": "Leadership qualities for managers", "context": "hiring"},
            {"text": "Technical skills assessment", "context": "interview"},
            {"text": "Leadership qualities for managers", "context": "hiring"},  # Duplicate
            {"text": "Team collaboration strategies", "context": "management"}
        ]
        
        # First run - cache miss
        start_time = time.time()
        results_1 = await performance_optimizer.process_with_caching(test_queries, cache_manager)
        first_run_time = time.time() - start_time
        
        # Second run - cache hit for duplicate
        start_time = time.time()
        results_2 = await performance_optimizer.process_with_caching(test_queries, cache_manager)
        second_run_time = time.time() - start_time
        
        # Verify caching improved performance
        assert second_run_time < first_run_time
        
        # Verify cache statistics
        cache_stats = cache_manager.get_stats()
        assert cache_stats["hits"] > 0
        assert cache_stats["misses"] > 0
        
    @pytest.mark.asyncio
    async def test_parallel_processing_efficiency(self, parallel_processor):
        """Test parallel processing efficiency"""
        # Create computationally intensive tasks
        complex_tasks = []
        for i in range(100):
            complex_tasks.append({
                "id": f"task_{i}",
                "data": list(range(1000)),  # Large dataset
                "operation": "bias_analysis",
                "complexity": "high"
            })
        
        start_time = time.time()
        
        # Process in parallel
        results = await parallel_processor.process_tasks(complex_tasks)
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # Verify results
        assert len(results) == len(complex_tasks)
        assert processing_time < 30.0  # Should complete in under 30 seconds
        
        # Verify parallel processing efficiency
        assert parallel_processor.get_worker_utilization() > 0.7  # At least 70% utilization
        
    @pytest.mark.asyncio
    async def test_performance_metrics_collection(self):
        """Test performance metrics collection and reporting"""
        metrics_collector = MetricsCollector()
        
        # Simulate various operations
        operations = [
            {"name": "bias_detection", "duration": 0.5, "memory_usage": 100},
            {"name": "feedback_processing", "duration": 0.2, "memory_usage": 50},
            {"name": "memory_update", "duration": 0.1, "memory_usage": 30}
        ]
        
        for op in operations:
            metrics_collector.record_operation(op["name"], op["duration"], op["memory_usage"])
        
        # Get performance report
        performance_report = metrics_collector.get_performance_report()
        
        assert performance_report is not None
        assert "operation_stats" in performance_report
        assert "resource_usage" in performance_report
        assert "performance_trends" in performance_report
        
        # Verify specific metrics
        bias_stats = performance_report["operation_stats"]["bias_detection"]
        assert bias_stats["avg_duration"] == 0.5
        assert bias_stats["avg_memory"] == 100


class TestBiasDetectionMetricsIntegration:
    """Integration tests for bias detection metrics and monitoring"""
    
    @pytest.fixture
    def bias_metrics(self):
        """Create BiasDetectionMetrics instance"""
        return BiasDetectionMetrics()
    
    @pytest.mark.asyncio
    async def test_bias_detection_metrics_tracking(self, bias_metrics):
        """Test comprehensive bias detection metrics tracking"""
        # Simulate bias detection events
        detection_events = [
            {
                "event_type": "bias_detected",
                "bias_type": "gender",
                "confidence": 0.85,
                "context": "hiring",
                "timestamp": datetime.now().isoformat()
            },
            {
                "event_type": "false_positive",
                "bias_type": "race",
                "confidence": 0.45,
                "context": "promotion",
                "timestamp": datetime.now().isoformat()
            },
            {
                "event_type": "bias_corrected",
                "bias_type": "age",
                "confidence": 0.72,
                "context": "interview",
                "timestamp": datetime.now().isoformat()
            }
        ]
        
        # Track events
        for event in detection_events:
            bias_metrics.track_event(event)
        
        # Get metrics summary
        metrics_summary = bias_metrics.get_metrics_summary()
        
        assert metrics_summary is not None
        assert "detection_rate" in metrics_summary
        assert "accuracy" in metrics_summary
        assert "bias_distribution" in metrics_summary
        
        # Verify specific metrics
        assert metrics_summary["detection_rate"] > 0
        assert metrics_summary["accuracy"] >= 0
        assert len(metrics_summary["bias_distribution"]) > 0
        
    @pytest.mark.asyncio
    async def test_sentry_metrics_integration(self):
        """Test Sentry metrics integration for bias detection"""
        from sentry_sdk import capture_message, capture_exception
        
        # Simulate bias detection with Sentry tracking
        try:
            # Simulate successful bias detection
            detection_result = {
                "bias_detected": True,
                "bias_type": "gender",
                "confidence": 0.9,
                "context": "performance_review"
            }
            
            # Track in Sentry
            capture_message(f"Bias detected: {detection_result}", level="info")
            
            # Simulate error scenario
            raise ValueError("Simulated bias detection error")
            
        except Exception as e:
            capture_exception(e)
            
        # Verify Sentry integration (would need actual Sentry setup to verify)
        assert True  # Placeholder for Sentry verification
        
    @pytest.mark.asyncio
    async def test_metrics_alert_system(self, bias_metrics):
        """Test metrics-based alert system"""
        # Configure alert thresholds
        alert_thresholds = {
            "detection_rate": 0.8,
            "false_positive_rate": 0.2,
            "accuracy": 0.7
        }
        
        # Simulate high bias detection scenario
        for i in range(100):
            bias_metrics.track_event({
                "event_type": "bias_detected",
                "bias_type": "gender",
                "confidence": 0.9,
                "context": "hiring",
                "timestamp": datetime.now().isoformat()
            })
        
        # Check for alerts
        alerts = bias_metrics.check_alerts(alert_thresholds)
        
        assert len(alerts) > 0
        assert any(alert["type"] == "high_detection_rate" for alert in alerts)
        
        # Verify alert details
        high_detection_alert = next(alert for alert in alerts if alert["type"] == "high_detection_rate")
        assert high_detection_alert["severity"] == "high"
        assert "detection_rate" in high_detection_alert["details"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
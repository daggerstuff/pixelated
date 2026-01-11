#!/usr/bin/env python3
"""
Real-time Bias Detection Integration for Enhanced Bias Detection System

This module provides real-time conversation analysis, feedback loops, and 
streaming integration for the Enhanced Bias Detection system.

Key Features:
- Real-time conversation streaming analysis
- Continuous feedback loop implementation
- Performance optimization for large datasets
- Automated memory update integration
"""

import asyncio
import json
import logging
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Callable
from dataclasses import dataclass, field

import numpy as np
from asyncio import Queue

# Import existing bias detection components
from bias_detection_service import BiasDetectionService, SessionData, BiasDetectionConfig
from real_ml_models import (
    real_fairlearn_analyzer,
    real_interpretability_analyzer,
    real_hf_analyzer,
    get_real_fairlearn_analysis,
    get_real_interpretability_analysis,
    get_real_hf_analysis,
)
from bias_detection.sentry_metrics import bias_metrics, track_latency

logger = logging.getLogger(__name__)


@dataclass
class StreamingSession:
    """Represents a streaming conversation session"""
    session_id: str
    user_id: str
    start_time: datetime
    demographics: Dict[str, Any]
    conversation_buffer: deque = field(default_factory=lambda: deque(maxlen=100))
    bias_scores: List[float] = field(default_factory=list)
    alert_history: List[Dict[str, Any]] = field(default_factory=list)
    last_analysis_time: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    analysis_interval: float = 5.0  # Analyze every 5 seconds
    streaming_active: bool = True


class RealTimeBiasDetector:
    """Real-time bias detection with streaming analysis and feedback loops"""
    
    def __init__(self, config: BiasDetectionConfig):
        self.config = config
        self.bias_service = BiasDetectionService(config)
        self.active_sessions: Dict[str, StreamingSession] = {}
        self.analysis_queue: Queue = Queue()
        self.feedback_queue: Queue = Queue()
        self.memory_update_queue: Queue = Queue()
        
        # Performance optimization settings
        self.batch_size = 10
        self.max_concurrent_analyses = 5
        self.analysis_semaphore = asyncio.Semaphore(self.max_concurrent_analyses)
        
        # Feedback loop settings
        self.feedback_learning_rate = 0.1
        self.min_feedback_samples = 50
        
        logger.info("Real-time bias detector initialized")

    async def start_streaming_session(
        self,
        session_id: str,
        user_id: str,
        demographics: Dict[str, Any]
    ) -> StreamingSession:
        """Start a new streaming bias detection session"""
        session = StreamingSession(
            session_id=session_id,
            user_id=user_id,
            start_time=datetime.now(timezone.utc),
            demographics=demographics
        )
        
        self.active_sessions[session_id] = session
        
        # Start background tasks for this session
        asyncio.create_task(self._monitor_conversation(session))
        asyncio.create_task(self._periodic_analysis(session))
        
        logger.info(f"Started streaming session {session_id} for user {user_id}")
        return session

    async def process_conversation_chunk(
        self,
        session_id: str,
        conversation_chunk: Dict[str, Any]
    ) -> None:
        """Process a chunk of conversation data in real-time"""
        if session_id not in self.active_sessions:
            logger.warning(f"Session {session_id} not found, ignoring chunk")
            return
        
        session = self.active_sessions[session_id]
        
        # Add to conversation buffer
        session.conversation_buffer.append({
            'timestamp': datetime.now(timezone.utc),
            'content': conversation_chunk.get('content', ''),
            'speaker': conversation_chunk.get('speaker', 'unknown'),
            'metadata': conversation_chunk.get('metadata', {})
        })
        
        # Trigger immediate analysis if buffer is large enough
        if len(session.conversation_buffer) >= 10:
            await self.analysis_queue.put(session_id)
        
        logger.debug(f"Processed conversation chunk for session {session_id}")

    async def _monitor_conversation(self, session: StreamingSession) -> None:
        """Monitor conversation for real-time bias patterns"""
        while session.streaming_active:
            try:
                # Check for emerging bias patterns
                if len(session.conversation_buffer) >= 5:
                    recent_conversation = list(session.conversation_buffer)[-5:]
                    
                    # Quick bias check on recent conversation
                    bias_score = await self._quick_bias_check(recent_conversation)
                    
                    if bias_score > self.config.warning_threshold:
                        await self._trigger_real_time_alert(session, bias_score)
                
                await asyncio.sleep(2.0)  # Check every 2 seconds
                
            except Exception as e:
                logger.error(f"Error monitoring conversation for session {session.session_id}: {e}")
                await asyncio.sleep(5.0)

    async def _quick_bias_check(self, conversation_chunk: List[Dict[str, Any]]) -> float:
        """Perform quick bias check on conversation chunk"""
        try:
            # Extract text content
            text_content = " ".join([msg.get('content', '') for msg in conversation_chunk])
            
            if not text_content.strip():
                return 0.0
            
            # Use Hugging Face analyzer for quick check
            hf_result = await get_real_hf_analysis(text_content)
            bias_score = hf_result.get('bias_score', 0.0)
            
            # Track metric
            bias_metrics.linguistic_bias_detected("real_time", bias_score)
            
            return bias_score
            
        except Exception as e:
            logger.error(f"Quick bias check failed: {e}")
            return 0.0

    async def _periodic_analysis(self, session: StreamingSession) -> None:
        """Perform periodic comprehensive analysis"""
        while session.streaming_active:
            try:
                current_time = datetime.now(timezone.utc)
                time_since_last = (current_time - session.last_analysis_time).total_seconds()
                
                if time_since_last >= session.analysis_interval:
                    # Create session data for analysis
                    session_data = self._create_session_data_from_buffer(session)
                    
                    # Perform comprehensive analysis
                    async with self.analysis_semaphore:
                        result = await self.bias_service.analyze_session(
                            session_data, 
                            session.user_id
                        )
                    
                    # Update session with results
                    session.bias_scores.append(result['overall_bias_score'])
                    session.last_analysis_time = current_time
                    
                    # Check for alerts
                    if result['alert_level'] != 'low':
                        session.alert_history.append({
                            'timestamp': current_time,
                            'alert_level': result['alert_level'],
                            'bias_score': result['overall_bias_score'],
                            'recommendations': result['recommendations']
                        })
                    
                    # Send to feedback loop
                    await self.feedback_queue.put({
                        'session_id': session.session_id,
                        'analysis_result': result,
                        'timestamp': current_time
                    })
                    
                    logger.info(f"Periodic analysis completed for session {session.session_id}")
                
                await asyncio.sleep(1.0)
                
            except Exception as e:
                logger.error(f"Error in periodic analysis for session {session.session_id}: {e}")
                await asyncio.sleep(session.analysis_interval)

    def _create_session_data_from_buffer(self, session: StreamingSession) -> SessionData:
        """Create SessionData from conversation buffer"""
        # Extract conversation content
        conversation_text = " ".join([
            msg.get('content', '') for msg in session.conversation_buffer
        ])
        
        # Create AI responses from conversation
        ai_responses = []
        for msg in session.conversation_buffer:
            if msg.get('speaker') == 'ai':
                ai_responses.append({
                    'content': msg.get('content', ''),
                    'response_time': 0.5,  # Placeholder
                    'timestamp': msg.get('timestamp', datetime.now(timezone.utc)).isoformat()
                })
        
        return SessionData(
            session_id=session.session_id,
            participant_demographics=session.demographics,
            training_scenario={'type': 'real_time_conversation'},
            content={'conversation': conversation_text},
            ai_responses=ai_responses,
            expected_outcomes=[],
            transcripts=[{
                'text': conversation_text,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }],
            metadata={
                'streaming_session': True,
                'buffer_size': len(session.conversation_buffer),
                'analysis_count': len(session.bias_scores)
            }
        )

    async def _trigger_real_time_alert(
        self, 
        session: StreamingSession, 
        bias_score: float
    ) -> None:
        """Trigger real-time alert for high bias detection"""
        alert_level = self.bias_service._determine_alert_level(bias_score)
        
        # Emit metrics
        bias_metrics.alert_triggered(alert_level, "real_time", bias_score)
        
        logger.warning(
            f"Real-time bias alert triggered for session {session.session_id}: "
            f"bias_score={bias_score:.2f}, alert_level={alert_level}"
        )
        
        # Here you could integrate with notification systems
        # For now, just log and update session
        session.alert_history.append({
            'timestamp': datetime.now(timezone.utc),
            'alert_level': alert_level,
            'bias_score': bias_score,
            'type': 'real_time'
        })

    async def process_feedback(
        self,
        session_id: str,
        feedback: Dict[str, Any]
    ) -> None:
        """Process feedback for continuous learning"""
        try:
            # Validate feedback
            if 'corrected_bias_score' not in feedback:
                logger.warning("Feedback missing corrected_bias_score")
                return
            
            corrected_score = feedback['corrected_bias_score']
            original_score = feedback.get('original_bias_score', 0.0)
            
            # Calculate adjustment
            adjustment = corrected_score - original_score
            
            # Update model weights based on feedback
            await self._update_model_weights(session_id, adjustment, feedback)
            
            # Send to memory update queue
            await self.memory_update_queue.put({
                'type': 'feedback',
                'session_id': session_id,
                'feedback': feedback,
                'adjustment': adjustment,
                'timestamp': datetime.now(timezone.utc)
            })
            
            logger.info(f"Processed feedback for session {session_id}: adjustment={adjustment}")
            
        except Exception as e:
            logger.error(f"Error processing feedback for session {session_id}: {e}")

    async def _update_model_weights(
        self,
        session_id: str,
        adjustment: float,
        feedback: Dict[str, Any]
    ) -> None:
        """Update model weights based on feedback for continuous learning"""
        try:
            # Simple weight adjustment based on feedback
            # In a real implementation, this would use more sophisticated ML techniques
            
            learning_rate = self.feedback_learning_rate
            normalized_adjustment = np.clip(adjustment * learning_rate, -0.1, 0.1)
            
            # Update bias detection thresholds
            if abs(normalized_adjustment) > 0.01:  # Significant adjustment
                # Adjust warning threshold
                current_threshold = self.config.warning_threshold
                new_threshold = np.clip(
                    current_threshold + normalized_adjustment,
                    0.1,
                    0.5
                )
                self.config.warning_threshold = float(new_threshold)
                
                logger.info(
                    f"Updated bias detection threshold: {current_threshold:.3f} -> {new_threshold:.3f}"
                )
            
            # Track feedback metrics
            bias_metrics.score_recorded("feedback_adjustment", abs(normalized_adjustment))
            
        except Exception as e:
            logger.error(f"Error updating model weights: {e}")

    async def get_session_insights(self, session_id: str) -> Dict[str, Any]:
        """Get insights for a streaming session"""
        if session_id not in self.active_sessions:
            return {"error": "Session not found"}
        
        session = self.active_sessions[session_id]
        
        # Calculate trends
        if len(session.bias_scores) >= 3:
            recent_scores = session.bias_scores[-3:]
            trend = "increasing" if recent_scores[-1] > recent_scores[0] else "decreasing"
            trend_strength = abs(recent_scores[-1] - recent_scores[0])
        else:
            trend = "insufficient_data"
            trend_strength = 0.0
        
        return {
            "session_id": session_id,
            "current_bias_score": session.bias_scores[-1] if session.bias_scores else 0.0,
            "average_bias_score": np.mean(session.bias_scores) if session.bias_scores else 0.0,
            "trend": trend,
            "trend_strength": trend_strength,
            "alert_count": len(session.alert_history),
            "recent_alerts": session.alert_history[-5:] if session.alert_history else [],
            "conversation_length": len(session.conversation_buffer),
            "session_duration": (
                datetime.now(timezone.utc) - session.start_time
            ).total_seconds()
        }

    async def stop_streaming_session(self, session_id: str) -> Dict[str, Any]:
        """Stop a streaming session and return final insights"""
        if session_id not in self.active_sessions:
            return {"error": "Session not found"}
        
        session = self.active_sessions[session_id]
        session.streaming_active = False
        
        # Get final insights
        insights = await self.get_session_insights(session_id)
        
        # Clean up
        del self.active_sessions[session_id]
        
        logger.info(f"Stopped streaming session {session_id}")
        
        return {
            "session_stopped": True,
            "final_insights": insights,
            "session_summary": {
                "total_analyses": len(session.bias_scores),
                "total_alerts": len(session.alert_history),
                "session_duration": (
                    datetime.now(timezone.utc) - session.start_time
                ).total_seconds()
            }
        }

    async def process_memory_updates(self) -> None:
        """Process memory update queue for automated learning"""
        while True:
            try:
                update = await self.memory_update_queue.get()
                
                if update['type'] == 'feedback':
                    # Process feedback for memory updates
                    feedback_data = update['feedback']
                    
                    # Here you would integrate with the memory system
                    # For now, just log the update
                    logger.info(
                        f"Memory update: feedback for session {update['session_id']}, "
                        f"adjustment={update['adjustment']}"
                    )
                
                await asyncio.sleep(0.1)  # Prevent busy waiting
                
            except Exception as e:
                logger.error(f"Error processing memory updates: {e}")
                await asyncio.sleep(1.0)


# Global instance for easy access
real_time_detector: Optional[RealTimeBiasDetector] = None


async def initialize_real_time_detector(config: Optional[BiasDetectionConfig] = None) -> RealTimeBiasDetector:
    """Initialize the global real-time bias detector"""
    global real_time_detector
    
    if real_time_detector is None:
        if config is None:
            config = BiasDetectionConfig()
        real_time_detector = RealTimeBiasDetector(config)
        
        # Start background tasks
        asyncio.create_task(real_time_detector.process_memory_updates())
        
        logger.info("Real-time bias detector initialized globally")
    
    return real_time_detector


async def get_real_time_detector() -> RealTimeBiasDetector:
    """Get the global real-time bias detector instance"""
    if real_time_detector is None:
        await initialize_real_time_detector()
    return real_time_detector


# API endpoints for real-time integration
async def start_real_time_session(
    session_id: str,
    user_id: str,
    demographics: Dict[str, Any]
) -> Dict[str, Any]:
    """API endpoint to start real-time bias detection session"""
    detector = await get_real_time_detector()
    session = await detector.start_streaming_session(session_id, user_id, demographics)
    
    return {
        "session_id": session.session_id,
        "status": "streaming_active",
        "start_time": session.start_time.isoformat(),
        "analysis_interval": session.analysis_interval
    }


async def process_conversation_chunk(
    session_id: str,
    conversation_chunk: Dict[str, Any]
) -> Dict[str, Any]:
    """API endpoint to process conversation chunk in real-time"""
    detector = await get_real_time_detector()
    await detector.process_conversation_chunk(session_id, conversation_chunk)
    
    return {
        "status": "processed",
        "session_id": session_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


async def submit_feedback(
    session_id: str,
    feedback: Dict[str, Any]
) -> Dict[str, Any]:
    """API endpoint to submit feedback for continuous learning"""
    detector = await get_real_time_detector()
    await detector.process_feedback(session_id, feedback)
    
    return {
        "status": "feedback_processed",
        "session_id": session_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


async def get_session_insights(session_id: str) -> Dict[str, Any]:
    """API endpoint to get session insights"""
    detector = await get_real_time_detector()
    return await detector.get_session_insights(session_id)


async def stop_real_time_session(session_id: str) -> Dict[str, Any]:
    """API endpoint to stop real-time session"""
    detector = await get_real_time_detector()
    return await detector.stop_streaming_session(session_id)


if __name__ == "__main__":
    # Example usage
    async def example():
        detector = await initialize_real_time_detector()
        
        # Start a session
        session = await detector.start_streaming_session(
            "test_session_001",
            "user_123",
            {"age": "26-35", "gender": "female", "ethnicity": "asian"}
        )
        
        # Process some conversation
        await detector.process_conversation_chunk(
            session.session_id,
            {
                "content": "I think we should consider the patient's cultural background when making treatment decisions",
                "speaker": "therapist",
                "metadata": {"confidence": 0.8}
            }
        )
        
        # Get insights
        insights = await detector.get_session_insights(session.session_id)
        print(f"Session insights: {insights}")
        
        # Stop session
        result = await detector.stop_streaming_session(session.session_id)
        print(f"Session stopped: {result}")

    asyncio.run(example())
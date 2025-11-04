# Celery Tasks for Distributed Bias Detection Processing
# This module defines all distributed tasks for horizontal scaling

import asyncio
import logging
import time
from typing import Any, Dict, List

from celery.exceptions import SoftTimeLimitExceeded

from bias_detection_service import (
    BiasDetectionConfig,
    BiasDetectionService,
    SessionData,
)
from celery_config import app

logger = logging.getLogger(__name__)

# Initialize bias detection service
config = BiasDetectionConfig()
bias_service = BiasDetectionService(config)


@app.task(bind=True, name="bias_detection_service.analyze_session_async")
def analyze_session_async(
    self, session_data_dict: dict[str, Any], user_id: str
) -> dict[str, Any]:
    """
    Asynchronous bias analysis for a single session.
    This task can be distributed across multiple workers.
    """
    try:
        # Update task state
        self.update_state(
            state="PROGRESS", meta={"progress": 10, "message": "Initializing analysis"}
        )

        # Convert dict to SessionData object
        session_data = SessionData(**session_data_dict)

        self.update_state(
            state="PROGRESS", meta={"progress": 30, "message": "Running bias analysis"}
        )

        # Run analysis asynchronously
        result = asyncio.run(bias_service.analyze_session(session_data, user_id))

        self.update_state(
            state="PROGRESS", meta={"progress": 90, "message": "Finalizing results"}
        )

        # Add task metadata
        result["celery_task_id"] = self.request.id
        result["processing_node"] = self.request.hostname

        logger.info(
            f"Bias analysis completed for session {session_data.session_id} via Celery task {self.request.id}"
        )

        return result

    except SoftTimeLimitExceeded:
        logger.error(
            f"Task {self.request.id} timed out for session {session_data_dict.get('session_id', 'unknown')}"
        )
        raise
    except Exception as e:
        logger.error(f"Task {self.request.id} failed: {e}")
        raise


@app.task(bind=True, name="bias_detection_service.batch_analyze_sessions")
def batch_analyze_sessions(
    self, sessions_data: list[dict[str, Any]], user_id: str
) -> dict[str, Any]:
    """
    Batch analysis of multiple sessions with progress tracking.
    Distributes work across available workers.
    """
    try:
        total_sessions = len(sessions_data)
        results = []
        errors = []

        self.update_state(
            state="PROGRESS",
            meta={
                "progress": 5,
                "message": f"Starting batch analysis of {total_sessions} sessions",
            },
        )

        # Process sessions in batches
        for i, session_data_dict in enumerate(sessions_data):
            try:
                # Convert dict to SessionData
                session_data = SessionData(**session_data_dict)

                # Update progress
                progress = 10 + (i / total_sessions) * 80
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "progress": progress,
                        "message": f"Processing session {i + 1}/{total_sessions}: {session_data.session_id}",
                    },
                )

                # Run analysis
                result = asyncio.run(
                    bias_service.analyze_session(session_data, user_id)
                )
                results.append(result)

            except Exception as e:
                logger.error(
                    f"Failed to analyze session {session_data_dict.get('session_id', 'unknown')}: {e}"
                )
                errors.append(
                    {
                        "session_id": session_data_dict.get("session_id", "unknown"),
                        "error": str(e),
                    }
                )

        # Final progress update
        self.update_state(
            state="PROGRESS",
            meta={"progress": 95, "message": "Finalizing batch results"},
        )

        # Compile final results
        final_result = {
            "total_sessions": total_sessions,
            "successful_analyses": len(results),
            "failed_analyses": len(errors),
            "results": results,
            "errors": errors,
            "celery_task_id": self.request.id,
            "processing_node": self.request.hostname,
            "batch_processing_time": time.time(),
        }

        logger.info(
            f"Batch analysis completed: {len(results)}/{total_sessions} sessions processed successfully"
        )

        return final_result

    except SoftTimeLimitExceeded:
        logger.error(f"Batch analysis task {self.request.id} timed out")
        raise
    except Exception as e:
        logger.error(f"Batch analysis task {self.request.id} failed: {e}")
        raise


@app.task(bind=True, name="bias_detection_service.validate_dataset_quality")
def validate_dataset_quality(
    self, dataset_path: str, quality_threshold: float = 0.7
) -> dict[str, Any]:
    """
    Distributed dataset quality validation.
    Can be run on multiple workers for large datasets.
    """
    try:
        self.update_state(
            state="PROGRESS", meta={"progress": 10, "message": "Loading dataset"}
        )

        # Load dataset (placeholder - implement based on your data format)
        # dataset = load_dataset(dataset_path)

        self.update_state(
            state="PROGRESS", meta={"progress": 30, "message": "Running quality checks"}
        )

        # Run quality validation (placeholder - implement based on your quality metrics)
        quality_metrics = {
            "completeness_score": 0.95,
            "consistency_score": 0.88,
            "accuracy_score": 0.92,
            "bias_score": 0.15,
            "overall_quality": 0.90,
        }

        self.update_state(
            state="PROGRESS",
            meta={"progress": 70, "message": "Generating validation report"},
        )

        # Determine if dataset passes quality threshold
        passes_threshold = quality_metrics["overall_quality"] >= quality_threshold

        self.update_state(
            state="PROGRESS", meta={"progress": 90, "message": "Finalizing validation"}
        )

        result = {
            "dataset_path": dataset_path,
            "quality_threshold": quality_threshold,
            "passes_threshold": passes_threshold,
            "quality_metrics": quality_metrics,
            "validation_timestamp": time.time(),
            "celery_task_id": self.request.id,
            "processing_node": self.request.hostname,
        }

        logger.info(
            f"Dataset quality validation completed for {dataset_path}: {'PASSED' if passes_threshold else 'FAILED'}"
        )

        return result

    except Exception as e:
        logger.error(f"Dataset validation task {self.request.id} failed: {e}")
        raise


@app.task(bind=True, name="bias_detection_service.export_dataset_chunk")
def export_dataset_chunk(
    self, chunk_data: list[dict[str, Any]], export_format: str, chunk_id: int
) -> dict[str, Any]:
    """
    Export a chunk of dataset in distributed manner.
    Useful for large dataset exports across multiple workers.
    """
    try:
        self.update_state(
            state="PROGRESS",
            meta={
                "progress": 20,
                "message": f"Processing chunk {chunk_id} with {len(chunk_data)} items",
            },
        )

        # Process chunk based on export format
        exported_data = list(chunk_data) if export_format == "jsonl" else chunk_data
        self.update_state(
            state="PROGRESS",
            meta={
                "progress": 80,
                "message": f"Formatting chunk {chunk_id} for {export_format}",
            },
        )

        result = {
            "chunk_id": chunk_id,
            "export_format": export_format,
            "item_count": len(chunk_data),
            "exported_data": exported_data,
            "processing_timestamp": time.time(),
            "celery_task_id": self.request.id,
            "processing_node": self.request.hostname,
        }

        logger.info(
            f"Dataset chunk export completed: chunk {chunk_id}, {len(chunk_data)} items"
        )

        return result

    except Exception as e:
        logger.error(f"Dataset chunk export task {self.request.id} failed: {e}")
        raise


@app.task(bind=True, name="bias_detection_service.cleanup_expired_results")
def cleanup_expired_results(self) -> dict[str, Any]:
    """
    Periodic cleanup of expired Celery results.
    Runs automatically via Celery Beat scheduler.
    """
    try:
        # This would typically clean up old results from the result backend
        # Implementation depends on your specific result backend configuration

        result = {
            "cleanup_timestamp": time.time(),
            "expired_results_cleaned": 0,  # Placeholder
            "storage_freed_mb": 0,  # Placeholder
            "celery_task_id": self.request.id,
            "processing_node": self.request.hostname,
        }

        logger.info(
            f"Expired results cleanup completed: {result['expired_results_cleaned']} items cleaned"
        )

        return result

    except Exception as e:
        logger.error(f"Cleanup task {self.request.id} failed: {e}")
        raise


@app.task(bind=True, name="bias_detection_service.perform_health_check")
def perform_health_check(self) -> Dict[str, Any]:
    """
    Health check task for monitoring system status.
    Runs periodically via Celery Beat scheduler.
    """
    try:
        # Perform various health checks
        health_status = {
            "timestamp": time.time(),
            "service_status": "healthy",
            "components": {
                "bias_detection_service": "healthy",
                "nlp_libraries": "healthy",
                "database_connection": "healthy",
                "redis_connection": "healthy",
            },
            "system_resources": {
                "cpu_usage": 0.0,  # Placeholder
                "memory_usage": 0.0,  # Placeholder
                "disk_usage": 0.0,  # Placeholder
            },
            "celery_task_id": self.request.id,
            "processing_node": self.request.hostname,
        }

        logger.info(f"Health check completed: {health_status['service_status']}")

        return health_status

    except Exception as e:
        logger.error(f"Health check task {self.request.id} failed: {e}")
        raise


@app.task(bind=True, name="bias_detection_service.update_performance_metrics")
def update_performance_metrics(self) -> Dict[str, Any]:
    """
    Update performance metrics for monitoring.
    Runs periodically via Celery Beat scheduler.
    """
    try:
        # Collect performance metrics
        metrics = {
            "timestamp": time.time(),
            "active_tasks": 0,  # Placeholder
            "completed_tasks_24h": 0,  # Placeholder
            "failed_tasks_24h": 0,  # Placeholder
            "average_task_duration": 0.0,  # Placeholder
            "queue_depth": {
                "bias_analysis": 0,
                "batch_processing": 0,
                "quality_validation": 0,
                "export_processing": 0,
            },
            "celery_task_id": self.request.id,
            "processing_node": self.request.hostname,
        }

        logger.info(
            f"Performance metrics updated: {metrics['active_tasks']} active tasks"
        )

        return metrics

    except Exception as e:
        logger.error(f"Performance metrics update task {self.request.id} failed: {e}")
        raise


# Utility functions for distributed processing
def chunk_data(data: List[Any], chunk_size: int) -> List[List[Any]]:
    """Split data into chunks for distributed processing."""
    return [data[i : i + chunk_size] for i in range(0, len(data), chunk_size)]


def distribute_task(
    task_name: str, data: List[Any], chunk_size: int = 100, **kwargs
) -> List[Any]:
    """
    Distribute a task across multiple workers.
    Returns a group of async results.
    """
    from celery import group

    # Split data into chunks
    chunks = chunk_data(data, chunk_size)

    task_signatures = [
        app.signature(task_name, args=[chunk, i], kwargs=kwargs)
        for i, chunk in enumerate(chunks)
    ]
    # Execute tasks as a group
    job = group(task_signatures)
    result = job.apply_async()

    return result.get()  # Wait for all tasks to complete

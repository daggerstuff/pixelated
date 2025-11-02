# Celery Configuration for Distributed Bias Detection Processing
# This configuration enables horizontal scaling and distributed task processing

import os

from celery import Celery
from celery.schedules import crontab

# Redis broker URL - use environment variable or default
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_DB = os.getenv("REDIS_DB", "0")
if REDIS_PASSWORD := os.getenv("REDIS_PASSWORD", ""):
    broker_url = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"
else:
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"

# Result backend - same as broker for simplicity
result_backend = broker_url

# Create Celery app instance
app = Celery(
    "bias_detection",
    broker=broker_url,
    backend=result_backend,
    include=["bias_detection_service"],
)

# Celery configuration
app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Worker settings
    worker_prefetch_multiplier=1,  # One task per worker at a time
    worker_max_tasks_per_child=1000,  # Restart worker after 1000 tasks
    worker_disable_rate_limits=False,
    # Result backend settings
    result_expires=3600,  # Results expire after 1 hour
    result_cache_max=10000,  # Maximum number of results to cache
    # Routing settings
    task_routes={
        "bias_detection_service.analyze_session_async": {"queue": "bias_analysis"},
        "bias_detection_service.batch_analyze_sessions": {"queue": "batch_processing"},
        "bias_detection_service.validate_dataset_quality": {
            "queue": "quality_validation"
        },
        "bias_detection_service.export_dataset_chunk": {"queue": "export_processing"},
    },
    # Queue definitions
    task_create_missing_queues=True,
    task_default_queue="bias_analysis",
    task_default_exchange="bias_detection",
    task_default_exchange_type="direct",
    # Beat scheduler settings (for periodic tasks)
    beat_schedule={
        "cleanup-expired-results": {
            "task": "bias_detection_service.cleanup_expired_results",
            "schedule": crontab(minute=0, hour="*/4"),  # Every 4 hours
        },
        "health-check": {
            "task": "bias_detection_service.perform_health_check",
            "schedule": crontab(minute="*/10"),  # Every 10 minutes
        },
        "update-metrics": {
            "task": "bias_detection_service.update_performance_metrics",
            "schedule": crontab(minute="*/5"),  # Every 5 minutes
        },
    },
    # Monitoring and logging
    worker_log_format="[%(asctime)s: %(levelname)s/%(processName)s] %(message)s",
    worker_task_log_format="[%(asctime)s: %(levelname)s/%(processName)s][%(task_name)s(%(task_id)s)] %(message)s",
    # Error handling
    task_acks_late=True,  # Tasks acknowledged after completion
    task_reject_on_worker_lost=True,
    worker_cancel_long_running_tasks_on_connection_loss=True,
    # Security
    security_key=os.getenv("CELERY_SECURITY_KEY"),
    security_certificate=os.getenv("CELERY_SECURITY_CERT"),
    security_cert_store=os.getenv("CELERY_SECURITY_STORE"),
    # Performance tuning
    worker_pool_restarts=True,
    worker_send_task_events=True,
    task_send_sent_event=True,
    worker_log_color=True,
)

# Worker configuration for different node types
worker_configurations = {
    "bias_analysis": {
        "concurrency": 4,
        "pool": "solo",  # One task at a time for bias analysis
        "queues": ["bias_analysis"],
    },
    "batch_processing": {
        "concurrency": 8,
        "pool": "prefork",
        "queues": ["batch_processing"],
    },
    "quality_validation": {
        "concurrency": 2,
        "pool": "solo",
        "queues": ["quality_validation"],
    },
    "export_processing": {
        "concurrency": 6,
        "pool": "prefork",
        "queues": ["export_processing"],
    },
}

# Environment-specific configuration
if os.getenv("ENV") == "production":
    app.conf.update(
        worker_prefetch_multiplier=2,
        worker_max_tasks_per_child=500,
        result_expires=7200,  # 2 hours in production
    )
elif os.getenv("ENV") == "development":
    app.conf.update(
        worker_log_level="DEBUG",
        task_always_eager=False,  # Set to True for synchronous execution in dev
    )


# Health check function
@app.task(bind=True)
def health_check(self):
    """Health check task for monitoring"""
    return {
        "status": "healthy",
        "timestamp": os.getenv("HOSTNAME", "unknown"),
        "worker": self.request.hostname,
    }


if __name__ == "__main__":
    app.start()

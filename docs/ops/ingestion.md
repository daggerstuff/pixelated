# Ingestion Configuration and Operational Runbook

## Overview

This document provides configuration details and operational guidance for the ingestion system in the dataset pipeline. The ingestion system is responsible for acquiring data from various sources (local files, YouTube, S3, GCS) with robust error handling, deduplication, and validation.

## Architecture

The ingestion system consists of:
- **Connectors**: Source-specific implementations (LocalFileConnector, YouTubeConnector, S3Connector, GCSConnector)
- **Ingestion Queue**: Backpressure handling with Redis or internal async queues
- **Deduplication**: Bloom filter-based duplicate detection
- **Validation**: Schema validation and sanitization
- **Quarantine**: Storage for failed records

## Configuration

### Environment Variables

```bash
# MongoDB connection for quarantine
MONGO_URI=mongodb://localhost:27017

# Redis connection for queue (optional, internal queue used if not provided)
REDIS_URL=redis://localhost:6379

# AWS credentials for S3 connector (can also be set in config)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Google Cloud credentials for GCS connector
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
```

### Connector Configuration

#### Local File Connector
```python
from ai.dataset_pipeline.ingestion_interface import LocalFileConnector

connector = LocalFileConnector(
    directory="/path/to/data/directory",
    retry_options={
        'retries': 3,
        'backoff_factor': 0.2,
        'max_backoff': 5.0
    },
    rate_limit={
        'capacity': 10,      # tokens
        'refill_rate': 1.0   # tokens per second
    }
)
```

#### YouTube Connector
```python
from ai.dataset_pipeline.youtube_connector import YouTubeConnector, YouTubeConfig

config = YouTubeConfig(
    playlist_urls=["https://youtube.com/playlist?list=..."],
    max_concurrent=3,
    retry_attempts=3,
    retry_delay=5.0,
    rate_limit_config=RateLimitConfig(requests_per_minute=60),
    audio_format="mp3",
    audio_quality="0",  # Best quality
    output_dir="temp_youtube_data"
)

connector = YouTubeConnector(config)
```

#### S3 Connector
```python
from ai.dataset_pipeline.s3_connector import S3Connector, S3Config

config = S3Config(
    bucket_name="your-bucket-name",
    region_name="us-east-1",
    prefix="data/",  # Optional prefix/filter
    max_concurrent=10,
    retry_options={'retries': 3, 'backoff_factor': 0.3},
    rate_limit={'capacity': 20, 'refill_rate': 2.0}
)

connector = S3Connector(config)
```

#### GCS Connector
```python
from ai.dataset_pipeline.gcs_connector import GCSConnector, GCSConfig

config = GCSConfig(
    bucket_name="your-bucket-name",
    project_id="your-project-id",
    prefix="data/",  # Optional prefix/filter
    max_concurrent=5,
    retry_options={'retries': 3, 'backoff_factor': 0.2},
    rate_limit={'capacity': 15, 'refill_rate': 1.5}
)

connector = GCSConnector(config)
```

## Operational Procedures

### Starting an Ingestion Process

1. **Initialize connector**: Choose and configure the appropriate connector for your data source
2. **Connect**: Call `connector.connect()` to establish connections
3. **Process**: Iterate through `connector.fetch()` to get validated records
4. **Handle records**: Process yielded records as needed

### Queue Management

The ingestion system uses a queue with backpressure handling:

```python
from ai.dataset_pipeline.ingestion_queue import IngestionQueue, QueueType

# Initialize queue (Redis or internal)
queue = await IngestionQueue(
    queue_type=QueueType.REDIS,  # or QueueType.INTERNAL_ASYNC
    redis_url="redis://localhost:6379",
    max_size=10000,
    batch_size=10
).connect()

# Add items to queue
success = await queue.enqueue(queue_item)

# Process batch from queue
batch = await queue.dequeue_batch()
```

### Monitoring

Key metrics to monitor:
- Queue size and growth rate
- Validation success/failure rates
- Duplicate detection rates
- Connector-specific metrics (API limits, etc.)

### Troubleshooting

#### High Failure Rates
1. Check if quarantine records are growing
2. Review error messages in quarantine records
3. Adjust validation rules if needed
4. Verify source connectivity and permissions

#### Performance Issues
1. Check queue size for backpressure
2. Monitor connector-specific resource usage
3. Adjust rate limiting parameters
4. Increase concurrent processing limits if needed

#### Duplicate Detection Issues
1. Verify bloom filter capacity settings
2. Adjust false positive rate if needed
3. Check for duplicate prevention in source systems

## Security Considerations

### SSRF Protection
- URL validation against allow list
- Pattern matching to prevent internal resource access
- Connection timeouts and restrictions

### File Security
- Dangerous file extension blocking
- Path traversal prevention
- Content validation before processing

### Credential Management
- Environment variable configuration
- Service account keys stored securely
- Access scope minimization

## Maintenance Tasks

### Regular Operations
- Monitor quarantine growth
- Clean up old quarantined records
- Review and reprocess quarantined items
- Check queue sizes and performance

### Backup and Recovery
- Quarantined records should be backed up
- Configuration files should be version controlled
- Queue state may need backup for critical systems

## Scaling Guidelines

- Adjust queue sizes based on ingestion volume
- Increase concurrent processing for high-volume sources
- Use Redis for production environments with high throughput
- Monitor memory usage with large bloom filters

## Common Issues and Solutions

### "Rate limit exceeded" errors
- Increase rate limiting parameters
- Add jitter to requests
- Check if other systems are using same APIs

### "Queue full" errors
- Increase queue capacity
- Check for slow processing downstream
- Adjust batch sizes and processing rates

### High duplicate detection
- Verify bloom filter capacity vs expected data volume
- Check for duplicate data sources
- Adjust deduplication sensitivity if needed
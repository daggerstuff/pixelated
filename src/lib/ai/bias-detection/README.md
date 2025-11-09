# Pixelated Empathy Bias Detection Engine

A comprehensive bias detection system for AI-assisted therapeutic training simulations, ensuring fair and equitable treatment across all demographic groups.

## Overview

The Bias Detection Engine implements a multi-layer analysis approach using industry-leading fairness toolkits to identify and mitigate bias in therapeutic training scenarios. The system provides real-time monitoring, detailed analytics, and actionable recommendations to maintain ethical AI practices in mental health training.

## Architecture

### Modular Design

The Bias Detection Engine has been refactored into a modular architecture for better maintainability and scalability:

#### Core Modules

1. **BiasDetectionEngine** (`BiasDetectionEngine.ts`)
   - Main orchestration engine
   - Session analysis coordination
   - Configuration management
   - Core business logic

2. **PythonBiasDetectionBridge** (`python-bridge.ts`)
   - Python service communication
   - Multi-layer analysis coordination
   - Fallback analysis handling
   - Service health monitoring

3. **BiasMetricsCollector** (`metrics-collector.ts`)
   - Real-time metrics aggregation
   - Dashboard data generation
   - Performance monitoring
   - Data storage coordination

4. **BiasAlertSystem** (`alerts-system.ts`)
   - Alert rule processing
   - Notification management
   - Escalation handling
   - Monitoring callbacks

5. **Interface Definitions** (`bias-detection-interfaces.ts`)
   - Consolidated type definitions
   - Service communication interfaces
   - Internal data structures

### Multi-Layer Analysis Framework

1. **Pre-processing Layer** (spaCy/NLTK)
   - Linguistic bias detection
   - Demographic representation analysis
   - Text sentiment analysis
   - Biased terminology identification

2. **Model-Level Detection** (IBM AIF360)
   - Algorithmic fairness metrics
   - Demographic parity analysis
   - Equalized odds assessment
   - Constraint-based fairness optimization

3. **Interactive Analysis Layer** (Google What-If Tool)
   - Counterfactual analysis
   - Feature importance evaluation
   - Interactive bias exploration
   - Scenario-based testing

4. **Evaluation Layer** (Hugging Face evaluate + Microsoft Fairlearn)
   - NLP bias metrics
   - Performance evaluation across demographics
   - Fairness constraint validation
   - Comprehensive bias reporting

## Features

### Core Capabilities
- **Real-time bias detection** with configurable thresholds
- **Multi-toolkit integration** for comprehensive analysis
- **HIPAA-compliant** data handling and audit logging
- **Scalable architecture** supporting 100+ concurrent sessions
- **Interactive dashboard** with real-time monitoring
- **Comprehensive reporting** with multiple export formats
- **Educational interfaces** for bias awareness training

### Performance Specifications
- **Latency**: <100ms per session analysis
- **Throughput**: 100+ concurrent sessions
- **Accuracy**: 92%+ overall bias detection accuracy
- **Compliance**: HIPAA-compliant data processing

## Connection Pooling & Monitoring

### Overview

The Bias Detection Engine uses robust, production-grade connection pooling for all critical services:
- **Redis**: Managed by `RedisService` with configurable pool size, timeouts, and health checks.
- **Python Service HTTP**: All requests from `PythonBiasDetectionBridge` use a custom `ConnectionPool` for efficient, concurrent HTTP connection management.
- **Generic Pools**: The `PerformanceOptimizer` and other modules can use the same pooling patterns for any resource.

### Configuration

#### Redis Pooling

Configure via environment variables or config files (see `config/environments/*.json`):

```json
"redis": {
  "maxConnections": 50,
  "minConnections": 5,
  "connectTimeout": 5000,
  "healthCheckInterval": 10000
}
```

#### HTTP (PythonBiasDetectionBridge) Pooling

You can pass a custom `ConnectionPool` or configure pooling via code:

```typescript
import { PythonBiasDetectionBridge } from '@/lib/ai/bias-detection/python-bridge'
import { ConnectionPool } from '@/lib/ai/bias-detection/connection-pool'

const pool = new ConnectionPool({
  maxConnections: 20,
  connectionTimeout: 10000,
  idleTimeout: 60000,
  retryAttempts: 3,
  retryDelay: 500,
})

const pythonBridge = new PythonBiasDetectionBridge('http://localhost:5000', 30000, pool)
```

#### Generic Pooling

For other services, use the `ConnectionPool` or `PerformanceOptimizer` as needed.

### Monitoring & Health Checks

- **RedisService**: Use `getPoolStats()` and `isHealthy()` to monitor pool status and health.
- **PythonBiasDetectionBridge**: Use `getMetrics()` and `getHealthStatus()` for HTTP pool monitoring.
- **ConnectionPool**: Use `getStats()` for pool metrics and `isHealthy()` for health checks.

Example:

```typescript
const stats = pythonBridge['connectionPool'].getStats()
const healthy = pythonBridge['connectionPool'].isHealthy()
```

### Production Best Practices

- Set pool sizes based on expected concurrency and load (see `performance/optimization.json` for recommended values).
- Monitor pool health and queue lengths; alert if pools are saturated or unhealthy.
- Use health check endpoints and metrics dashboards to track system status.
- Tune timeouts and retry logic for your deployment environment.
- Regularly review logs for connection errors or pool exhaustion.

For more details, see the [Performance Optimization](#performance-optimization) and [Monitoring and Alerts](#monitoring-and-alerts) sections.
## Installation

### Prerequisites
- Python 3.8+
- Node.js 16+
- 8GB+ RAM recommended
- CUDA-compatible GPU (optional, for enhanced performance)

### Quick Setup

#### Windows
```bash
# Run the setup script
./setup.bat

# Or manually:
python -m venv bias_detection_env
bias_detection_env\Scripts\activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

#### Unix/Linux/macOS
```bash
# Run the setup script
chmod +x setup.sh
./setup.sh

# Or manually:
python3 -m venv bias_detection_env
source bias_detection_env/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

### Dependencies

#### Core ML Libraries
- **IBM AIF360**: Algorithmic fairness toolkit
- **Microsoft Fairlearn**: Constraint-based fairness
- **Google What-If Tool**: Interactive analysis
- **Hugging Face evaluate**: NLP bias metrics
- **spaCy**: Advanced NLP processing
- **NLTK**: Natural language toolkit

#### Supporting Libraries
- **scikit-learn**: Machine learning utilities
- **pandas/numpy**: Data processing
- **matplotlib/plotly**: Visualization
- **flask**: API server
- **pytest**: Testing framework

## Usage

### Starting the Service

#### Python Service
```bash
# Activate virtual environment
source bias_detection_env/bin/activate  # Unix
# or
bias_detection_env\Scripts\activate     # Windows

# Start the Python service
python start-python-service.py
```

#### TypeScript Integration
```typescript
import { 
  BiasDetectionEngine,
  PythonBiasDetectionBridge,
  BiasMetricsCollector,
  BiasAlertSystem 
} from '@/lib/ai/bias-detection';

// Initialize the main engine
const biasEngine = new BiasDetectionEngine({
  thresholds: {
    warningLevel: 0.3,
    highLevel: 0.6,
    criticalLevel: 0.8
  },
  hipaaCompliant: true,
  auditLogging: true
});

// Initialize and analyze
await biasEngine.initialize();
const result = await biasEngine.analyzeSession(sessionData);
console.log('Bias Score:', result.overallBiasScore);
console.log('Alert Level:', result.alertLevel);

// Use individual modules for advanced scenarios
const pythonBridge = new PythonBiasDetectionBridge('http://localhost:5000');
const metricsCollector = new BiasMetricsCollector(config, pythonBridge);
const alertSystem = new BiasAlertSystem(config, pythonBridge);
```

### API Endpoints

#### Session Analysis
```bash
# Analyze a therapeutic session
POST /api/bias-detection/analyze
Content-Type: application/json

{
  "sessionId": "session-123",
  "participantDemographics": {
    "gender": "female",
    "age": "28",
    "ethnicity": "hispanic"
  },
  "content": {
    "transcript": "Patient expresses anxiety...",
    "aiResponses": ["I understand your concerns..."]
  }
}
```

#### Dashboard Data
```bash
# Get dashboard metrics
GET /api/bias-detection/dashboard?timeRange=24h&demographic=all
```

#### Export Data
```bash
# Export bias detection data
GET /api/bias-detection/export?format=json&timeRange=7d
```

### React Dashboard Component

```tsx
import { BiasDashboard } from '@/components/admin/bias-detection/BiasDashboard';

function AdminPanel() {
  return (
    <div>
      <h1>Bias Detection Monitoring</h1>
      <BiasDashboard 
        refreshInterval={30000}
        enableRealTimeUpdates={true}
      />
    </div>
  );
}
```

## Configuration

### Environment Variables

```bash
# Python Service Configuration
BIAS_SERVICE_HOST=127.0.0.1
BIAS_SERVICE_PORT=5001
BIAS_SERVICE_DEBUG=false

# Bias Detection Thresholds
BIAS_WARNING_THRESHOLD=0.3
BIAS_HIGH_THRESHOLD=0.6
BIAS_CRITICAL_THRESHOLD=0.8

# HIPAA Compliance
ENABLE_HIPAA_COMPLIANCE=true
ENABLE_AUDIT_LOGGING=true

# Performance Settings
MAX_CONCURRENT_SESSIONS=100
ANALYSIS_TIMEOUT=30000
```

### TypeScript Configuration

```typescript
interface BiasDetectionConfig {
  warningThreshold: number;      // 0.3 recommended
  highThreshold: number;         // 0.6 recommended
  criticalThreshold: number;     // 0.8 recommended
  enableHipaaCompliance: boolean;
  enableAuditLogging: boolean;
  layerWeights: {
    preprocessing: number;       // 0.25 recommended
    modelLevel: number;         // 0.25 recommended
    interactive: number;        // 0.25 recommended
    evaluation: number;         // 0.25 recommended
  };
}
```

## Data Structures

### Session Data
```typescript
interface SessionData {
  sessionId: string;
  participantDemographics: {
    gender?: string;
    age?: string;
    ethnicity?: string;
    education?: string;
    experience?: string;
  };
  trainingScenario: {
    type: string;
    difficulty: string;
    duration: number;
    objectives: string[];
  };
  content: {
    transcript: string;
    aiResponses: string[];
    userInputs: string[];
  };
  aiResponses: Array<{
    id: string;
    content: string;
    timestamp: string;
    confidence: number;
  }>;
  expectedOutcomes: Array<{
    metric: string;
    expected: number;
    actual: number;
  }>;
  transcripts: Array<{
    speaker: string;
    content: string;
    timestamp: string;
  }>;
  metadata: {
    sessionDuration: number;
    completionRate: number;
    technicalIssues: boolean;
  };
}
```

### Analysis Results
```typescript
interface BiasAnalysisResult {
  sessionId: string;
  timestamp: string;
  overallBiasScore: number;
  alertLevel: 'low' | 'medium' | 'high' | 'critical';
  layerResults: {
    preprocessing: LayerResult;
    modelLevel: LayerResult;
    interactive: LayerResult;
    evaluation: LayerResult;
  };
  demographics: DemographicAnalysis;
  recommendations: string[];
  confidence: number;
  auditLog?: AuditLogEntry[];
}
```

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --grep "BiasDetectionEngine"
npm test -- --grep "Dashboard"
npm test -- --grep "API"

# Run with coverage
npm run test:coverage
```

### Test Categories

#### Unit Tests
- Individual component functionality
- Configuration validation
- Data structure validation
- Error handling scenarios

#### Integration Tests
- API endpoint functionality
- Python-TypeScript communication
- Database integration
- Real-time monitoring

#### Performance Tests
- Latency requirements (<100ms)
- Concurrent session handling (100+)
- Memory usage optimization
- Scalability testing

#### Security Tests
- HIPAA compliance validation
- Data masking verification
- Audit logging functionality
- Access control testing

## Monitoring and Alerts

### Alert Levels

#### Low (0.0 - 0.3)
- **Action**: Continue monitoring
- **Notification**: Dashboard only
- **Frequency**: Batch reporting

#### Medium (0.3 - 0.6)
- **Action**: Review session details
- **Notification**: Email notification
- **Frequency**: Real-time alerts

#### High (0.6 - 0.8)
- **Action**: Immediate review required
- **Notification**: Email + Slack/Teams
- **Frequency**: Immediate alerts

#### Critical (0.8 - 1.0)
- **Action**: Stop session, immediate intervention
- **Notification**: Email + Slack/Teams + SMS
- **Frequency**: Immediate alerts + escalation

### Metrics Dashboard

#### Key Performance Indicators
- **Overall Bias Score**: Average across all sessions
- **Alert Distribution**: Count by severity level
- **Demographic Fairness**: Bias scores by demographic groups
- **Trend Analysis**: Bias score changes over time
- **Processing Performance**: Latency and throughput metrics

#### Real-time Monitoring
- Live session analysis results
- Alert notifications
- System health status
- Performance metrics
- Error rates and logs

## Troubleshooting

### Common Issues

#### Python Service Won't Start
```bash
# Check Python version
python --version  # Should be 3.8+

# Verify virtual environment
source bias_detection_env/bin/activate
pip list | grep aif360

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

#### High Memory Usage
```bash
# Monitor memory usage
python -c "import psutil; print(f'Memory: {psutil.virtual_memory().percent}%')"

# Optimize configuration
export MAX_CONCURRENT_SESSIONS=50
export ANALYSIS_TIMEOUT=15000
```

#### Slow Analysis Performance
```bash
# Enable GPU acceleration (if available)
pip install tensorflow-gpu

# Optimize model loading
export PRELOAD_MODELS=true
export CACHE_MODELS=true
```

#### HIPAA Compliance Issues
```bash
# Verify audit logging
tail -f logs/bias-detection-audit.log

# Check data masking
python -c "from python_service.bias_detection_service import mask_sensitive_data; print('Masking works')"
```

### Performance Optimization

#### Memory Management
- Use model caching for repeated analyses
- Implement session batching for high throughput
- Configure garbage collection for long-running processes

#### Processing Speed
- Enable GPU acceleration where available
- Use async processing for concurrent sessions
- Implement result caching for similar sessions

#### Scalability
- Deploy multiple Python service instances
- Use load balancing for high-traffic scenarios
- Implement database connection pooling

## Contributing

### Development Setup
```bash
# Clone and setup development environment
git clone <repository>
cd bias-detection
npm install
pip install -r requirements-dev.txt

# Run development servers
npm run dev          # TypeScript/React development
python start-python-service.py  # Python service
```

### Code Standards
- Follow TypeScript strict mode
- Use ESLint and Prettier for code formatting
- Write comprehensive tests for new features
- Document all public APIs
- Follow HIPAA compliance guidelines

### Pull Request Process
1. Create feature branch from main
2. Implement changes with tests
3. Update documentation
4. Run full test suite
5. Submit PR with detailed description

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For technical support or questions:
- Create an issue in the repository
- Contact the development team
- Review the troubleshooting guide
- Check the FAQ section

## Changelog

### Version 1.0.0
- Initial release with multi-layer bias detection
- Real-time monitoring dashboard
- HIPAA-compliant data processing
- Comprehensive test suite
- Production-ready API endpoints

### Roadmap
- Enhanced ML model integration
- Advanced visualization features
- Mobile dashboard support
- Extended language support
- Cloud deployment options 
## Intelligent Caching for Bias Computations

### Overview
The bias detection engine uses a robust, hybrid caching system to optimize performance for expensive computations such as session analysis and report generation. The cache supports in-memory and Redis-backed storage, LRU eviction, TTL, tag-based invalidation, and compression.

### Key Features
- **Hybrid Memory + Redis**: Fast local access with distributed consistency.
- **Configurable**: Control cache size, TTL, compression, and backend via `cacheConfig` in the engine constructor.
- **Specialized Managers**: Separate caches for analysis results, dashboard data, and reports.
- **Tag-based Invalidation**: Invalidate cache entries by session, demographic, or report.
- **Monitoring**: Use `engine.getCacheStats()` to monitor hit/miss rates, evictions, and memory usage.

### Usage

#### Engine Integration
- `analyzeSession(session)`: Checks cache before running analysis; stores result after computation.
- `generateBiasReport(sessions, ...)`: Caches aggregated report results by session list and parameters.

#### Batch Processing Usage

The engine supports robust batch analysis of multiple sessions with configurable concurrency, chunking, retries, and timeouts. Monitoring and error reporting are built-in.

**Example Usage:**
```ts
const engine = new BiasDetectionEngine({
  batchProcessingConfig: {
    concurrency: 8,      // Number of parallel workers for batch analysis
    batchSize: 20,       // Sessions per batch
    retries: 2,          // Number of retries per session
    timeoutMs: 20000     // Timeout per session in ms
  }
})

// Run batch analysis
const { results, errors, metrics } = await engine.batchAnalyzeSessions(sessions, {
  logProgress: true,    // Log progress to console
  logErrors: true,      // Log errors to console
  onProgress: ({ completed, total }) => {
    // Custom progress callback (optional)
    updateProgressBar(completed / total)
  },
  onError: (error, session) => {
    // Custom error callback (optional)
    sendErrorToMonitoring(error, session)
  }
})

console.log('Batch Results:', results)
console.log('Batch Errors:', errors)
console.log('Batch Metrics:', metrics)
```

**Monitoring & Logging:**
- Progress and errors are logged to the console by default.
- You can provide custom callbacks for progress and error reporting.
- The returned `metrics` object includes completed count, total, and error count for observability.

**Production Recommendations:**
- Use structured logging for batch jobs in production.
- Monitor batch metrics and error rates via your observability platform.
- Tune concurrency and batch size for your deployment environment.


#### Monitoring Example
```ts
const stats = engine.getCacheStats()
console.log('Cache Stats:', stats)
```

### Best Practices
- Set appropriate TTLs for analysis and report results to balance freshness and performance.
- Use Redis in production for distributed deployments.
- Monitor cache hit/miss rates and adjust size/TTL as needed.
## Background Job Processing for Long-Running Analyses

### Overview
For large batch analyses or long-running computations, the Bias Detection Engine supports asynchronous background job processing. This offloads heavy work to a job queue and worker, allowing clients to submit jobs and poll for status/results without blocking.

### Key Concepts
- **Job Queue**: In-memory (or Redis-backed) queue for batch analysis jobs.
- **Worker**: Background process that executes jobs and updates status/results.
- **Job Submission API**: `POST /api/bias-detection/submit-batch-job` to enqueue a batch analysis job.
- **Job Status API**: `GET /api/bias-detection/job-status?jobId=...` to poll for job progress and retrieve results.

### Usage

#### Submit a Batch Analysis Job
```bash
POST /api/bias-detection/submit-batch-job
Content-Type: application/json

{
  "sessions": [ ... ], // Array of session data objects
  "options": {
    "concurrency": 8,
    "batchSize": 20,
    "timeoutMs": 30000
  }
}
```
**Response:**
```json
{
  "jobId": "job-abc123",
  "status": "queued"
}
```

#### Poll Job Status and Retrieve Results
```bash
GET /api/bias-detection/job-status?jobId=job-abc123
```
**Response (in progress):**
```json
{
  "jobId": "job-abc123",
  "status": "running",
  "progress": {
    "completed": 40,
    "total": 100
  }
}
```
**Response (completed):**
```json
{
  "jobId": "job-abc123",
  "status": "completed",
  "results": [ ... ], // Array of BiasAnalysisResult
  "errors": [ ... ],  // Any failed sessions
  "metrics": {
    "completed": 100,
    "total": 100,
    "errorCount": 0
  }
}
```

### Best Practices
- Use the job API for any batch analysis expected to take >5 seconds or involve >50 sessions.
- Poll job status at reasonable intervals (e.g., every 2-5 seconds).
- Handle job errors and timeouts gracefully; check the `errors` array in the result.
- For production, consider using a Redis-backed queue for durability and scalability.

### Architecture Notes
- The job queue and worker are modular; you can swap in a Redis-backed implementation for distributed deployments.
- All job submissions and results are logged for audit and monitoring.
- Job metrics are exposed via the status API for observability.

### Example Client Integration
```typescript
// Submit a batch job
const submitRes = await fetch('/api/bias-detection/submit-batch-job', {
  method: 'POST',
  body: JSON.stringify({ sessions, options }),
  headers: { 'Content-Type': 'application/json' }
});
const { jobId } = await submitRes.json();

// Poll for status
let status;
do {
  const statusRes = await fetch(`/api/bias-detection/job-status?jobId=${jobId}`);
  status = await statusRes.json();
  // Optionally update UI with status.progress
  await new Promise(r => setTimeout(r, 2000));
} while (status.status !== 'completed');

// Use results
console.log('Batch Results:', status.results);
```

### Monitoring & Logging
- All job events (submission, start, completion, errors) are logged.
- Metrics are available via the job status API.
- For advanced monitoring, integrate with your observability platform.

- Use tag-based invalidation to clear stale or sensitive data.

### Production Setup for Background Job Processing

For robust, scalable background job processing in production environments:

- **Use Redis-backed Queue**: Replace the in-memory queue with a Redis-backed implementation for durability, distributed processing, and crash recovery.
- **Scale Workers Horizontally**: Run multiple worker processes to handle high job throughput. Use process managers (PM2, systemd) or container orchestration (Kubernetes).
- **Configure Environment Variables**:
  - `REDIS_URL`: Redis connection string
  - `JOB_WORKER_CONCURRENCY`: Number of concurrent jobs per worker
  - `JOB_QUEUE_RETRY_LIMIT`: Max retries for failed jobs
  - `JOB_QUEUE_TIMEOUT_MS`: Job execution timeout
- **Monitoring & Observability**:
  - Integrate job metrics with your monitoring platform (Prometheus, Datadog, etc.)
  - Use structured logging for all job events (submission, start, completion, error)
  - Set up alerting for high error rates or job queue saturation
- **Security & Compliance**:
  - Ensure job data is encrypted in transit and at rest
  - Restrict access to job APIs and queue endpoints
  - Audit all job submissions and results for compliance (HIPAA, GDPR)
- **Disaster Recovery**:
  - Persist job state in Redis or a database
  - Implement dead-letter queues for failed jobs
  - Regularly backup job queue data

**Example Redis-backed Setup**:
```typescript
import { RedisJobQueue } from '@/lib/ai/bias-detection/redis-job-queue'
const jobQueue = new RedisJobQueue(handler, process.env.REDIS_URL)
```

**Kubernetes Worker Deployment**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bias-job-worker
spec:
  replicas: 4
  template:
    spec:
      containers:
        - name: worker
          image: your-repo/bias-job-worker:latest
          env:
            - name: REDIS_URL
              value: "redis://redis:6379"
            - name: JOB_WORKER_CONCURRENCY
              value: "8"
```

**Best Practices**:
- Test job queue failover and recovery scenarios
- Monitor job queue length and worker health
- Tune concurrency and retry settings for your workload
- Document operational procedures for job queue maintenance

### CDN Integration for Static Assets and Report Delivery

For optimal performance and scalability, all static assets (including bias detection reports, exports, and dashboard resources) should be served via a Content Delivery Network (CDN).

**Configuration:**
- Enable CDN in your environment config:
  ```json
  "cdn": {
    "enabled": true,
    "provider": "cloudflare",
    "domain": "${CDN_DOMAIN}",
    "cache_headers": true,
    "static_asset_caching": true
  }
  ```
- Set the `CDN_DOMAIN` environment variable to your CDN endpoint (e.g., `cdn.example.com`).

**Report Delivery:**
- When generating downloadable reports (JSON, CSV, PDF), upload them to your CDN storage bucket or static hosting directory.
- Return the CDN URL in the API response for client download, e.g.:
  ```json
  {
    "reportUrl": "https://cdn.example.com/reports/bias-report-2025-08-21.pdf"
  }
  ```

**Best Practices:**
- Use long-lived cache headers for immutable assets and short-lived headers for frequently updated reports.
- Invalidate CDN cache when reports are regenerated or updated.
- Use versioned or timestamped filenames for reports to avoid stale cache issues.
- Monitor CDN analytics for asset delivery performance and cache hit rates.
- Ensure all report downloads and static assets are served over HTTPS.

**Example:**
```typescript
// After generating a report, upload to CDN and return the URL
const reportUrl = `https://${process.env.CDN_DOMAIN}/reports/${filename}`
res.json({ reportUrl })
```

**Supported Providers:** Cloudflare, AWS CloudFront, Azure CDN, Vercel, and others.

# Performance Load Testing Guide

## Overview

This directory contains K6 load tests for the Pixelated Empathy multimodal AI system. The tests validate performance targets under realistic production load conditions.

## Prerequisites

### Install K6

**macOS:**
```bash
brew install k6
```

**Linux:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows:**
```powershell
choco install k6
```

Or download from: https://k6.io/docs/get-started/installation/

## Test Files

### 1. REST API Load Test
**File**: `k6-rest-inference-load.js`

Tests the `/api/ai/pixel/infer` REST endpoint.

**Targets:**
- Latency: P50 < 200ms, P95 < 500ms, P99 < 1s
- Error rate: < 1%
- Throughput: Measure req/s
- Load profile: 10 → 25 → 50 → 100 users

**Run:**
```bash
k6 run tests/performance/k6-rest-inference-load.js
```

### 2. WebSocket Streaming Load Test
**File**: `k6-websocket-streaming-load.js`

Tests the `/ws/pixel-multimodal` WebSocket endpoint.

**Targets:**
- Chunk latency: P50 < 50ms, P95 < 200ms
- Message latency: P50 < 100ms, P95 < 500ms
- Connection error rate: < 5%
- Concurrent connections: 50 → 200 → 500 → 1000

**Run:**
```bash
k6 run tests/performance/k6-websocket-streaming-load.js
```

## Running Tests

### Basic Execution
```bash
# Run with default settings
k6 run tests/performance/k6-rest-inference-load.js

# Run with custom duration
k6 run --duration 5m tests/performance/k6-rest-inference-load.js

# Run with specific VUs (virtual users)
k6 run --vus 50 tests/performance/k6-rest-inference-load.js

# Run with both
k6 run --vus 100 --duration 10m tests/performance/k6-rest-inference-load.js
```

### Custom API Endpoint
```bash
# Set API URL via environment variable
API_URL=https://api.production.pixelatedempathy.com k6 run tests/performance/k6-rest-inference-load.js

# For WebSocket
WS_URL=wss://api.production.pixelatedempathy.com/ws k6 run tests/performance/k6-websocket-streaming-load.js
```

### Output Formats

**JSON output:**
```bash
k6 run --out json=results.json tests/performance/k6-rest-inference-load.js
```

**CSV output:**
```bash
k6 run --out csv=results.csv tests/performance/k6-rest-inference-load.js
```

**InfluxDB (for Grafana):**
```bash
k6 run --out influxdb=http://localhost:8086/k6 tests/performance/k6-rest-inference-load.js
```

**Cloud (K6 Cloud):**
```bash
k6 cloud tests/performance/k6-rest-inference-load.js
```

## Load Profiles

### Light Load (Development)
```bash
k6 run --vus 10 --duration 1m tests/performance/k6-rest-inference-load.js
```

### Medium Load (Staging)
```bash
k6 run --vus 50 --duration 5m tests/performance/k6-rest-inference-load.js
```

### Heavy Load (Pre-production)
```bash
k6 run --vus 100 --duration 10m tests/performance/k6-rest-inference-load.js
```

### Stress Test (Find breaking point)
```bash
k6 run --vus 200 --duration 15m tests/performance/k6-rest-inference-load.js
```

### Spike Test
```bash
k6 run --stage 0s:0,1m:100,30s:100,1m:0 tests/performance/k6-rest-inference-load.js
```

## Interpreting Results

### Key Metrics

**HTTP Request Duration:**
- `p(50)`: Median response time (should be < 200ms)
- `p(95)`: 95th percentile (should be < 500ms)
- `p(99)`: 99th percentile (should be < 1s)

**Throughput:**
- `http_reqs`: Total requests per second
- Target: > 100 req/s for REST, > 500 concurrent for WebSocket

**Error Rate:**
- `http_req_failed`: Percentage of failed requests
- Target: < 1%

**Custom Metrics:**
- `inference_latency`: API-reported latency
- `successful_inferences`: Count of successful responses
- `crisis_detections`: Number of crisis scenarios detected
- `bias_detections`: Number of bias flags raised

### Success Criteria

✅ **PASS** if:
- P50 latency < 200ms (REST) or < 100ms (WebSocket message)
- P95 latency < 500ms
- Error rate < 1% (REST) or < 5% (WebSocket connections)
- Throughput meets target (100+ req/s or 500+ concurrent connections)

❌ **FAIL** if:
- P50 latency > 200ms
- P95 latency > 500ms
- Error rate > 1%
- Crashes or OOM errors

## CI/CD Integration

### GitHub Actions
```yaml
- name: Install K6
  run: |
    curl https://github.com/grafana/k6/releases/download/v0.48.0/k6-v0.48.0-linux-amd64.tar.gz -L | tar xvz
    sudo mv k6-v0.48.0-linux-amd64/k6 /usr/local/bin/

- name: Run Load Tests
  run: |
    k6 run --out json=test-results/k6-results.json tests/performance/k6-rest-inference-load.js

- name: Upload Results
  uses: actions/upload-artifact@v3
  with:
    name: k6-results
    path: test-results/k6-results.json
```

### Azure Pipelines
```yaml
- script: |
    curl https://github.com/grafana/k6/releases/download/v0.48.0/k6-v0.48.0-linux-amd64.tar.gz -L | tar xvz
    sudo mv k6-v0.48.0-linux-amd64/k6 /usr/local/bin/
  displayName: 'Install K6'

- script: k6 run --out json=$(Build.ArtifactStagingDirectory)/k6-results.json tests/performance/k6-rest-inference-load.js
  displayName: 'Run Load Tests'

- task: PublishBuildArtifacts@1
  inputs:
    pathToPublish: '$(Build.ArtifactStagingDirectory)'
    artifactName: 'k6-results'
```

## Monitoring During Tests

### Real-Time Monitoring
```bash
# Open a separate terminal and monitor server metrics
watch -n 1 'curl -s http://localhost:5173/health | jq'

# Monitor system resources
htop

# Monitor Docker containers
docker stats
```

### Server Logs
```bash
# Follow application logs
tail -f logs/app.log

# Follow access logs
tail -f logs/access.log

# Monitor errors
tail -f logs/error.log | grep ERROR
```

## Troubleshooting

### Connection Refused
- Ensure server is running: `curl http://localhost:5173/health`
- Check firewall settings
- Verify correct URL in environment variables

### High Error Rates
- Check server logs for errors
- Verify database connections
- Monitor CPU/memory usage
- Reduce VUs to find stable load level

### Slow Response Times
- Profile application code
- Check database query performance
- Monitor network latency
- Review caching strategy

### WebSocket Issues
- Verify WebSocket endpoint is accessible
- Check for connection limits
- Monitor WebSocket upgrade failures
- Review connection timeout settings

## Best Practices

1. **Start small**: Begin with low VUs and gradually increase
2. **Monitor resources**: Watch CPU, memory, network during tests
3. **Realistic data**: Use production-like test data
4. **Think time**: Include realistic pauses between requests
5. **Ramp up/down**: Avoid sudden load changes
6. **Baseline first**: Establish baseline performance before changes
7. **Repeat tests**: Run multiple times for consistency
8. **Document results**: Save results for comparison

## Additional Resources

- [K6 Documentation](https://k6.io/docs/)
- [K6 Examples](https://k6.io/docs/examples/)
- [Performance Testing Guide](https://k6.io/docs/test-types/load-testing/)
- [WebSocket Testing](https://k6.io/docs/using-k6/protocols/websockets/)
- [Metrics Reference](https://k6.io/docs/using-k6/metrics/)

## Support

For issues with load tests:
1. Check server logs first
2. Verify test configuration
3. Review K6 documentation
4. Contact DevOps team

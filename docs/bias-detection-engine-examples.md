# Bias Detection Engine Code Examples & Integration Tutorial

## TypeScript Integration Example

```typescript
import { 
  BiasDetectionEngine,
  PythonBiasDetectionBridge,
  BiasMetricsCollector,
  BiasAlertSystem 
} from '@/lib/ai/bias-detection';

// Initialize the main engine with custom thresholds and options
const biasEngine = new BiasDetectionEngine({
  thresholds: {
    warningLevel: 0.3,
    highLevel: 0.6,
    criticalLevel: 0.8
  },
  hipaaCompliant: true,
  auditLogging: true
});

// Initialize the engine (loads config, connects to backend)
await biasEngine.initialize();

// Analyze a session for bias
const result = await biasEngine.analyzeSession(sessionData);
console.log('Bias Score:', result.overallBiasScore);
console.log('Alert Level:', result.alertLevel);

// Use advanced modules for metrics and alerts
const pythonBridge = new PythonBiasDetectionBridge('http://localhost:5000');
const metricsCollector = new BiasMetricsCollector(config, pythonBridge);
const alertSystem = new BiasAlertSystem(config, pythonBridge);

// Collect metrics
const metrics = await metricsCollector.collect(sessionId);

// Send bias alert
await alertSystem.sendAlert(sessionId, result.alertLevel);
```

## Python Backend Integration Example

```python
import requests

session_data = {
    "session_id": "session_12345",
    "participant_demographics": {
        "age": 28,
        "gender": "female",
        "ethnicity": "hispanic"
    },
    # ... other fields
}

# Call the Python bias detection service
response = requests.post(
    "http://localhost:5000/analyze",
    json=session_data,
    timeout=30
)

if response.ok:
    result = response.json()
    print("Bias Score:", result["overall_bias_score"])
    print("Alert Level:", result["alert_level"])
else:
    print("Error:", response.text)
```

## Best Practices

- Always initialize the engine before analysis.
- Use strict TypeScript typing for configs and results.
- Handle errors and retries for backend service calls.
- Update configuration and thresholds as needed for your deployment.
- For advanced scenarios, use metrics and alert modules for monitoring and reporting.

## References

- [Developer Setup Guide](./bias-detection-engine-setup.md)
- [API Documentation](./bias-detection-api.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

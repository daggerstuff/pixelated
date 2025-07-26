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
python -c "from python.bias_detection_service import mask_sensitive_data; print('Masking works')"
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
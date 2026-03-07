# Mental Health Analysis System

A production-grade mental health analysis and therapeutic response system for chat applications.

## Features

- **Real-time Analysis**: Analyzes user messages for mental health indicators
- **Risk Assessment**: Categorizes risk levels (low, medium, high, critical)
- **Crisis Detection**: Identifies crisis situations requiring immediate intervention
- **Therapeutic Responses**: Generates evidence-based therapeutic responses
- **Trend Analysis**: Tracks mental health trends over time
- **Configurable**: Adjustable thresholds and analysis parameters

## Components

### MentalHealthAnalyzer
Analyzes text for mental health indicators using keyword detection and pattern matching.

**Detected Conditions:**
- Depression
- Anxiety
- Stress
- Anger
- Social Isolation
- Crisis situations

### TherapeuticResponseGenerator
Generates therapeutic responses using evidence-based approaches:
- **Crisis**: Immediate safety and resource connection
- **Cognitive**: Thought challenging and restructuring
- **Behavioral**: Activity scheduling and goal setting
- **Supportive**: Active listening and validation

### MentalHealthService
Main orchestration service that:
- Processes chat messages
- Maintains conversation history
- Tracks analysis trends
- Determines intervention needs
- Generates therapeutic responses

## Usage

```typescript
import { MentalHealthService } from '@/lib/mental-health'

const service = new MentalHealthService({
  enableAnalysis: true,
  confidenceThreshold: 0.6,
  interventionThreshold: 0.7,
  analysisMinLength: 10,
  enableCrisisDetection: true
})

// Process a message
const result = await service.processMessage('conversation-id', {
  id: 'msg-1',
  role: 'user',
  content: 'I feel really depressed today',
  timestamp: Date.now()
})

// Generate therapeutic response
const response = await service.generateTherapeuticResponse('conversation-id')

// Check if intervention is needed
const needsHelp = service.needsIntervention('conversation-id')
```

## Configuration

- `enableAnalysis`: Enable/disable mental health analysis
- `confidenceThreshold`: Minimum confidence to show analysis results (0-1)
- `interventionThreshold`: Risk level that triggers intervention (0-1)
- `analysisMinLength`: Minimum message length to analyze
- `enableCrisisDetection`: Enable crisis situation detection

## Risk Levels

- **Low**: Normal conversation, no significant concerns
- **Medium**: Some mental health indicators present
- **High**: Multiple indicators or moderate severity
- **Critical**: Crisis indicators requiring immediate attention

## Crisis Resources

The system automatically provides crisis resources when critical situations are detected:
- National Suicide Prevention Lifeline: 988
- Crisis Text Line: Text HOME to 741741
- Emergency services: 911

## Privacy & Security

- No data is stored permanently
- Conversation history is limited (last 50 messages)
- Analysis history is limited (last 20 analyses)
- All processing happens locally

## Testing

Run tests with:
```bash
npm test src/lib/mental-health
```

## Limitations

- Rule-based analysis (not AI-powered in current implementation)
- English language only
- Not a replacement for professional mental health care
- Should be used as a supportive tool only
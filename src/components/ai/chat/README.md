# AI Chat Hooks

This directory contains a comprehensive suite of enhanced React hooks for AI-powered chat functionality. All hooks have been "beefed up" with advanced features including streaming, analytics, error handling, progress tracking, and more.

## Available Hooks

### 1. `useResponseGeneration`
Hook for generating AI responses with therapeutic capabilities.

**Key Features:**
- Streaming and non-streaming response generation
- Therapeutic response mode with intervention detection
- Batch response generation
- Progress tracking and analytics
- Advanced error handling with retry logic
- Request cancellation support
- Response insights and confidence scoring

### 2. `useChatCompletion`
Enhanced hook for managing complete chat conversations.

**Key Features:**
- Full conversation management
- Message editing, deletion, and resending
- Auto-save and persistence
- Token usage tracking and cost estimation
- Conversation statistics and analytics
- Export/import functionality
- Streaming and non-streaming modes
- Message history limitations
- Real-time typing indicators

### 3. `useSentimentAnalysis`
Hook for analyzing the emotional tone of messages.

**Key Features:**
- Single and batch sentiment analysis
- Streaming analysis for real-time feedback
- Confidence scoring and emotion detection
- Historical sentiment tracking
- Advanced analytics and insights
- Custom analysis parameters
- Error handling and retry logic

### 4. `useCrisisDetection`
Hook for detecting crisis situations and mental health emergencies.

**Key Features:**
- Real-time crisis detection
- Batch analysis capabilities
- Alert system with severity levels
- Streaming detection for immediate response
- Historical crisis tracking
- Analytics and pattern recognition
- Emergency intervention triggers
- Comprehensive reporting

## Common Enhanced Features

All hooks share these advanced capabilities:

### 🔄 Streaming Support
- Real-time data processing
- Progress tracking
- Cancellation support
- Chunk-by-chunk handling

### 📊 Analytics & Insights
- Performance metrics
- Usage statistics
- Confidence scoring
- Historical data tracking

### 🚨 Error Handling
- Retry logic with exponential backoff
- Graceful degradation
- Detailed error reporting
- Recovery mechanisms

### ⏱️ Progress Tracking
- Real-time progress indicators
- Estimated completion times
- Loading states
- Performance monitoring

### 🎛️ Advanced Configuration
- Customizable parameters
- Model selection
- Temperature control
- Token limits

## Usage Examples

### Basic Chat Completion
```typescript
import { useChatCompletion } from './useChatCompletion'

function ChatApp() {
  const {
    messages,
    isLoading,
    isStreaming,
    sendMessage,
    resetChat,
    exportConversation,
  } = useChatCompletion({
    streamingEnabled: true,
    autoSave: true,
    persistKey: 'my-chat',
  })

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{msg.content}</div>
      ))}
      <button onClick={() => sendMessage('Hello!')}>
        Send Message
      </button>
    </div>
  )
}
```

### Streaming Response Generation
```typescript
import { useResponseGeneration } from './useResponseGeneration'

function TherapyBot() {
  const {
    generateStreamingResponse,
    isStreaming,
    progress,
    stopGeneration,
  } = useResponseGeneration({
    onProgress: (chunk, accumulated) => {
      console.log('Received:', chunk)
    },
  })

  const handleGenerate = async () => {
    const generator = generateStreamingResponse('I feel anxious')
    for await (const chunk of generator) {
      // Handle each chunk as it arrives
      console.log(chunk)
    }
  }

  return (
    <div>
      <button onClick={handleGenerate}>Generate Response</button>
      {isStreaming && (
        <div>
          <div>Progress: {progress}%</div>
          <button onClick={stopGeneration}>Stop</button>
        </div>
      )}
    </div>
  )
}
```

### Sentiment Analysis with Analytics
```typescript
import { useSentimentAnalysis } from './useSentimentAnalysis'

function SentimentMonitor() {
  const {
    analyzeSentiment,
    result,
    analytics,
    isLoading,
  } = useSentimentAnalysis({
    trackHistory: true,
    generateInsights: true,
  })

  return (
    <div>
      <button onClick={() => analyzeSentiment('I love this!')}>
        Analyze Sentiment
      </button>
      {result && (
        <div>
          <div>Sentiment: {result.sentiment}</div>
          <div>Confidence: {result.confidence}</div>
          <div>Emotions: {result.emotions.join(', ')}</div>
        </div>
      )}
      {analytics && (
        <div>
          <div>Total Analyses: {analytics.totalAnalyses}</div>
          <div>Avg Confidence: {analytics.averageConfidence}</div>
        </div>
      )}
    </div>
  )
}
```

### Crisis Detection with Alerts
```typescript
import { useCrisisDetection } from './useCrisisDetection'

function CrisisMonitor() {
  const {
    detectCrisis,
    result,
    alerts,
    isLoading,
  } = useCrisisDetection({
    enableAlerts: true,
    alertThreshold: 0.7,
    onCrisisDetected: (result) => {
      console.log('Crisis detected!', result)
    },
  })

  return (
    <div>
      <button onClick={() => detectCrisis('I want to hurt myself')}>
        Check for Crisis
      </button>
      {result && (
        <div>
          <div>Risk Level: {result.riskLevel}</div>
          <div>Confidence: {result.confidence}</div>
          <div>Interventions: {result.recommendedInterventions.join(', ')}</div>
        </div>
      )}
      {alerts.length > 0 && (
        <div className="alerts">
          {alerts.map((alert, i) => (
            <div key={i} className={`alert-${alert.severity}`}>
              {alert.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

## Demo Components

- `ResponseGenerationExample` - Interactive demo of response generation features
- `ChatCompletionExample` - Full-featured chat interface demo

## Configuration Options

### Common Options (Available in all hooks)
- `maxRetries` - Number of retry attempts for failed requests
- `timeout` - Request timeout in milliseconds
- `onError` - Error handling callback
- `streamingEnabled` - Enable/disable streaming mode
- `apiEndpoint` - Custom API endpoint
- `model` - AI model selection

### Specialized Options
Each hook also supports specific configuration options tailored to its functionality.

## Error Handling

All hooks implement robust error handling:
- Automatic retry with exponential backoff
- Network error detection
- Rate limit handling
- Graceful degradation
- Detailed error reporting

## Performance Optimization

- Request deduplication
- Intelligent caching
- Memory management
- Background processing
- Progressive loading

## Best Practices

1. **Always handle errors** - Use the `error` state and `onError` callback
2. **Implement loading states** - Show progress indicators during operations
3. **Use streaming for long responses** - Better user experience
4. **Persist important data** - Use auto-save features for conversations
5. **Monitor usage** - Track token usage and costs
6. **Implement cancellation** - Allow users to stop long-running operations

## Type Safety

All hooks are fully typed with TypeScript, providing:
- Complete type inference
- Runtime type checking
- IDE autocomplete support
- Compile-time error detection

---
title: 'AI Development Guide'
description: 'AI Development Guide documentation'
pubDate: 2024-01-15
author: 'Pixelated Team'
tags: ['documentation']
draft: false
toc: true
---

## AI Development Guide

This guide provides comprehensive information for developers working with the AI components in the application.

## Overview

The AI system is designed to be modular, extensible, and secure. It provides a unified interface for interacting with various AI providers and includes specialized services for common AI tasks.

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- Astro 4.0+
- TypeScript 5.0+
- API keys for supported AI providers (OpenAI, Anthropic)

### Environment Setup

1. Set up the required environment variables in your `.env.local` file:

```bash
# OpenAI
OPENAI_$1=YOUR_API_KEY_HERE
OPENAI_BASE_URL=https://api.openai.com/v1

# Anthropic
$1=YOUR_API_KEY_HERE
ANTHROPIC_BASE_URL=https://api.anthropic.com

# AI Settings
DEFAULT_AI_PROVIDER=openai
DEFAULT_AI_MODEL=gpt-4o
ENABLE_AI_CACHING=true
CACHE_TTL=3600
```

2. Install the required dependencies:

```bash
pnpm install --no-frozen-lockfile
```

3. Start the development server:

```bash
pnpm dev
```

## Architecture

The AI system follows a layered architecture:

1. **API Layer**: RESTful endpoints for accessing AI capabilities
2. **Services Layer**: Specialized services for common AI tasks
3. **Provider Layer**: Unified interface for interacting with AI providers
4. **Cross-cutting Concerns**: Error handling, performance optimization, audit logging

### Directory Structure

```
src/lib/ai/
├── index.ts                # Main exports
├── factory.ts              # AI service factory
├── error-handling.ts       # Error handling utilities
├── performance.ts          # Performance optimization utilities
├── analytics.ts            # Usage analytics
├── providers/
│   ├── index.ts            # Provider exports
│   ├── openai.ts           # OpenAI provider
│   └── anthropic.ts        # Anthropic provider
├── services/
│   ├── index.ts            # Service exports
│   ├── sentiment.ts        # Sentiment analysis service
│   ├── crisis.ts           # Crisis detection service
│   ├── response.ts         # Response generation service
│   └── intervention.ts     # Intervention analysis service
└── models/
    ├── index.ts            # Model exports
    ├── messages.ts         # Message types
    ├── completion.ts       # Completion types
    └── errors.ts           # Error types
```

## Core Concepts

### AI Service

The `AIService` interface defines the core functionality for interacting with AI providers:

```typescript
interface AIService {
  createChatCompletion(
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AICompletion>

  createStreamingChatCompletion(
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AIStreamingCompletion>

  getModelInfo(model: string): ModelInfo
}
```

### AI Provider

The `AIProvider` interface defines the functionality for specific AI providers:

```typescript
interface AIProvider {
  createChatCompletion(
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AICompletion>

  createStreamingChatCompletion(
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AIStreamingCompletion>

  getModelInfo(model: string): ModelInfo

  getSupportedModels(): string[]
}
```

### AI Message

The `AIMessage` interface defines the structure of messages in a conversation:

```typescript
interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}
```

### AI Completion

The `AICompletion` interface defines the structure of AI completions:

```typescript
interface AICompletion {
  content: string
  model: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}
```

### AI Error

The `AIError` class provides standardized error handling:

```typescript
class AIError extends Error {
  code: AIErrorCode
  statusCode: number
  context?: Record<string, any>
  cause?: Error

  constructor(message: string, options: AIErrorOptions)
}
```

## Using the AI Service

### Creating an AI Service

Use the `createAIService` factory function to create an AI service:

```typescript

const aiService = createAIService({
  provider: 'openai', // or 'anthropic'
  enableErrorHandling: true,
  enablePerformanceOptimization: true,
})
```

### Creating a Chat Completion

Use the `createChatCompletion` method to generate a completion:

```typescript
const completion = await aiService.createChatCompletion(
  [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello, how are you?' },
  ],
  { model: 'gpt-4o' },
)

console.log(completion.content)
```

### Creating a Streaming Chat Completion

Use the `createStreamingChatCompletion` method to generate a streaming completion:

```typescript
const { stream } = await aiService.createStreamingChatCompletion(
  [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello, how are you?' },
  ],
  { model: 'gpt-4o' },
)

for await (const chunk of stream) {
  process.stdout.write(chunk.content)
}
```

## Using Specialized Services

### Sentiment Analysis

Use the `SentimentAnalysisService` to analyze the sentiment of text:

```typescript

const aiService = createAIService()
const sentimentService = new SentimentAnalysisService({ aiService })

const result = await sentimentService.analyzeSentiment(
  'I am feeling great today!',
)
// { sentiment: 'positive', score: 0.85, explanation: '...', model: '...', processingTime: 123 }
```

### Crisis Detection

Use the `CrisisDetectionService` to detect potential crisis situations:

```typescript

const aiService = createAIService()
const crisisService = new CrisisDetectionService({ aiService })

const result = await crisisService.detectCrisis(
  'I am feeling really down lately.',
)
// { is_crisis: true, risk_level: 'low', crisis_type: 'depression', confidence: 0.65, ... }
```

### Response Generation

Use the `ResponseGenerationService` to generate therapeutic responses:

```typescript

const aiService = createAIService()
const responseService = new ResponseGenerationService({ aiService })

const result = await responseService.generateResponse([
  { role: 'user', content: 'Hello, how are you?' },
])
// { response: 'I am doing well, thank you!', model: '...', processingTime: 123 }
```

### Intervention Analysis

Use the `InterventionAnalysisService` to analyze the effectiveness of interventions:

```typescript

const aiService = createAIService()
const interventionService = new InterventionAnalysisService({ aiService })

const result = await interventionService.analyzeIntervention(
  conversation,
  interventionMessage,
  userResponse,
)
// { effectiveness_score: 8, user_receptiveness: 'high', emotional_impact: 'positive', ... }
```

## Error Handling

### Handling AI Errors

Use try-catch blocks to handle AI errors:

```typescript

const aiService = createAIService()

try {
  const completion = await aiService.createChatCompletion(
    [{ role: 'user', content: 'Hello, how are you?' }],
    { model: 'invalid-model' },
  )
} catch (error) {
  if (error instanceof AIError && error.code === AIErrorCodes.INVALID_MODEL) {
    console.error('Invalid model specified')
  } else {
    console.error('An unexpected error occurred:', error)
  }
}
```

### Using the Error Handling Utilities

Use the error handling utilities for more advanced error handling:

```typescript

try {
  // Call AI service
} catch (error) {
  const aiError = handleAIServiceError(error, { model: 'gpt-4o' })
  console.error(`AI Error: ${aiError.message} (${aiError.code})`)
}
```

### API Error Handling

Use the API error handling utility in API routes:

```typescript

  try {
    // API route logic
    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
```

## Performance Optimization

### Using the Optimized AI Service

Use the optimized AI service wrapper for better performance:

```typescript

const optimizedService = createOptimizedAIService(aiService, {
  logToConsole: true,
  createAuditLogs: true,
  slowRequestThreshold: 3000,
  highTokenUsageThreshold: 1000,
})
```

### Token Usage Optimization

Use the token optimization utilities to manage token usage:

```typescript

const tokenCount = estimateMessagesTokenCount(messages)
console.log(`Estimated token count: ${tokenCount}`)

const truncatedMessages = truncateMessages(messages, 4000, 1000)
```

### Retry with Exponential Backoff

Use the retry utility for handling transient errors:

```typescript

const completion = await withRetry(
  () =>
    aiService.createChatCompletion(
      [{ role: 'user', content: 'Hello, how are you?' }],
      { model: 'gpt-4o' },
    ),
  {
    maxRetries: 3,
    initialDelay: 500,
    maxDelay: 10000,
    factor: 2,
  },
)
```

## API Routes

### Chat Completion API

Create a chat completion API route:

```typescript
// src/pages/api/ai/completion.ts

  try {
    const { messages, model, temperature, max_tokens, provider } =
      await request.json()

    const aiService = createAIService({ provider })

    const completion = await aiService.createChatCompletion(messages, {
      model,
      temperature,
      max_tokens,
    })

    return new Response(JSON.stringify({ completion }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
```

### Streaming Chat Completion API

Create a streaming chat completion API route:

```typescript
// src/pages/api/ai/completion/stream.ts

  try {
    const { messages, model, temperature, max_tokens, provider } =
      await request.json()

    const aiService = createAIService({ provider })

    const { stream } = await aiService.createStreamingChatCompletion(messages, {
      model,
      temperature,
      max_tokens,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const event = `event: completion\ndata: ${JSON.stringify({ content: chunk.content, model })}\n\n`
            controller.enqueue(encoder.encode(event))
          }
          controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'))
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
```

## Testing

### Unit Testing

Use Vitest for unit testing AI components:

```typescript
// src/lib/ai/services/sentiment.test.ts

test('analyzeSentiment returns correct sentiment analysis', async () => {
  // Mock AI service
  const mockAIService = {
    createChatCompletion: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        sentiment: 'positive',
        score: 0.85,
        explanation: 'The text expresses positive emotions.',
      }),
      model: 'gpt-4o',
    }),
  }

  const sentimentService = new SentimentAnalysisService({
    aiService: mockAIService,
  })

  const result = await sentimentService.analyzeSentiment(
    'I am feeling great today!',
  )

  expect(result.sentiment).toBe('positive')
  expect(result.score).toBe(0.85)
  expect(result.explanation).toBe('The text expresses positive emotions.')
  expect(result.model).toBe('gpt-4o')
  expect(result.processingTime).toBeGreaterThan(0)
})
```

### Integration Testing

Use Vitest for integration testing AI components:

```typescript
// src/lib/ai/integration.test.ts

test('SentimentAnalysisService integrates with AIService', async () => {
  // Skip test if no API key is available
  if (!process.env.OPENAI_API_KEY) {
    console.log('Skipping test: No OpenAI API key available')
    return
  }

  const aiService = createAIService({ provider: 'openai' })
  const sentimentService = new SentimentAnalysisService({ aiService })

  const result = await sentimentService.analyzeSentiment(
    'I am feeling great today!',
  )

  expect(result.sentiment).toBe('positive')
  expect(result.score).toBeGreaterThan(0.5)
  expect(result.explanation).toBeTruthy()
  expect(result.model).toBeTruthy()
  expect(result.processingTime).toBeGreaterThan(0)
})
```

### Mocking AI Providers

Use mocks for testing without API calls:

```typescript
// src/lib/ai/mocks/openai.ts

  async createChatCompletion(
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AICompletion> {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 100))

    const lastMessage = messages[messages.length - 1]

    return {
      content: `Mock response to: ${lastMessage.content}`,
      model: options?.model || 'gpt-4o',
      usage: {
        prompt_tokens: messages.reduce(
          (acc, msg) => acc + msg.content.length / 4,
          0,
        ),
        completion_tokens: 20,
        total_tokens:
          messages.reduce((acc, msg) => acc + msg.content.length / 4, 0) + 20,
      },
    }
  }

  // Implement other methods...
}
```

## Best Practices

### Error Handling

- Always use try-catch blocks around AI service calls
- Use the standardized AIError class for error handling
- Implement retry mechanisms for transient errors
- Log all errors for debugging and monitoring

### Performance Optimization

- Use response caching for frequently used prompts
- Implement token usage optimization to reduce costs
- Set appropriate timeouts for AI service calls
- Monitor performance metrics to identify bottlenecks

### Security

- Never expose API keys in client-side code
- Validate and sanitize all user input
- Implement rate limiting to prevent abuse
- Use HIPAA-compliant audit logging for all AI operations

### Prompt Engineering

- Use clear and specific system prompts
- Structure user prompts for consistent results
- Include examples for complex tasks
- Test prompts with different inputs to ensure robustness

### Testing

- Write unit tests for all AI services
- Use mocks to avoid API calls in tests
- Implement integration tests for critical paths
- Test error handling and edge cases

## Extending the System

### Adding a New Provider

To add a new AI provider:

1. Create a new provider class in `src/lib/ai/providers/`:

```typescript
// src/lib/ai/providers/gemini.ts
  AICompletion,
  AIMessage,
  AIServiceOptions,
  AIStreamingCompletion,
} from '../models'

  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async createChatCompletion(
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AICompletion> {
    // Implementation for Gemini API
  }

  async createStreamingChatCompletion(
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AIStreamingCompletion> {
    // Implementation for Gemini API streaming
  }

  getModelInfo(model: string): ModelInfo {
    // Return model info for Gemini models
  }

  getSupportedModels(): string[] {
    // Return list of supported Gemini models
  }
}
```

2. Update the provider factory in `src/lib/ai/factory.ts`:

```typescript

  const provider =
    options?.provider || process.env.DEFAULT_AI_PROVIDER || 'openai'

  let aiProvider: AIProvider

  switch (provider) {
    case 'openai':
      aiProvider = new OpenAIProvider(process.env.OPENAI_API_KEY!)
      break
    case 'anthropic':
      aiProvider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY!)
      break
    case 'gemini':
      aiProvider = new GeminiProvider(process.env.GEMINI_API_KEY!)
      break
    default:
      throw new AIError(`Unsupported provider: ${provider}`, {
        code: AIErrorCodes.INVALID_PROVIDER,
        statusCode: 400,
      })
  }

  // Apply wrappers
  // ...
}
```

### Adding a New Service

To add a new specialized service:

1. Create a new service class in `src/lib/ai/services/`:

```typescript
// src/lib/ai/services/summarization.ts

  maxLength?: number
  format?: 'bullet' | 'paragraph'
}

  summary: string
  key_points: string[]
  model: string
  processingTime: number
}

  private aiService: AIService

  constructor(options: { aiService: AIService }) {
    this.aiService = options.aiService
  }

  async summarizeText(
    text: string,
    options?: SummarizationOptions,
  ): Promise<SummarizationResult> {
    const startTime = Date.now()

    // Implementation for text summarization

    return {
      summary,
      key_points,
      model,
      processingTime: Date.now() - startTime,
    }
  }
}
```

2. Export the new service in `src/lib/ai/services/index.ts`:

```typescript
```

3. Update the main exports in `src/lib/ai/index.ts`:

```typescript
```

## Troubleshooting

### Common Issues

#### API Key Issues

If you encounter API key issues:

1. Check that the API key is correctly set in your `.env.local` file
2. Verify that the API key has the necessary permissions
3. Check for any billing issues with the AI provider
4. Try using a different API key to isolate the issue

#### Rate Limiting

If you encounter rate limiting issues:

1. Implement exponential backoff with the retry utility
2. Reduce the frequency of API calls
3. Use caching to reduce the number of API calls
4. Consider upgrading your API tier for higher rate limits

#### Token Limits

If you encounter token limit issues:

1. Use the token estimation utility to check token counts
2. Implement message truncation for long conversations
3. Split large requests into smaller chunks
4. Use more efficient prompts to reduce token usage

#### Performance Issues

If you encounter performance issues:

1. Enable response caching for frequently used prompts
2. Monitor performance metrics to identify bottlenecks
3. Use streaming for long responses to improve perceived performance
4. Consider using a different model or provider for better performance

### Debugging

#### Logging

Enable detailed logging for debugging:

```typescript
const aiService = createAIService({
  provider: 'openai',
  enableErrorHandling: true,
  enablePerformanceOptimization: true,
  logLevel: 'debug',
})
```

#### Request Tracing

Implement request tracing for complex issues:

```typescript

const aiService = createAIService()
const tracedService = withTracing(aiService, {
  logRequests: true,
  logResponses: true,
  logErrors: true,
})
```

#### Error Context

Add context to errors for better debugging:

```typescript
try {
  // AI service call
} catch (error) {
  throw new AIError('Failed to process request', {
    code: AIErrorCodes.INTERNAL_ERROR,
    statusCode: 500,
    context: {
      operation: 'sentiment-analysis',
      input: text,
      timestamp: new Date().toISOString(),
    },
    cause: error,
  })
}
```

## Resources

### Documentation

- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [Anthropic API Documentation](https://docs.anthropic.com/claude/reference)
- [Astro Documentation](https://docs.astro.build)

### Community

- [GitHub Repository](https://github.com/your-org/your-repo)
- [Discord Community](https://discord.gg/your-community)
- [Stack Overflow Tag](https://stackoverflow.com/questions/tagged/your-tag)

### Support

- [Issue Tracker](https://github.com/your-org/your-repo/issues)
- [Email Support](mailto:support@your-org.com)
- [Documentation Feedback](https://github.com/your-org/your-repo/discussions)

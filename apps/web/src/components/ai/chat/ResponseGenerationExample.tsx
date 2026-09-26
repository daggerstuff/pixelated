import { useState } from 'react'

import { useResponseGeneration } from './useResponseGeneration'

/**
 * Example component demonstrating useResponseGeneration hook
 */
export function ResponseGenerationExample() {
  const [prompt, setPrompt] = useState('')
  const [responseType, setResponseType] = useState<
    'general' | 'therapeutic' | 'creative' | 'analytical'
  >('general')

  const {
    response,
    isLoading,
    isStreaming,
    error,
    progress,
    therapeuticInsights,
    generateResponse,
    generateTherapeuticResponse,
    generateStreamingResponse,
    regenerateLastResponse,
    stopGeneration,
    reset,
  } = useResponseGeneration({
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 1024,
    responseType,
    streamingEnabled: true,
    onProgress: (chunk, accumulated) => {
      console.log('Streaming chunk:', chunk)
      console.log('Accumulated response length:', accumulated.length)
    },
    onComplete: (finalResponse) => {
      console.log(
        'Response completed:',
        finalResponse.substring(0, 100) + '...',
      )
    },
    onTherapeuticInsights: (insights) => {
      console.log('Therapeutic insights:', insights)
    },
    onError: (error) => {
      console.error('Response generation error:', error)
    },
  })

  const handleGenerateResponse = async () => {
    if (!prompt.trim()) {
      return
    }

    if (responseType === 'therapeutic') {
      await generateTherapeuticResponse(prompt, {
        sessionId: 'demo-session',
        userId: 'demo-user',
        context: 'example-usage',
      })
    } else {
      await generateResponse(prompt)
    }
  }

  const handleStreamingResponse = async () => {
    if (!prompt.trim()) {
      return
    }

    const generator = generateStreamingResponse(prompt)

    // Example of consuming the streaming response
    for await (const chunk of generator) {
      // Each chunk is automatically handled by the hook
      // You can add custom logic here if needed
      console.log('Received chunk:', chunk)
    }
  }

  return (
    <div className='mx-auto max-w-4xl space-y-6 p-6'>
      <h2 className='text-foreground text-2xl font-bold'>
        AI Response Generation Demo
      </h2>

      {/* Input Section */}
      <div className='space-y-4'>
        <div>
          <label
            htmlFor='prompt'
            className='text-foreground block text-sm font-medium'
          >
            Enter your prompt:
          </label>
          <textarea
            id='prompt'
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className='border-input focus:ring-ring focus:border-ring mt-1 block w-full rounded-none border px-3 py-2 focus:outline-none'
            rows={3}
            placeholder='Type your prompt here...'
          />
        </div>

        <div>
          <label
            htmlFor='responseType'
            className='text-foreground block text-sm font-medium'
          >
            Response Type:
          </label>
          <select
            id='responseType'
            value={responseType}
            onChange={(e) =>
              setResponseType(e.target.value as typeof responseType)
            }
            className='border-input focus:ring-ring focus:border-ring mt-1 block w-full rounded-none border px-3 py-2 focus:outline-none'
          >
            <option value='general'>General</option>
            <option value='therapeutic'>Therapeutic</option>
            <option value='creative'>Creative</option>
            <option value='analytical'>Analytical</option>
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className='flex space-x-4'>
        <button
          onClick={handleGenerateResponse}
          disabled={isLoading || !prompt.trim()}
          className='bg-primary text-primary-foreground hover:bg-accent rounded-none px-4 py-2 disabled:cursor-not-allowed disabled:opacity-35'
        >
          {isLoading ? 'Generating...' : 'Generate Response'}
        </button>

        <button
          onClick={handleStreamingResponse}
          disabled={isLoading || !prompt.trim()}
          className='bg-secondary border border-input text-foreground hover:bg-accent rounded-none px-4 py-2 disabled:cursor-not-allowed disabled:opacity-35'
        >
          {isStreaming ? 'Streaming...' : 'Stream Response'}
        </button>

        <button
          onClick={regenerateLastResponse}
          disabled={isLoading}
          className='bg-secondary border border-input text-foreground hover:bg-accent rounded-none px-4 py-2 disabled:cursor-not-allowed disabled:opacity-35'
        >
          Regenerate
        </button>

        {(isLoading || isStreaming) && (
          <button
            onClick={stopGeneration}
            className='bg-secondary border border-ring text-foreground font-semibold hover:bg-accent rounded-none px-4 py-2'
          >
            Stop
          </button>
        )}

        <button
          onClick={reset}
          className='bg-secondary border border-border text-muted-foreground hover:bg-accent rounded-none px-4 py-2'
        >
          Reset
        </button>
      </div>

      {/* Progress Bar */}
      {(isLoading || isStreaming) && (
        <div className='bg-secondary h-2 w-full rounded-none'>
          <div
            className='bg-primary h-2 rounded-none transition-all duration-300'
            style={{ width: `${progress}%` }}
          />
          <div className='text-muted-foreground mt-1 text-xs'>
            {isStreaming ? 'Streaming' : 'Loading'}: {Math.round(progress)}%
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className='bg-secondary border-ring rounded-none border p-4'>
          <div className='flex'>
            <div className='text-foreground'>
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      )}

      {/* Response Display */}
      {response && (
        <div className='bg-secondary border-border rounded-none border p-4'>
          <h3 className='text-foreground mb-2 text-lg font-medium'>
            Generated Response:
          </h3>
          <div className='text-foreground whitespace-pre-wrap'>{response}</div>
        </div>
      )}

      {/* Therapeutic Insights */}
      {therapeuticInsights && (
        <div className='bg-secondary border-input rounded-none border p-4'>
          <h3 className='text-foreground mb-2 text-lg font-medium'>
            Therapeutic Insights:
          </h3>
          <div className='text-foreground space-y-2 text-sm'>
            <div>
              <strong>Confidence:</strong>{' '}
              {Math.round(therapeuticInsights.confidence * 100)}%
            </div>
            {therapeuticInsights.intervention && (
              <div className='text-foreground font-semibold'>
                <strong>⚠️ Intervention Recommended</strong>
              </div>
            )}
            {therapeuticInsights.techniques &&
              therapeuticInsights.techniques.length > 0 && (
                <div>
                  <strong>Techniques:</strong>{' '}
                  {therapeuticInsights.techniques.join(', ')}
                </div>
              )}
            {therapeuticInsights.usage && (
              <div>
                <strong>Token Usage:</strong>{' '}
                {therapeuticInsights.usage.totalTokens} tokens
              </div>
            )}
          </div>
        </div>
      )}

      {/* Usage Instructions */}
      <div className='bg-secondary border-border rounded-none border p-4'>
        <h3 className='text-foreground mb-2 text-lg font-medium'>
          How to Use:
        </h3>
        <ul className='text-muted-foreground list-inside list-disc space-y-1 text-sm'>
          <li>
            <strong>General:</strong> For everyday AI assistance and questions
          </li>
          <li>
            <strong>Therapeutic:</strong> For mental health support with
            specialized insights
          </li>
          <li>
            <strong>Creative:</strong> For imaginative and artistic content
            generation
          </li>
          <li>
            <strong>Analytical:</strong> For data-driven and logical responses
          </li>
          <li>
            <strong>Streaming:</strong> Watch responses appear in real-time as
            they&apos;re generated
          </li>
          <li>
            <strong>Regenerate:</strong> Create a new response using the same
            prompt
          </li>
        </ul>
      </div>
    </div>
  )
}

export default ResponseGenerationExample

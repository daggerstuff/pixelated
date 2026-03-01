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
      <h2 className='text-gray-900 text-2xl font-bold'>
        AI Response Generation Demo
      </h2>

      {/* Input Section */}
      <div className='space-y-4'>
        <div>
          <label
            htmlFor='prompt'
            className='text-gray-700 block text-sm font-medium'
          >
            Enter your prompt:
          </label>
          <textarea
            id='prompt'
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className='border-gray-300 focus:ring-blue-500 focus:border-blue-500 mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none'
            rows={3}
            placeholder='Type your prompt here...'
          />
        </div>

        <div>
          <label
            htmlFor='responseType'
            className='text-gray-700 block text-sm font-medium'
          >
            Response Type:
          </label>
          <select
            id='responseType'
            value={responseType}
            onChange={(e) =>
              setResponseType(e.target.value as typeof responseType)
            }
            className='border-gray-300 focus:ring-blue-500 focus:border-blue-500 mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none'
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
          className='bg-blue-600 text-white hover:bg-blue-700 rounded-md px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50'
        >
          {isLoading ? 'Generating...' : 'Generate Response'}
        </button>

        <button
          onClick={handleStreamingResponse}
          disabled={isLoading || !prompt.trim()}
          className='bg-green-600 text-white hover:bg-green-700 rounded-md px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50'
        >
          {isStreaming ? 'Streaming...' : 'Stream Response'}
        </button>

        <button
          onClick={regenerateLastResponse}
          disabled={isLoading}
          className='bg-purple-600 text-white hover:bg-purple-700 rounded-md px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50'
        >
          Regenerate
        </button>

        {(isLoading || isStreaming) && (
          <button
            onClick={stopGeneration}
            className='bg-red-600 text-white hover:bg-red-700 rounded-md px-4 py-2'
          >
            Stop
          </button>
        )}

        <button
          onClick={reset}
          className='bg-gray-600 text-white hover:bg-gray-700 rounded-md px-4 py-2'
        >
          Reset
        </button>
      </div>

      {/* Progress Bar */}
      {(isLoading || isStreaming) && (
        <div className='bg-gray-200 h-2 w-full rounded-full'>
          <div
            className='bg-blue-600 h-2 rounded-full transition-all duration-300'
            style={{ width: `${progress}%` }}
          />
          <div className='text-gray-600 mt-1 text-xs'>
            {isStreaming ? 'Streaming' : 'Loading'}: {Math.round(progress)}%
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className='bg-red-50 border-red-200 rounded-md border p-4'>
          <div className='flex'>
            <div className='text-red-800'>
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      )}

      {/* Response Display */}
      {response && (
        <div className='bg-gray-50 border-gray-200 rounded-md border p-4'>
          <h3 className='text-gray-900 mb-2 text-lg font-medium'>
            Generated Response:
          </h3>
          <div className='text-gray-700 whitespace-pre-wrap'>{response}</div>
        </div>
      )}

      {/* Therapeutic Insights */}
      {therapeuticInsights && (
        <div className='bg-blue-50 border-blue-200 rounded-md border p-4'>
          <h3 className='text-blue-900 mb-2 text-lg font-medium'>
            Therapeutic Insights:
          </h3>
          <div className='text-blue-800 space-y-2 text-sm'>
            <div>
              <strong>Confidence:</strong>{' '}
              {Math.round(therapeuticInsights.confidence * 100)}%
            </div>
            {therapeuticInsights.intervention && (
              <div className='text-red-600'>
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
      <div className='bg-yellow-50 border-yellow-200 rounded-md border p-4'>
        <h3 className='text-yellow-900 mb-2 text-lg font-medium'>
          How to Use:
        </h3>
        <ul className='text-yellow-800 list-inside list-disc space-y-1 text-sm'>
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

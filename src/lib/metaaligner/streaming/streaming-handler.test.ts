/**
 * @module streaming-handler.test
 * @description This module provides tests for the StreamingHandler.
 */

import { vi } from 'vitest'
import { StreamingHandler } from './streaming-handler'
import type {
  IUnifiedMetaAlignerAPI,
  UnifiedProcessingRequest,
  UnifiedProcessingResponse,
} from '../api/unified-api'

describe('StreamingHandler', () => {
  let api: IUnifiedMetaAlignerAPI
  let handler: StreamingHandler

  beforeEach(() => {
    api = {
      process: vi.fn(),
    }
    handler = new StreamingHandler(api)
  })

  it('should process a stream of chunks', async () => {
    const request: UnifiedProcessingRequest = {
      llmOutput: { content: 'This is a test response' },
      context: { userQuery: 'test' },
    }
    const response: UnifiedProcessingResponse = {
      enhancedResponse: 'This is a test response',
      originalResponse: 'This is a test response',
      alignment: {} as any,
    }
    ;(api.process as any).mockResolvedValue(response)

    const onChunk = vi.fn()
    const onError = vi.fn()

    await handler.processStream(request, onChunk, onError)

    expect(onChunk).toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('should handle errors during streaming', async () => {
    const request: UnifiedProcessingRequest = {
      llmOutput: { content: 'This is a test response' },
      context: { userQuery: 'test' },
    }
    const error = new Error('Test error')
    ;(api.process as any).mockRejectedValue(error)

    const onChunk = vi.fn()
    const onError = vi.fn()

    await handler.processStream(request, onChunk, onError)

    expect(onChunk).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(error)
  })
})

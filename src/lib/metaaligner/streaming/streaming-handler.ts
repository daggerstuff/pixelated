/**
 * @module streaming-handler
 * @description This module provides a streaming response handler for the MetaAligner pipeline.
 */

import type {
  UnifiedProcessingRequest,
  UnifiedProcessingResponse,
  IUnifiedMetaAlignerAPI,
} from '../api/unified-api'

/**
 * Defines the interface for the StreamingHandler.
 */
export interface IStreamingHandler {
  /**
   * Processes a streaming response.
   *
   * @param request - The processing request.
   * @param onChunk - A callback that is called with each processed chunk.
   * @returns A promise that resolves when the stream is fully processed.
   */
  processStream(
    request: UnifiedProcessingRequest,
    onChunk: (chunk: UnifiedProcessingResponse) => void,
  ): Promise<void>
}

/**
 * The StreamingHandler class.
 */
export class StreamingHandler implements IStreamingHandler {
  private api: IUnifiedMetaAlignerAPI
  private buffer: string[] = []
  private bufferSize: number

  constructor(api: IUnifiedMetaAlignerAPI, bufferSize = 5) {
    this.api = api
    this.bufferSize = bufferSize
  }

  public async processStream(
    request: UnifiedProcessingRequest,
    onChunk: (chunk: UnifiedProcessingResponse) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    try {
      // In a real-world scenario, you would get a stream from the API.
      // For now, we'll simulate a stream by splitting the response into chunks.
      const response = await this.api.process(request)
      const chunks = response.enhancedResponse.split(' ')

      for (const chunk of chunks) {
        this.buffer.push(chunk)
        if (this.buffer.length >= this.bufferSize) {
          const bufferedChunk = this.buffer.join(' ')
          this.buffer = []
          const chunkResponse: UnifiedProcessingResponse = {
            ...response,
            enhancedResponse: bufferedChunk,
          }
          onChunk(chunkResponse)
        }
        await new Promise((resolve) => setTimeout(resolve, 100)) // Simulate network latency
      }

      if (this.buffer.length > 0) {
        const bufferedChunk = this.buffer.join(' ')
        this.buffer = []
        const chunkResponse: UnifiedProcessingResponse = {
          ...response,
          enhancedResponse: bufferedChunk,
        }
        onChunk(chunkResponse)
      }
    } catch (error) {
      onError(error as Error)
    }
  }
}

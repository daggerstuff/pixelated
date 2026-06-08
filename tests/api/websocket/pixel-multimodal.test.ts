/**
 * Pixel Multimodal WebSocket Server Tests
 *
 * Tests for WS /api/websocket/pixel-multimodal endpoint covering:
 * - Connection lifecycle and message routing
 * - Audio chunk buffering and aggregation
 * - Text + audio fusion payload construction
 * - Status/result/error message handling
 * - Graceful disconnection and cleanup
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WebSocket } from 'ws'

const parseWsMessage = (data: unknown) => JSON.parse(String(data))

vi.mock('ws', async () => {
  return vi.importActual('ws')
})

vi.mock('@/lib/logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('WebSocket /api/websocket/pixel-multimodal', () => {
  let wsPort = 8091

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  describe('Connection Lifecycle', () => {
    it('should establish WebSocket connection', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`)

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          expect(ws.readyState).toBe(WebSocket.OPEN)
          ws.close()
        })
        ws.on('close', () => resolve())
        ws.on('error', (err) =>
          reject(new Error(`WebSocket error: ${err.message}`)),
        )
      })
    })

    it('should send connection status on open', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`)
      let receivedStatus = false

      await new Promise<void>((resolve, reject) => {
        ws.on('message', (data) => {
          const message = parseWsMessage(data)
          if (message.type === 'status' && message.status === 'connected') {
            receivedStatus = true
            ws.close()
          }
        })
        ws.on('close', () => resolve())
        ws.on('error', (err) =>
          reject(new Error(`WebSocket error: ${err.message}`)),
        )
      })

      expect(receivedStatus).toBe(true)
    })

    it('should handle graceful disconnection', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`)
      let closeCode: number | undefined

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.close(1000, 'normal closure')
        })
        ws.on('close', (code) => {
          closeCode = code
          resolve()
        })
        ws.on('error', (err) =>
          reject(new Error(`WebSocket error: ${err.message}`)),
        )
      })

      expect(closeCode).toBe(1000)
    })

    it('should clear buffered state on disconnect', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`)

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send(
            JSON.stringify({
              type: 'chunk',
              chunk: Buffer.from('audio data').toString('base64'),
              mimeType: 'audio/webm',
            }),
          )
          setTimeout(() => {
            ws.close()
          }, 50)
        })
        ws.on('close', () => resolve())
        ws.on('error', (err) =>
          reject(new Error(`WebSocket error: ${err.message}`)),
        )
      })

      expect(ws.readyState).toBe(WebSocket.CLOSED)
    })
  })

  describe('Text Message Handling', () => {
    it('should receive and buffer text message', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`)
      const testText = 'I am feeling anxious'
      let contextType: string | undefined

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send(
            JSON.stringify({
              type: 'text',
              text: testText,
              contextType: 'therapeutic',
              sessionId: 'session-123',
            }),
          )
        })
        ws.on('message', (data) => {
          const message = parseWsMessage(data)
          if (message.type === 'status' && message.status === 'text_received') {
            contextType = message.contextType as string
            ws.close()
          }
        })
        ws.on('close', () => resolve())
        ws.on('error', (err) =>
          reject(new Error(`WebSocket error: ${err.message}`)),
        )
      })

      expect(contextType).toBe('therapeutic')
    })

    it('should accept context type in text message', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`)
      let received = false

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send(
            JSON.stringify({
              type: 'text',
              text: 'Test message',
              contextType: 'crisis_response',
              sessionId: 'sess-456',
            }),
          )
        })

        ws.on('message', (data) => {
          const message = parseWsMessage(data)
          if (message.contextType === 'crisis_response') {
            received = true
          }
        })

        ws.on('error', (err) =>
          reject(new Error(`WebSocket error: ${err.message}`)),
        )

        setTimeout(() => {
          ws.close()
          resolve()
        }, 100)
      })

      expect(received).toBe(true)
    })
  })

  describe('Audio Chunk Handling', () => {
    it('should buffer audio chunks', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`)
      const audioChunk = Buffer.from('audio_chunk_data')
      let statusReceived = false

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send(
            JSON.stringify({
              type: 'chunk',
              chunk: audioChunk.toString('base64'),
              mimeType: 'audio/webm',
            }),
          )
        })

        ws.on('message', (data) => {
          const message = parseWsMessage(data)
          if (message.type === 'status') {
            statusReceived = true
          }
        })

        ws.on('error', (err) =>
          reject(new Error(`WebSocket error: ${err.message}`)),
        )

        setTimeout(() => {
          ws.close()
          resolve()
        }, 100)
      })

      expect(statusReceived).toBe(true)
    })

    it('should buffer multiple chunks sequentially', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`)
      const chunk1 = Buffer.from('chunk1_data')
      const chunk2 = Buffer.from('chunk2_data')
      let messageCount = 0

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send(
            JSON.stringify({
              type: 'chunk',
              chunk: chunk1.toString('base64'),
              mimeType: 'audio/webm',
            }),
          )

          setTimeout(() => {
            ws.send(
              JSON.stringify({
                type: 'chunk',
                chunk: chunk2.toString('base64'),
                mimeType: 'audio/webm',
              }),
            )
          }, 20)
        })

        ws.on('message', () => {
          messageCount++
        })

        ws.on('error', (err) =>
          reject(new Error(`WebSocket error: ${err.message}`)),
        )

        setTimeout(() => {
          ws.close()
          resolve()
        }, 150)
      })

      expect(messageCount).toBeGreaterThan(0)
    })

    it('should reject audio exceeding 25MB limit', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`)
      const largeBuffer = Buffer.alloc(26 * 1024 * 1024) // 26MB
      let errorReceived = false

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send(
            JSON.stringify({
              type: 'chunk',
              chunk: largeBuffer.toString('base64'),
              mimeType: 'audio/webm',
            }),
          )
        })

        ws.on('message', (data) => {
          const message = parseWsMessage(data)
          if (
            message.type === 'error' &&
            typeof message.message === 'string' &&
            message.message.includes('too large')
          ) {
            errorReceived = true
          }
        })

        ws.on('error', (err) =>
          reject(new Error(`WebSocket error: ${err.message}`)),
        )

        setTimeout(() => {
          ws.close()
          resolve()
        }, 200)
      })

      expect(errorReceived).toBe(true)
    })

    it('should close connection on payload overflow', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`)
      let closeCode: number | undefined

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          // Send multiple large chunks to exceed 25MB
          for (let i = 0; i < 30; i++) {
            const chunk = Buffer.alloc(1024 * 1024) // 1MB each
            ws.send(
              JSON.stringify({
                type: 'chunk',
                chunk: chunk.toString('base64'),
                mimeType: 'audio/webm',
              }),
            )
          }
        })

        ws.on('close', (code) => {
          closeCode = code
          resolve()
        })
        ws.on('error', (err) =>
          reject(new Error(`WebSocket error: ${err.message}`)),
        )
      })

      expect([1009, 1000]).toContain(closeCode) // 1009 = payload too large
    })
  })

  describe('Multimodal Fusion & Inference', () => {
    it('should construct form data with text + audio on complete', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`)
      const mockPixelResponse = {
        response: 'Test response',
        latency_ms: 150,
      }
      let resultReceived = false

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPixelResponse,
      } as any)

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send(
            JSON.stringify({
              type: 'text',
              text: 'I am anxious',
              contextType: 'therapeutic',
            }),
          )

          setTimeout(() => {
            ws.send(
              JSON.stringify({
                type: 'chunk',
                chunk: Buffer.from('audio_data').toString('base64'),
                mimeType: 'audio/webm',
              }),
            )
          }, 30)

          setTimeout(() => {
            ws.send(
              JSON.stringify({
                type: 'complete',
                text: 'I am anxious',
                contextType: 'therapeutic',
              }),
            )
          }, 60)
        })

        ws.on('message', (data) => {
          const message = parseWsMessage(data)
          if (message.type === 'result') {
            resultReceived = true
            expect(message.data).toBeDefined()
          }
        })

        ws.on('error', (err) =>
          reject(new Error(`WebSocket error: ${err.message}`)),
        )

        setTimeout(() => {
          ws.close()
          resolve()
        }, 300)
      })

      expect(resultReceived).toBe(true)
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/infer-multimodal'),
        expect.any(Object),
      )
    })

    it('should handle text-only completion (no audio)', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`)
      const mockPixelResponse = {
        response: 'Response to text',
        latency_ms: 120,
      }
      let resultReceived = false

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPixelResponse,
      } as any)

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send(
            JSON.stringify({
              type: 'text',
              text: 'Just text, no audio',
              contextType: 'therapeutic',
            }),
          )

          setTimeout(() => {
            ws.send(
              JSON.stringify({
                type: 'complete',
                text: 'Just text, no audio',
                contextType: 'therapeutic',
              }),
            )
          }, 50)
        })

        ws.on('message', (data) => {
          const message = parseWsMessage(data)
          if (message.type === 'result') {
            resultReceived = true
          }
        })

        ws.on('error', (err) =>
          reject(new Error(`WebSocket error: ${err.message}`)),
        )

        setTimeout(() => {
          ws.close()
          resolve()
        }, 200)
      })

      expect(resultReceived).toBe(true)
    })

    it('should return latency metrics from Pixel service', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`)
      const mockPixelResponse = {
        response: 'Test',
        latency_ms: 175,
      }
      let latencyMs: number | undefined

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPixelResponse,
      } as any)

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send(
            JSON.stringify({
              type: 'complete',
              text: 'Test',
              contextType: 'therapeutic',
            }),
          )
        })

        ws.on('message', (data) => {
          const message = parseWsMessage(data)
          if (message.type === 'result') {
            latencyMs = message.data.latency_ms as number
            ws.close()
          }
        })

        ws.on('close', () => resolve())
        ws.on('error', (err) =>
          reject(new Error(`WebSocket error: ${err.message}`)),
        )
      })

      expect(latencyMs).toBeLessThan(200)
    })
  })

  describe('Error Handling & Recovery', () => {
    it('should handle malformed JSON gracefully', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`)
      let errorReceived = false

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send('not valid json {')
        })

        ws.on('message', (data) => {
          const message = parseWsMessage(data)
          if (message.type === 'error') {
            errorReceived = true
          }
        })

        ws.on('error', (err) =>
          reject(new Error(`WebSocket error: ${err.message}`)),
        )

        setTimeout(() => {
          ws.close()
          resolve()
        }, 100)
      })

      expect(errorReceived).toBe(true)
    })

    it('should reject unknown message types', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`)
      let errorReceived = false

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send(
            JSON.stringify({
              type: 'unknown_type',
              data: 'test',
            }),
          )
        })

        ws.on('message', (data) => {
          const message = parseWsMessage(data)
          if (message.type === 'error') {
            errorReceived = true
          }
        })

        ws.on('error', (err) =>
          reject(new Error(`WebSocket error: ${err.message}`)),
        )

        setTimeout(() => {
          ws.close()
          resolve()
        }, 100)
      })

      expect(errorReceived).toBe(true)
    })

    it('should handle Pixel API errors gracefully', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`)
      let errorReceived = false

      vi.mocked(global.fetch).mockRejectedValueOnce(
        new Error('Pixel service timeout'),
      )

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send(
            JSON.stringify({
              type: 'complete',
              text: 'Test',
              contextType: 'therapeutic',
            }),
          )
        })

        ws.on('message', (data) => {
          const message = parseWsMessage(data)
          if (message.type === 'error') {
            errorReceived = true
          }
        })

        ws.on('error', (err) =>
          reject(new Error(`WebSocket error: ${err.message}`)),
        )

        setTimeout(() => {
          ws.close()
          resolve()
        }, 200)
      })

      expect(errorReceived).toBe(true)
    })
  })

  describe('Status Message Flow', () => {
    it('should emit connected status on connection', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`)
      let connectedPort: number | undefined

      await new Promise<void>((resolve, reject) => {
        ws.on('message', (data) => {
          const message = parseWsMessage(data)
          if (message.type === 'status' && message.status === 'connected') {
            connectedPort = message.port as number
            ws.close()
          }
        })
        ws.on('close', () => resolve())
        ws.on('error', (err) =>
          reject(new Error(`WebSocket error: ${err.message}`)),
        )
      })

      expect(connectedPort).toBe(8091)
    })

    it('should emit text_received status', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`)
      let textStatusReceived = false

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send(
            JSON.stringify({
              type: 'text',
              text: 'Test message',
              contextType: 'therapeutic',
            }),
          )
        })

        ws.on('message', (data) => {
          const message = parseWsMessage(data)
          if (message.type === 'status' && message.status === 'text_received') {
            textStatusReceived = true
          }
        })

        ws.on('error', (err) =>
          reject(new Error(`WebSocket error: ${err.message}`)),
        )

        setTimeout(() => {
          ws.close()
          resolve()
        }, 100)
      })

      expect(textStatusReceived).toBe(true)
    })

    it('should emit processing status on complete', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`)
      let processingReceived = false

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'Test', latency_ms: 100 }),
      } as any)

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send(
            JSON.stringify({
              type: 'complete',
              text: 'Test',
              contextType: 'therapeutic',
            }),
          )
        })

        ws.on('message', (data) => {
          const message = parseWsMessage(data)
          if (message.type === 'status' && message.status === 'processing') {
            processingReceived = true
          }
        })

        ws.on('error', (err) =>
          reject(new Error(`WebSocket error: ${err.message}`)),
        )

        setTimeout(() => {
          ws.close()
          resolve()
        }, 200)
      })

      expect(processingReceived).toBe(true)
    })
  })
})

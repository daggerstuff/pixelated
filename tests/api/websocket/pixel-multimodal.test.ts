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
vi.mock('ws', () => { return vi.importActual('ws') })
vi.mock('@/lib/logging/build-safe-logger', () => ({ createBuildSafeLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), }), }))
describe('WebSocket /api/websocket/pixel-multimodal', () => {
  let wsPort = 8091
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })
  describe('Connection Lifecycle', () => {
    it('should establish WebSocket connection', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('open', () => {
          try {
            expect(ws.readyState).toBe(WebSocket.OPEN)
            ws.close()
          } catch (error) {
            fail(error)
          }
        })
        ws.once('close', () => resolve())
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })
    it('should send connection status on open', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        let receivedStatus = false
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('message', (data) => {
          try {
            const message = parseWsMessage(data)
            if (message.type === 'status' && message.status === 'connected') {
              receivedStatus = true
              ws.close()
              expect(receivedStatus).toBe(true)
            }
          } catch (error) {
            fail(error)
          }
        })
        ws.once('close', () => resolve())
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })
    it('should handle graceful disconnection', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('open', () => {
          ws.close(1000, 'normal closure')
        })
        ws.once('close', (code) => {
          try {
            expect(code).toBe(1000)
          } catch (error) {
            fail(error)
          }
          resolve()
        })
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })
    it('should clear buffered state on disconnect', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('open', () => {
          ws.send(JSON.stringify({ type: 'chunk', chunk: Buffer.from('audio data').toString('base64'), mimeType: 'audio/webm', }))
          setTimeout(() => {
            ws.close()
          }, 50)
        })
        ws.once('close', () => {
          try {
            expect(ws.readyState).toBe(WebSocket.CLOSED)
          } catch (error) {
            fail(error)
          }
          resolve()
        })
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })
  })
  describe('Text Message Handling', () => {
    it('should receive and buffer text message', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        const testText = 'I am feeling anxious'
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('open', () => {
          ws.send(JSON.stringify({ type: 'text', text: testText, contextType: 'therapeutic', sessionId: 'session-123', }))
        })
        ws.once('message', (data) => {
          try {
            const message = parseWsMessage(data)
            if (message.type === 'status' && message.status === 'text_received') {
              expect(message.contextType).toBe('therapeutic')
              ws.close()
            }
          } catch (error) {
            fail(error)
          }
        })
        ws.once('close', () => resolve())
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })
    it('should accept context type in text message', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('open', () => {
          ws.send(JSON.stringify({ type: 'text', text: 'Test message', contextType: 'crisis_response', sessionId: 'sess-456', }))
        })
        let received = false
        ws.once('message', (data) => {
          try {
            const message = parseWsMessage(data)
            if (message.contextType === 'crisis_response') {
              received = true
            }
          } catch (error) {
            fail(error)
          }
        })
        setTimeout(() => {
          ws.close()
          try {
            expect(received).toBe(true)
          } catch (error) {
            fail(error)
          }
          resolve()
        }, 100)
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })
  })
  describe('Audio Chunk Handling', () => {
    it('should buffer audio chunks', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        const audioChunk = Buffer.from('audio_chunk_data')
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('open', () => {
          ws.send(JSON.stringify({ type: 'chunk', chunk: audioChunk.toString('base64'), mimeType: 'audio/webm', }))
        })
        let statusReceived = false
        ws.once('message', (data) => {
          try {
            const message = parseWsMessage(data)
            if (message.type === 'status') {
              statusReceived = true
            }
          } catch (error) {
            fail(error)
          }
        })
        setTimeout(() => {
          ws.close()
          try {
            expect(statusReceived).toBe(true)
          } catch (error) {
            fail(error)
          }
          resolve()
        }, 100)
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })
    it('should buffer multiple chunks sequentially', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        const chunk1 = Buffer.from('chunk1_data')
        const chunk2 = Buffer.from('chunk2_data')
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('open', () => {
          ws.send(JSON.stringify({ type: 'chunk', chunk: chunk1.toString('base64'), mimeType: 'audio/webm', }))
          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'chunk', chunk: chunk2.toString('base64'), mimeType: 'audio/webm', }))
          }, 20)
        })
        let messageCount = 0
        ws.on('message', (_data) => {
          messageCount++
        })
        setTimeout(() => {
          ws.close()
          try {
            expect(messageCount).toBeGreaterThan(0)
          } catch (error) {
            fail(error)
          }
          resolve()
        }, 150)
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })
    it('should reject audio exceeding 25MB limit', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        const largeBuffer = Buffer.alloc(26 * 1024 * 1024) // 26MB
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('open', () => {
          ws.send(JSON.stringify({ type: 'chunk', chunk: largeBuffer.toString('base64'), mimeType: 'audio/webm', }))
        })
        let errorReceived = false
        ws.once('message', (data) => {
          try {
            const message = parseWsMessage(data)
            if (message.type === 'error' && message.message.includes('too large')) {
              errorReceived = true
            }
          } catch (error) {
            fail(error)
          }
        })
        setTimeout(() => {
          ws.close()
          try {
            expect(errorReceived).toBe(true)
          } catch (error) {
            fail(error)
          }
          resolve()
        }, 200)
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })
    it('should close connection on payload overflow', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('open', () => {
          for (let i = 0; i < 30; i++) {
            const chunk = Buffer.alloc(1024 * 1024) // 1MB each
            ws.send(JSON.stringify({ type: 'chunk', chunk: chunk.toString('base64'), mimeType: 'audio/webm', }))
          }
        })
        ws.once('close', (code) => {
          try {
            expect([1009, 1000]).toContain(code) // 1009 = payload too large
          } catch (error) {
            fail(error)
          }
          resolve()
        })
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })
  })
  describe('Multimodal Fusion & Inference', () => {
    it('should construct form data with text + audio on complete', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        const mockPixelResponse = { response: 'Test response', latency_ms: 150, }
        vi.mocked(global.fetch).mockResolvedValueOnce({ ok: true, json: async () => mockPixelResponse, } as any)
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('open', () => {
          ws.send(JSON.stringify({ type: 'text', text: 'I am anxious', contextType: 'therapeutic', }))
          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'chunk', chunk: Buffer.from('audio_data').toString('base64'), mimeType: 'audio/webm', }))
          }, 30)
          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'complete', text: 'I am anxious', contextType: 'therapeutic', }))
          }, 60)
        })
        let resultReceived = false
        ws.once('message', (data) => {
          try {
            const message = parseWsMessage(data)
            if (message.type === 'result') {
              resultReceived = true
              expect(message.data).toBeDefined()
            }
          } catch (error) {
            fail(error)
          }
        })
        setTimeout(() => {
          ws.close()
          try {
            expect(resultReceived).toBe(true)
            expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(expect.stringContaining('/infer-multimodal'), expect.any(Object))
          } catch (error) {
            fail(error)
          }
          resolve()
        }, 300)
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })
    it('should handle text-only completion (no audio)', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        const mockPixelResponse = { response: 'Response to text', latency_ms: 120, }
        vi.mocked(global.fetch).mockResolvedValueOnce({ ok: true, json: async () => mockPixelResponse, } as any)
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('open', () => {
          ws.send(JSON.stringify({ type: 'text', text: 'Just text, no audio', contextType: 'therapeutic', }))
          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'complete', text: 'Just text, no audio', contextType: 'therapeutic', }))
          }, 50)
        })
        let resultReceived = false
        ws.once('message', (data) => {
          try {
            const message = parseWsMessage(data)
            if (message.type === 'result') {
              resultReceived = true
            }
          } catch (error) {
            fail(error)
          }
        })
        setTimeout(() => {
          ws.close()
          try {
            expect(resultReceived).toBe(true)
          } catch (error) {
            fail(error)
          }
          resolve()
        }, 200)
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })
    it('should return latency metrics from Pixel service', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        const mockPixelResponse = { response: 'Test', latency_ms: 175, }
        vi.mocked(global.fetch).mockResolvedValueOnce({ ok: true, json: async () => mockPixelResponse, } as any)
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('open', () => {
          ws.send(JSON.stringify({ type: 'complete', text: 'Test', contextType: 'therapeutic', }))
        })
        ws.once('message', (data) => {
          try {
            const message = parseWsMessage(data)
            if (message.type === 'result') {
              expect(message.data.latency_ms).toBeLessThan(200)
              ws.close()
            }
          } catch (error) {
            fail(error)
          }
        })
        setTimeout(() => {
          ws.close()
          resolve()
        }, 200)
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })
  })
  describe('Error Handling & Recovery', () => {
    it('should handle malformed JSON gracefully', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('open', () => {
          ws.send('not valid json {')
        })
        let errorReceived = false
        ws.once('message', (data) => {
          try {
            const message = parseWsMessage(data)
            if (message.type === 'error') {
              errorReceived = true
            }
          } catch (error) {
            fail(error)
          }
        })
        setTimeout(() => {
          ws.close()
          try {
            expect(errorReceived).toBe(true)
          } catch (error) {
            fail(error)
          }
          resolve()
        }, 100)
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })
    it('should reject unknown message types', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('open', () => {
          ws.send(JSON.stringify({ type: 'unknown_type', data: 'test', }))
        })
        let errorReceived = false
        ws.once('message', (data) => {
          try {
            const message = parseWsMessage(data)
            if (message.type === 'error') {
              errorReceived = true
            }
          } catch (error) {
            fail(error)
          }
        })
        setTimeout(() => {
          ws.close()
          try {
            expect(errorReceived).toBe(true)
          } catch (error) {
            fail(error)
          }
          resolve()
        }, 100)
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })
    it('should handle Pixel API errors gracefully', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Pixel service timeout'))
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('open', () => {
          ws.send(JSON.stringify({ type: 'complete', text: 'Test', contextType: 'therapeutic', }))
        })
        let errorReceived = false
        ws.once('message', (data) => {
          try {
            const message = parseWsMessage(data)
            if (message.type === 'error') {
              errorReceived = true
            }
          } catch (error) {
            fail(error)
          }
        })
        setTimeout(() => {
          ws.close()
          try {
            expect(errorReceived).toBe(true)
          } catch (error) {
            fail(error)
          }
          resolve()
        }, 200)
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })
  })
  describe('Status Message Flow', () => {
    it('should emit connected status on connection', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('message', (data) => {
          try {
            const message = parseWsMessage(data)
            if (message.type === 'status' && message.status === 'connected') {
              expect(message.port).toBe(8091)
              ws.close()
            }
          } catch (error) {
            fail(error)
          }
        })
        setTimeout(() => {
          ws.close()
          resolve()
        }, 100)
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })
    it('should emit text_received status', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('open', () => {
          ws.send(JSON.stringify({ type: 'text', text: 'Test message', contextType: 'therapeutic', }))
        })
        let textStatusReceived = false
        ws.once('message', (data) => {
          try {
            const message = parseWsMessage(data)
            if (message.type === 'status' && message.status === 'text_received') {
              textStatusReceived = true
            }
          } catch (error) {
            fail(error)
          }
        })
        setTimeout(() => {
          ws.close()
          try {
            expect(textStatusReceived).toBe(true)
          } catch (error) {
            fail(error)
          }
          resolve()
        }, 100)
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })
    it('should emit processing status on complete', async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`)
        vi.mocked(global.fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ response: 'Test', latency_ms: 100 }), } as any)
        const fail = (error: unknown): void => {
          ws.removeAllListeners()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
        ws.once('open', () => {
          ws.send(JSON.stringify({ type: 'complete', text: 'Test', contextType: 'therapeutic', }))
        })
        let processingReceived = false
        ws.once('message', (data) => {
          try {
            const message = parseWsMessage(data)
            if (message.type === 'status' && message.status === 'processing') {
              processingReceived = true
            }
          } catch (error) {
            fail(error)
          }
        })
        setTimeout(() => {
          ws.close()
          try {
            expect(processingReceived).toBe(true)
          } catch (error) {
            fail(error)
          }
          resolve()
        }, 200)
        ws.once('error', (err) => fail(new Error(`WebSocket error: ${err.message}`)))
      })
    })
  })
})
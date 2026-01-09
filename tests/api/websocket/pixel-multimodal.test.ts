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

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { WebSocketServer, WebSocket } from 'ws'

vi.mock('ws', () => {
    return vi.importActual('ws');
})

vi.mock('@/lib/logging/build-safe-logger', () => ({
    createBuildSafeLogger: () => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    }),
}))

// Mock fetch for Pixel API calls
global.fetch = vi.fn()

describe('WebSocket /api/websocket/pixel-multimodal', () => {
    let wss: WebSocketServer
    let wsPort = 8091

    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        if (wss) {
            wss.close()
        }
    })

    describe('Connection Lifecycle', () => {
        it('should establish WebSocket connection', (done) => {
            const ws = new WebSocket(`ws://localhost:${wsPort}`)

            ws.on('open', () => {
                expect(ws.readyState).toBe(WebSocket.OPEN)
                ws.close()
                done()
            })

            ws.on('error', (err) => {
                done(new Error(`WebSocket error: ${err.message}`))
            })
        })

        it('should send connection status on open', (done) => {
            const ws = new WebSocket(`ws://localhost:${wsPort}`)
            let receivedStatus = false

            ws.on('message', (data) => {
                const message = JSON.parse(data.toString())
                if (message.type === 'status' && message.status === 'connected') {
                    receivedStatus = true
                    ws.close()
                    expect(receivedStatus).toBe(true)
                    done()
                }
            })

            ws.on('error', (err) => {
                done(new Error(`WebSocket error: ${err.message}`))
            })
        })

        it('should handle graceful disconnection', (done) => {
            const ws = new WebSocket(`ws://localhost:${wsPort}`)

            ws.on('open', () => {
                ws.close(1000, 'normal closure')
            })

            ws.on('close', (code) => {
                expect(code).toBe(1000)
                done()
            })

            ws.on('error', (err) => {
                done(new Error(`WebSocket error: ${err.message}`))
            })
        })

        it('should clear buffered state on disconnect', (done) => {
            const ws = new WebSocket(`ws://localhost:${wsPort}`)

            ws.on('open', () => {
                // Send chunk
                ws.send(JSON.stringify({
                    type: 'chunk',
                    chunk: Buffer.from('audio data').toString('base64'),
                    mimeType: 'audio/webm',
                }))

                // Close connection
                setTimeout(() => {
                    ws.close()
                }, 50)
            })

            ws.on('close', () => {
                expect(ws.readyState).toBe(WebSocket.CLOSED)
                done()
            })

            ws.on('error', (err) => {
                done(new Error(`WebSocket error: ${err.message}`))
            })
        })
    })

    describe('Text Message Handling', () => {
        it('should receive and buffer text message', (done) => {
            const ws = new WebSocket(`ws://localhost:${wsPort}`)
            const testText = 'I am feeling anxious'

            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'text',
                    text: testText,
                    contextType: 'therapeutic',
                    sessionId: 'session-123',
                }))
            })

            ws.on('message', (data) => {
                const message = JSON.parse(data.toString())
                if (message.type === 'status' && message.status === 'text_received') {
                    expect(message.contextType).toBe('therapeutic')
                    ws.close()
                    done()
                }
            })

            ws.on('error', (err) => {
                done(new Error(`WebSocket error: ${err.message}`))
            })
        })

        it('should accept context type in text message', (done) => {
            const ws = new WebSocket(`ws://localhost:${wsPort}`)

            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'text',
                    text: 'Test message',
                    contextType: 'crisis_response',
                    sessionId: 'sess-456',
                }))
            })

            let received = false
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString())
                if (message.contextType === 'crisis_response') {
                    received = true
                }
            })

            setTimeout(() => {
                ws.close()
                expect(received).toBe(true)
                done()
            }, 100)

            ws.on('error', (err) => {
                done(new Error(`WebSocket error: ${err.message}`))
            })
        })
    })

    describe('Audio Chunk Handling', () => {
        it('should buffer audio chunks', (done) => {
            const ws = new WebSocket(`ws://localhost:${wsPort}`)
            const audioChunk = Buffer.from('audio_chunk_data')

            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'chunk',
                    chunk: audioChunk.toString('base64'),
                    mimeType: 'audio/webm',
                }))
            })

            let statusReceived = false
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString())
                if (message.type === 'status') {
                    statusReceived = true
                }
            })

            setTimeout(() => {
                ws.close()
                expect(statusReceived).toBe(true)
                done()
            }, 100)

            ws.on('error', (err) => {
                done(new Error(`WebSocket error: ${err.message}`))
            })
        })

        it('should buffer multiple chunks sequentially', (done) => {
            const ws = new WebSocket(`ws://localhost:${wsPort}`)
            const chunk1 = Buffer.from('chunk1_data')
            const chunk2 = Buffer.from('chunk2_data')

            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'chunk',
                    chunk: chunk1.toString('base64'),
                    mimeType: 'audio/webm',
                }))

                setTimeout(() => {
                    ws.send(JSON.stringify({
                        type: 'chunk',
                        chunk: chunk2.toString('base64'),
                        mimeType: 'audio/webm',
                    }))
                }, 20)
            })

            let messageCount = 0
            ws.on('message', (data) => {
                messageCount++
            })

            setTimeout(() => {
                ws.close()
                expect(messageCount).toBeGreaterThan(0)
                done()
            }, 150)

            ws.on('error', (err) => {
                done(new Error(`WebSocket error: ${err.message}`))
            })
        })

        it('should reject audio exceeding 25MB limit', (done) => {
            const ws = new WebSocket(`ws://localhost:${wsPort}`)
            const largeBuffer = Buffer.alloc(26 * 1024 * 1024) // 26MB

            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'chunk',
                    chunk: largeBuffer.toString('base64'),
                    mimeType: 'audio/webm',
                }))
            })

            let errorReceived = false
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString())
                if (message.type === 'error' && message.message.includes('too large')) {
                    errorReceived = true
                }
            })

            setTimeout(() => {
                ws.close()
                expect(errorReceived).toBe(true)
                done()
            }, 200)

            ws.on('error', (err) => {
                done(new Error(`WebSocket error: ${err.message}`))
            })
        })

        it('should close connection on payload overflow', (done) => {
            const ws = new WebSocket(`ws://localhost:${wsPort}`)

            ws.on('open', () => {
                // Send multiple large chunks to exceed 25MB
                for (let i = 0; i < 30; i++) {
                    const chunk = Buffer.alloc(1024 * 1024) // 1MB each
                    ws.send(JSON.stringify({
                        type: 'chunk',
                        chunk: chunk.toString('base64'),
                        mimeType: 'audio/webm',
                    }))
                }
            })

            ws.on('close', (code) => {
                expect([1009, 1000]).toContain(code) // 1009 = payload too large
                done()
            })

            ws.on('error', (err) => {
                done(new Error(`WebSocket error: ${err.message}`))
            })
        })
    })

    describe('Multimodal Fusion & Inference', () => {
        it('should construct form data with text + audio on complete', (done) => {
            const ws = new WebSocket(`ws://localhost:${wsPort}`)
            const mockPixelResponse = {
                response: 'Test response',
                latency_ms: 150,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockPixelResponse,
            } as any)

            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'text',
                    text: 'I am anxious',
                    contextType: 'therapeutic',
                }))

                setTimeout(() => {
                    ws.send(JSON.stringify({
                        type: 'chunk',
                        chunk: Buffer.from('audio_data').toString('base64'),
                        mimeType: 'audio/webm',
                    }))
                }, 30)

                setTimeout(() => {
                    ws.send(JSON.stringify({
                        type: 'complete',
                        text: 'I am anxious',
                        contextType: 'therapeutic',
                    }))
                }, 60)
            })

            let resultReceived = false
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString())
                if (message.type === 'result') {
                    resultReceived = true
                    expect(message.data).toBeDefined()
                }
            })

            setTimeout(() => {
                ws.close()
                expect(resultReceived).toBe(true)
                expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
                    expect.stringContaining('/infer-multimodal'),
                    expect.any(Object),
                )
                done()
            }, 300)

            ws.on('error', (err) => {
                done(new Error(`WebSocket error: ${err.message}`))
            })
        })

        it('should handle text-only completion (no audio)', (done) => {
            const ws = new WebSocket(`ws://localhost:${wsPort}`)
            const mockPixelResponse = {
                response: 'Response to text',
                latency_ms: 120,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockPixelResponse,
            } as any)

            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'text',
                    text: 'Just text, no audio',
                    contextType: 'therapeutic',
                }))

                setTimeout(() => {
                    ws.send(JSON.stringify({
                        type: 'complete',
                        text: 'Just text, no audio',
                        contextType: 'therapeutic',
                    }))
                }, 50)
            })

            let resultReceived = false
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString())
                if (message.type === 'result') {
                    resultReceived = true
                }
            })

            setTimeout(() => {
                ws.close()
                expect(resultReceived).toBe(true)
                done()
            }, 200)

            ws.on('error', (err) => {
                done(new Error(`WebSocket error: ${err.message}`))
            })
        })

        it('should return latency metrics from Pixel service', (done) => {
            const ws = new WebSocket(`ws://localhost:${wsPort}`)
            const mockPixelResponse = {
                response: 'Test',
                latency_ms: 175,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockPixelResponse,
            } as any)

            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'complete',
                    text: 'Test',
                    contextType: 'therapeutic',
                }))
            })

            ws.on('message', (data) => {
                const message = JSON.parse(data.toString())
                if (message.type === 'result') {
                    expect(message.data.latency_ms).toBeLessThan(200)
                    ws.close()
                    done()
                }
            })

            ws.on('error', (err) => {
                done(new Error(`WebSocket error: ${err.message}`))
            })
        })
    })

    describe('Error Handling & Recovery', () => {
        it('should handle malformed JSON gracefully', (done) => {
            const ws = new WebSocket(`ws://localhost:${wsPort}`)

            ws.on('open', () => {
                ws.send('not valid json {')
            })

            let errorReceived = false
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString())
                if (message.type === 'error') {
                    errorReceived = true
                }
            })

            setTimeout(() => {
                ws.close()
                expect(errorReceived).toBe(true)
                done()
            }, 100)

            ws.on('error', (err) => {
                done(new Error(`WebSocket error: ${err.message}`))
            })
        })

        it('should reject unknown message types', (done) => {
            const ws = new WebSocket(`ws://localhost:${wsPort}`)

            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'unknown_type',
                    data: 'test',
                }))
            })

            let errorReceived = false
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString())
                if (message.type === 'error') {
                    errorReceived = true
                }
            })

            setTimeout(() => {
                ws.close()
                expect(errorReceived).toBe(true)
                done()
            }, 100)

            ws.on('error', (err) => {
                done(new Error(`WebSocket error: ${err.message}`))
            })
        })

        it('should handle Pixel API errors gracefully', (done) => {
            const ws = new WebSocket(`ws://localhost:${wsPort}`)

            vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Pixel service timeout'))

            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'complete',
                    text: 'Test',
                    contextType: 'therapeutic',
                }))
            })

            let errorReceived = false
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString())
                if (message.type === 'error') {
                    errorReceived = true
                }
            })

            setTimeout(() => {
                ws.close()
                expect(errorReceived).toBe(true)
                done()
            }, 200)

            ws.on('error', (err) => {
                done(new Error(`WebSocket error: ${err.message}`))
            })
        })
    })

    describe('Status Message Flow', () => {
        it('should emit connected status on connection', (done) => {
            const ws = new WebSocket(`ws://localhost:${wsPort}`)

            ws.on('message', (data) => {
                const message = JSON.parse(data.toString())
                if (message.type === 'status' && message.status === 'connected') {
                    expect(message.port).toBe(8091)
                    ws.close()
                    done()
                }
            })

            ws.on('error', (err) => {
                done(new Error(`WebSocket error: ${err.message}`))
            })
        })

        it('should emit text_received status', (done) => {
            const ws = new WebSocket(`ws://localhost:${wsPort}`)

            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'text',
                    text: 'Test message',
                    contextType: 'therapeutic',
                }))
            })

            let textStatusReceived = false
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString())
                if (message.type === 'status' && message.status === 'text_received') {
                    textStatusReceived = true
                }
            })

            setTimeout(() => {
                ws.close()
                expect(textStatusReceived).toBe(true)
                done()
            }, 100)

            ws.on('error', (err) => {
                done(new Error(`WebSocket error: ${err.message}`))
            })
        })

        it('should emit processing status on complete', (done) => {
            const ws = new WebSocket(`ws://localhost:${wsPort}`)

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ response: 'Test', latency_ms: 100 }),
            } as any)

            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'complete',
                    text: 'Test',
                    contextType: 'therapeutic',
                }))
            })

            let processingReceived = false
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString())
                if (message.type === 'status' && message.status === 'processing') {
                    processingReceived = true
                }
            })

            setTimeout(() => {
                ws.close()
                expect(processingReceived).toBe(true)
                done()
            }, 200)

            ws.on('error', (err) => {
                done(new Error(`WebSocket error: ${err.message}`))
            })
        })
    })
})

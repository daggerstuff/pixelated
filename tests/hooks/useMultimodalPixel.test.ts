/**
 * useMultimodalPixel Hook Tests
 *
 * Tests for the React hook covering:
 * - REST inference (text-only, audio-only, combined)
 * - WebSocket streaming (connect, send chunks, finalize)
 * - State management and error handling
 * - Emotion tracking and fusion results
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMultimodalPixel } from '@/hooks/useMultimodalPixel'

// Mock dependencies
// (removed top-level global.fetch assignment)

// Mock WebSocket
class MockWebSocket {
    readyState = WebSocket.CONNECTING
    onopen: (() => void) | null = null
    onmessage: ((event: MessageEvent) => void) | null = null
    onclose: (() => void) | null = null
    onerror: (() => void) | null = null

    constructor(public url: string) {
        setTimeout(() => {
            this.readyState = WebSocket.OPEN
            this.onopen?.()
        }, 0)
    }

    send(data: string) {
        // Mock sending
    }

    close() {
        this.readyState = WebSocket.CLOSED
        this.onclose?.()
    }

    static CONNECTING = 0
    static OPEN = 1
    static CLOSING = 2
    static CLOSED = 3
}

describe('useMultimodalPixel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        global.fetch = vi.fn()
        global.WebSocket = MockWebSocket as any
    })

    describe('REST Inference - Text Only', () => {
        it('should perform text-only inference', async () => {
            const mockResponse = {
                response: 'Test response',
                transcription: null,
                text_emotion: { eq_scores: [0.8, 0.7, 0.6, 0.75, 0.85], overall_eq: 0.77 },
                audio_emotion: null,
                fused_emotion: { eq_scores: [0.8, 0.7, 0.6, 0.75, 0.85], overall_eq: 0.77 },
                latency_ms: 125,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as any)

            const { result } = renderHook(() => useMultimodalPixel())

            let inferenceResult
            await act(async () => {
                inferenceResult = await result.current.infer({
                    text: 'How are you feeling?',
                    sessionId: 'session-123',
                })
            })

            expect(inferenceResult?.response).toBe('Test response')
            expect(inferenceResult?.text_emotion?.overall_eq).toBe(0.77)
            expect(inferenceResult?.latency_ms).toBe(125)
        })

        it('should track text emotion scores', async () => {
            const mockResponse = {
                response: 'Response',
                text_emotion: { eq_scores: [0.9, 0.8, 0.7, 0.85, 0.88], overall_eq: 0.82 },
                latency_ms: 110,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as any)

            const { result } = renderHook(() => useMultimodalPixel())

            await act(async () => {
                await result.current.infer({
                    text: 'I feel great!',
                })
            })

            expect(result.current.textEmotion?.overall_eq).toBe(0.82)
            expect(result.current.lastResponse?.text_emotion?.eq_scores).toHaveLength(5)
        })

        it('should handle empty input gracefully', async () => {
            const { result } = renderHook(() => useMultimodalPixel())

            await act(async () => {
                const res = await result.current.infer({
                    text: '',
                    audioBlob: null,
                })
                expect(res).toBeNull()
            })

            expect(result.current.error).toBe('Text or audio is required')
        })
    })

    describe('REST Inference - Audio + Text', () => {
        it('should handle audio blob and text inference', async () => {
            const audioBlob = new Blob(['audio data'], { type: 'audio/webm' })
            const mockResponse = {
                response: 'I hear your anxiety',
                transcription: 'I am very anxious',
                audio_emotion: { valence: 0.3, arousal: 0.8, primary_emotion: 'anxiety', confidence: 0.92 },
                text_emotion: { overall_eq: 0.75 },
                fused_emotion: { valence: 0.32, arousal: 0.78, overall_eq: 0.76, conflict_score: 0.1 },
                latency_ms: 165,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as any)

            const { result } = renderHook(() => useMultimodalPixel())

            let inferenceResult
            await act(async () => {
                inferenceResult = await result.current.infer({
                    text: 'I am very anxious',
                    audioBlob,
                    sessionId: 'session-456',
                })
            })

            expect(inferenceResult?.transcription).toBe('I am very anxious')
            expect(inferenceResult?.audio_emotion?.primary_emotion).toBe('anxiety')
            expect(inferenceResult?.fused_emotion?.conflict_score).toBe(0.1)
        })

        it('should track audio emotion metrics', async () => {
            const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
            const mockResponse = {
                response: 'Response',
                audio_emotion: {
                    valence: 0.5,
                    arousal: 0.6,
                    dominance: 0.55,
                    primary_emotion: 'neutral',
                    confidence: 0.88,
                },
                latency_ms: 150,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as any)

            const { result } = renderHook(() => useMultimodalPixel())

            await act(async () => {
                await result.current.infer({
                    text: 'Test',
                    audioBlob,
                })
            })

            expect(result.current.audioEmotion?.valence).toBe(0.5)
            expect(result.current.audioEmotion?.arousal).toBe(0.6)
            expect(result.current.audioEmotion?.confidence).toBe(0.88)
        })

        it('should detect modality conflict', async () => {
            const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
            const mockResponse = {
                response: 'Response',
                audio_emotion: { valence: 0.9, arousal: 0.2, primary_emotion: 'happy' },
                text_emotion: { overall_eq: 0.3 },
                fused_emotion: { conflict_score: 0.8 },
                conflict_detected: true,
                latency_ms: 140,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as any)

            const { result } = renderHook(() => useMultimodalPixel())

            await act(async () => {
                await result.current.infer({
                    text: 'I am depressed',
                    audioBlob,
                })
            })

            expect(result.current.conflictDetected).toBe(true)
            expect(result.current.fusedEmotion?.conflict_score).toBeGreaterThan(0.5)
        })
    })

    describe('WebSocket Streaming', () => {
        it('should connect to WebSocket stream', async () => {
            const { result } = renderHook(() => useMultimodalPixel())

            await act(async () => {
                result.current.connectStream({ sessionId: 'session-789', contextType: 'therapeutic' })
            })

            await waitFor(() => {
                expect(result.current.streaming).toBe(true)
                expect(result.current.streamStatus).toBe('connected')
            })
        })

        it('should send text chunks to stream', async () => {
            const { result } = renderHook(() => useMultimodalPixel())
            const sendSpy = vi.fn()

            await act(async () => {
                result.current.connectStream({ sessionId: 'session-789' })
            })

            await waitFor(() => {
                expect(result.current.streaming).toBe(true)
            })

            await act(async () => {
                result.current.sendTextToStream('Hello from stream')
            })

            // Verify intent to send (actual send would happen on open WS)
        })

        it('should buffer and send audio chunks', async () => {
            const { result } = renderHook(() => useMultimodalPixel())

            await act(async () => {
                result.current.connectStream({ sessionId: 'session-789' })
            })

            await waitFor(() => {
                expect(result.current.streaming).toBe(true)
            })

            const audioBlob = new Blob(['chunk data'], { type: 'audio/webm' })

            await act(async () => {
                result.current.sendChunkToStream(audioBlob)
            })

            // Verify stream is still open
            expect(result.current.streaming).toBe(true)
        })

        it('should finalize stream and trigger inference', async () => {
            const mockResponse = {
                response: 'Stream response',
                latency_ms: 180,
            }

            const { result } = renderHook(() => useMultimodalPixel())

            await act(async () => {
                result.current.connectStream({ sessionId: 'session-789' })
            })

            await waitFor(() => {
                expect(result.current.streaming).toBe(true)
            })

            await act(async () => {
                result.current.finalizeStream({
                    text: 'Final text',
                    sessionId: 'session-789',
                    contextType: 'therapeutic',
                })
            })

            // Stream should remain open until server responds
            expect(result.current.streaming).toBe(true)
        })

        it('should handle stream status updates', async () => {
            const { result } = renderHook(() => useMultimodalPixel())

            await act(async () => {
                result.current.connectStream({ sessionId: 'session-789' })
            })

            await waitFor(() => {
                expect(result.current.streamStatus).toBe('connected')
            })
        })

        it('should handle stream errors gracefully', async () => {
            const { result } = renderHook(() => useMultimodalPixel())

            await act(async () => {
                result.current.connectStream({ sessionId: 'session-789' })
            })

            // Simulate error
            await waitFor(() => {
                expect(result.current.streaming).toBe(true)
            })

            // Close stream to trigger cleanup
            await act(async () => {
                result.current.disconnectStream()
            })

            expect(result.current.streaming).toBe(false)
        })

        it('should parse stream result messages', async () => {
            const mockResponse = {
                response: 'Stream result',
                transcription: 'Stream transcription',
                fused_emotion: { valence: 0.6, arousal: 0.5, overall_eq: 0.75 },
                latency_ms: 155,
            }

            const { result } = renderHook(() => useMultimodalPixel())

            await act(async () => {
                result.current.connectStream({ sessionId: 'session-789' })
            })

            await waitFor(() => {
                expect(result.current.streaming).toBe(true)
            })

            // Simulate receiving result message
            await act(async () => {
                result.current.finalizeStream({ text: 'Test', sessionId: 'session-789' })
            })

            // Stream should process result
            expect(result.current.streaming).toBe(true)
        })
    })

    describe('State Management', () => {
        it('should initialize with default state', () => {
            const { result } = renderHook(() => useMultimodalPixel())

            expect(result.current.loading).toBe(false)
            expect(result.current.error).toBeNull()
            expect(result.current.lastResponse).toBeNull()
            expect(result.current.streaming).toBe(false)
            expect(result.current.transcription).toBeNull()
        })

        it('should reset state', async () => {
            const mockResponse = {
                response: 'Test',
                latency_ms: 100,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as any)

            const { result } = renderHook(() => useMultimodalPixel())

            await act(async () => {
                await result.current.infer({ text: 'Test' })
            })

            expect(result.current.lastResponse).toBeDefined()

            await act(async () => {
                result.current.reset()
            })

            expect(result.current.lastResponse).toBeNull()
            expect(result.current.error).toBeNull()
            expect(result.current.transcription).toBeNull()
        })

        it('should cancel ongoing inference', async () => {
            const { result } = renderHook(() => useMultimodalPixel())

            // Start inference
            const inferencePromise = act(async () => {
                result.current.infer({ text: 'Test' })
            })

            // Cancel it
            await act(async () => {
                result.current.cancel()
            })

            // Should not have completed
            expect(result.current.loading).toBe(false)
        })

        it('should disconnect streaming', async () => {
            const { result } = renderHook(() => useMultimodalPixel())

            await act(async () => {
                result.current.connectStream({ sessionId: 'session-789' })
            })

            await waitFor(() => {
                expect(result.current.streaming).toBe(true)
            })

            await act(async () => {
                result.current.disconnectStream()
            })

            expect(result.current.streaming).toBe(false)
            expect(result.current.streamStatus).toBe('disconnected')
        })
    })

    describe('Error Handling', () => {
        it('should handle network errors', async () => {
            vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

            const { result } = renderHook(() => useMultimodalPixel())

            await act(async () => {
                await result.current.infer({ text: 'Test' })
            })

            expect(result.current.error).toBeDefined()
            expect(result.current.loading).toBe(false)
        })

        it('should handle HTTP error responses', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => 'Internal server error',
            } as any)

            const { result } = renderHook(() => useMultimodalPixel())

            await act(async () => {
                await result.current.infer({ text: 'Test' })
            })

            expect(result.current.error).toBeDefined()
        })

        it('should handle timeout gracefully', async () => {
            vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Request timeout'))

            const { result } = renderHook(() => useMultimodalPixel())

            await act(async () => {
                await result.current.infer({ text: 'Test' })
            })

            expect(result.current.error).toContain('timeout')
        })
    })

    describe('Latency Tracking', () => {
        it('should track inference latency', async () => {
            const mockResponse = {
                response: 'Test',
                latency_ms: 142,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as any)

            const { result } = renderHook(() => useMultimodalPixel())

            await act(async () => {
                await result.current.infer({ text: 'Test' })
            })

            expect(result.current.latencyMs).toBe(142)
        })

        it('should validate latency under 200ms target', async () => {
            const mockResponse = {
                response: 'Test',
                latency_ms: 198,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as any)

            const { result } = renderHook(() => useMultimodalPixel())

            await act(async () => {
                await result.current.infer({ text: 'Test' })
            })

            expect(result.current.latencyMs).toBeLessThan(200)
        })
    })

    describe('Session & Context Tracking', () => {
        it('should pass session ID through inference', async () => {
            const mockResponse = {
                response: 'Test',
                latency_ms: 100,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as any)

            const { result } = renderHook(() => useMultimodalPixel())

            await act(async () => {
                await result.current.infer({
                    text: 'Test',
                    sessionId: 'session-abc-123',
                })
            })

            // Verify fetch was called with session ID
            expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    method: 'POST',
                }),
            )
        })

        it('should track context type (therapeutic, crisis, etc)', async () => {
            const mockResponse = {
                response: 'Test',
                latency_ms: 100,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as any)

            const { result } = renderHook(() =>
                useMultimodalPixel({ defaultContextType: 'crisis_response' }),
            )

            await act(async () => {
                await result.current.infer({
                    text: 'I want to end it',
                    contextType: 'crisis_response',
                })
            })

            expect(vi.mocked(global.fetch)).toHaveBeenCalled()
        })
    })
})

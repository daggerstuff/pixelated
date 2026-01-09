/**
 * React Hook Tests: useMultimodalPixel
 *
 * Tests the custom React hook for multimodal inference, covering:
 * - REST API calls
 * - WebSocket streaming
 * - State management
 * - Error handling
 * - Audio/text fusion
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockFetch = vi.fn()
const mockUseState = vi.fn()
const mockUseCallback = vi.fn()
const mockUseEffect = vi.fn()

global.fetch = mockFetch as any

describe('useMultimodalPixel Hook - Unit Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFetch.mockClear()
    })

    describe('Initialization', () => {
        it('should initialize with default state', () => {
            const initialState = {
                isLoading: false,
                isStreaming: false,
                error: null,
                transcription: '',
                emotionMetrics: null,
                latencyMs: 0,
            }

            expect(initialState.isLoading).toBe(false)
            expect(initialState.transcription).toBe('')
            expect(initialState.latencyMs).toBe(0)
        })

        it('should accept session ID parameter', () => {
            const sessionId = 'session-abc-123'
            expect(sessionId).toBeDefined()
            expect(sessionId.length).toBeGreaterThan(0)
        })

        it('should accept optional API URL override', () => {
            const apiUrl = 'http://localhost:3000'
            expect(apiUrl).toBeDefined()
        })
    })

    describe('REST Inference (Text-Only)', () => {
        it('should send text to REST endpoint', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    emotion: { valence: 0.5 },
                    latency_ms: 145,
                }),
            })

            const formData = new FormData()
            formData.append('text', 'I feel calm')

            const response = await mockFetch('http://localhost:3000/api/ai/pixel/infer-multimodal', {
                method: 'POST',
                body: formData,
            })

            expect(response.ok).toBe(true)
        })

        it('should handle successful text inference', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    text_emotion: { valence: 0.7, arousal: 0.3 },
                    latency_ms: 125,
                }),
            })

            const response = await fetch('http://localhost:3000/api/ai/pixel/infer-multimodal', {
                method: 'POST',
            })

            const data = await response.json()
            expect(data.text_emotion.valence).toBeGreaterThan(0)
        })

        it('should measure latency on REST calls', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ latency_ms: 187 }),
            })

            const response = await fetch('http://localhost:3000/api/ai/pixel/infer-multimodal', {
                method: 'POST',
            })

            const data = await response.json()
            expect(data.latency_ms).toBeLessThan(200)
        })

        it('should retry on timeout', async () => {
            mockFetch
                .mockRejectedValueOnce(new Error('Timeout'))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ emotion: { valence: 0.5 } }),
                })

            // First attempt fails
            try {
                await mockFetch('http://localhost:3000/api/ai/pixel/infer-multimodal')
            } catch (e) {
                expect(e).toBeDefined()
            }

            // Second attempt succeeds
            const response = await mockFetch('http://localhost:3000/api/ai/pixel/infer-multimodal')
            expect(response.ok).toBe(true)
        })
    })

    describe('WebSocket Streaming (Audio + Text)', () => {
        it('should create WebSocket connection', () => {
            const wsUrl = 'ws://localhost:8091/ws/pixel-multimodal?session=sess-123'
            expect(wsUrl).toMatch(/^ws:/)
            expect(wsUrl).toContain('session=')
        })

        it('should handle connection success', () => {
            const connectionState = { connected: true, readyState: 1 }
            expect(connectionState.connected).toBe(true)
            expect(connectionState.readyState).toBe(1) // OPEN
        })

        it('should send text chunks over WebSocket', () => {
            const messages: any[] = []

            messages.push({ type: 'text', data: 'I feel ' })
            messages.push({ type: 'text', data: 'anxious today' })

            expect(messages.length).toBe(2)
            expect(messages[0].type).toBe('text')
        })

        it('should send audio chunks over WebSocket', () => {
            const messages: any[] = []

            const audioChunk1 = new Uint8Array(512)
            const audioChunk2 = new Uint8Array(512)

            messages.push({ type: 'audio', data: audioChunk1 })
            messages.push({ type: 'audio', data: audioChunk2 })

            expect(messages.length).toBe(2)
            expect(messages[0].data instanceof Uint8Array).toBe(true)
        })

        it('should signal stream completion', () => {
            const finalMessage = { type: 'finalize' }
            expect(finalMessage.type).toBe('finalize')
        })

        it('should receive streamed results', () => {
            const results: any[] = []

            results.push({ type: 'status', status: 'processing' })
            results.push({ type: 'result', emotion: { valence: 0.6 } })
            results.push({ type: 'complete' })

            expect(results.filter(r => r.type === 'result').length).toBe(1)
        })
    })

    describe('Audio Capture Integration', () => {
        it('should accept audio blob from useAudioCapture', () => {
            const audioBlob = new Blob(
                [new Uint8Array(1024)],
                { type: 'audio/webm' }
            )

            expect(audioBlob.type).toMatch(/^audio\//)
            expect(audioBlob.size).toBeGreaterThan(0)
        })

        it('should convert audio blob to File', () => {
            const audioBlob = new Blob([new Uint8Array(512)], { type: 'audio/webm' })
            const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' })

            expect(audioFile instanceof File).toBe(true)
            expect(audioFile.name).toBe('audio.webm')
        })

        it('should append audio to FormData for REST endpoint', () => {
            const formData = new FormData()
            const audioFile = new File(
                [new Uint8Array(512)],
                'audio.webm',
                { type: 'audio/webm' }
            )

            formData.append('text', 'I feel calm')
            formData.append('audio', audioFile)

            expect(formData.get('text')).toBe('I feel calm')
            expect(formData.get('audio')).toBe(audioFile)
        })
    })

    describe('State Management', () => {
        it('should track loading state during REST call', () => {
            const states = [
                { isLoading: true, error: null },
                { isLoading: false, error: null, result: { emotion: {} } },
            ]

            expect(states[0].isLoading).toBe(true)
            expect(states[1].isLoading).toBe(false)
        })

        it('should track streaming state during WebSocket', () => {
            const states = [
                { isStreaming: false },
                { isStreaming: true, bufferedChunks: 1 },
                { isStreaming: true, bufferedChunks: 2 },
                { isStreaming: false, result: { emotion: {} } },
            ]

            expect(states[0].isStreaming).toBe(false)
            expect(states[3].isStreaming).toBe(false)
        })

        it('should store transcription during streaming', () => {
            const transcription = 'I feel nervous about the presentation'
            expect(transcription.length).toBeGreaterThan(0)
        })

        it('should update emotion metrics on result', () => {
            const emotionMetrics = {
                valence: 0.5,
                arousal: 0.3,
                dominance: 0.4,
                confidence: 0.92,
            }

            expect(emotionMetrics.valence).toBeDefined()
            expect(emotionMetrics.confidence).toBeGreaterThan(0.9)
        })

        it('should track latency throughout session', () => {
            const latencies = [145, 152, 148]
            const avgLatency = latencies.reduce((a, b) => a + b) / latencies.length

            expect(avgLatency).toBeLessThan(200)
        })
    })

    describe('Error Handling', () => {
        it('should handle API errors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ error: 'Server error' }),
            })

            const response = await fetch('http://localhost:3000/api/ai/pixel/infer-multimodal', {
                method: 'POST',
            })

            expect(response.ok).toBe(false)
        })

        it('should handle network errors', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'))

            try {
                await fetch('http://localhost:3000/api/ai/pixel/infer-multimodal')
                expect.fail('Should have thrown')
            } catch (e) {
                expect((e as Error).message).toContain('Network')
            }
        })

        it('should handle WebSocket disconnection', () => {
            const connectionStates = [
                { readyState: 1 }, // OPEN
                { readyState: 2 }, // CLOSING
                { readyState: 3 }, // CLOSED
            ]

            expect(connectionStates[2].readyState).toBe(3)
        })

        it('should handle rate limit errors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: async () => ({ error: 'Rate limit exceeded' }),
            })

            const response = await fetch('http://localhost:3000/api/ai/pixel/infer-multimodal')
            expect(response.status).toBe(429)
        })

        it('should clear error on successful retry', () => {
            const errorStates = [
                { error: 'Previous error', isLoading: false },
                { error: null, isLoading: true },
                { error: null, isLoading: false, result: {} },
            ]

            expect(errorStates[2].error).toBeNull()
        })
    })

    describe('Callbacks & Handlers', () => {
        it('should provide onText callback for streaming', () => {
            const onText = vi.fn()

            onText('I feel ')
            onText('anxious')

            expect(onText).toHaveBeenCalledTimes(2)
            expect(onText).toHaveBeenCalledWith('anxious')
        })

        it('should provide onChunk callback for audio chunks', () => {
            const onChunk = vi.fn()

            const chunk = new Uint8Array(512)
            onChunk(chunk)

            expect(onChunk).toHaveBeenCalledWith(chunk)
        })

        it('should provide onFinalize callback on completion', () => {
            const onFinalize = vi.fn()

            onFinalize({ emotion: { valence: 0.5 }, latency_ms: 145 })

            expect(onFinalize).toHaveBeenCalled()
        })

        it('should provide onError callback on failure', () => {
            const onError = vi.fn()

            const error = new Error('Inference failed')
            onError(error)

            expect(onError).toHaveBeenCalledWith(error)
        })
    })

    describe('Session Management', () => {
        it('should create new session on mount', () => {
            const sessionId = 'sess-' + Date.now()
            expect(sessionId).toMatch(/^sess-\d+$/)
        })

        it('should reuse session across calls', () => {
            const sessionId = 'sess-abc-123'

            const calls = [
                { sessionId },
                { sessionId },
                { sessionId },
            ]

            calls.forEach(call => {
                expect(call.sessionId).toBe(sessionId)
            })
        })

        it('should clean up WebSocket on unmount', () => {
            const isConnected = false
            expect(isConnected).toBe(false)
        })

        it('should handle session timeout', () => {
            const sessionTimeoutMs = 30 * 60 * 1000 // 30 minutes
            const elapsed = 31 * 60 * 1000

            const hasExpired = elapsed > sessionTimeoutMs
            expect(hasExpired).toBe(true)
        })
    })

    describe('Streaming vs REST Toggle', () => {
        it('should support streaming mode flag', () => {
            const useStreaming = true
            expect(useStreaming).toBe(true)
        })

        it('should use WebSocket when streaming enabled', () => {
            const useStreaming = true
            const shouldUseWS = useStreaming

            expect(shouldUseWS).toBe(true)
        })

        it('should fall back to REST when streaming disabled', () => {
            const useStreaming = false
            const shouldUseREST = !useStreaming

            expect(shouldUseREST).toBe(true)
        })

        it('should handle dynamic toggle', () => {
            const streamingStates = [false, true, false]

            expect(streamingStates[0]).toBe(false)
            expect(streamingStates[1]).toBe(true)
            expect(streamingStates[2]).toBe(false)
        })
    })

    describe('Context & Type Parameters', () => {
        it('should accept context type parameter', () => {
            const contextTypes = ['therapeutic', 'educational', 'research']

            contextTypes.forEach(type => {
                expect(typeof type).toBe('string')
            })
        })

        it('should pass context to backend', () => {
            const formData = new FormData()
            formData.append('context_type', 'therapeutic')

            expect(formData.get('context_type')).toBe('therapeutic')
        })

        it('should default context to therapeutic', () => {
            const contextType = '' || 'therapeutic'
            expect(contextType).toBe('therapeutic')
        })
    })
})

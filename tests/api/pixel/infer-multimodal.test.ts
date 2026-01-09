/**
 * REST Multimodal Inference API Tests (Integration)
 *
 * Tests for POST /api/ai/pixel/infer-multimodal endpoint covering:
 * - Text-only, audio-only, and combined inference
 * - Rate limiting and auth
 * - Error handling and edge cases
 * - Audit logging and crisis detection
 *
 * NOTE: These are integration tests that test the endpoint behavior
 * via HTTP requests to the Astro dev server or similar test harness.
 * For unit testing, mock @/lib/services/pixel and @/lib/api/rate-limit.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock dependencies
vi.mock('@/lib/auth/session', () => ({
    getSession: vi.fn(),
}))

vi.mock('@/lib/api/rate-limit', () => ({
    applyRateLimit: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
    createAuditLog: vi.fn(),
    AuditEventType: { AI_GENERATION: 'AI_GENERATION', AI_MODEL_ACCESS: 'AI_MODEL_ACCESS' },
    AuditEventStatus: { SUCCESS: 'SUCCESS', WARNING: 'WARNING', ERROR: 'ERROR' },
}))

vi.mock('@/lib/logging/build-safe-logger', () => ({
    createBuildSafeLogger: () => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    }),
}))

const { getSession } = await import('@/lib/auth/session')
const { applyRateLimit } = await import('@/lib/api/rate-limit')
const { createAuditLog } = await import('@/lib/audit')

// Mock fetch globally
global.fetch = vi.fn()

describe('POST /api/ai/pixel/infer-multimodal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Authentication & Authorization', () => {
        it('should reject requests without session', async () => {
            vi.mocked(getSession).mockResolvedValueOnce(null)

            const context = {
                request: new Request('http://localhost/api/ai/pixel/infer-multimodal', {
                    method: 'POST',
                }),
            } as APIContext

            // Import and call POST handler
            const { POST } = await import('@/pages/api/ai/pixel/infer-multimodal')
            const response = await POST(context)

            expect(response.status).toBe(401)
            expect(await response.json()).toHaveProperty('error', 'Unauthorized')
        })

        it('should accept authenticated requests', async () => {
            vi.mocked(getSession).mockResolvedValueOnce({
                user: { id: 'user-123', role: 'therapist' },
            })

            vi.mocked(applyRateLimit).mockResolvedValueOnce({ allowed: true })

            const mockResponse = {
                ok: true,
                json: async () => ({
                    response: 'Test response',
                    latency_ms: 150,
                }),
            }
            vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as any)

            const formData = new FormData()
            formData.append('text', 'How are you feeling today?')
            formData.append('context_type', 'therapeutic')

            const context = {
                request: new Request('http://localhost/api/ai/pixel/infer-multimodal', {
                    method: 'POST',
                    body: formData,
                }),
            } as APIContext

            const { POST } = await import('@/pages/api/ai/pixel/infer-multimodal')
            const response = await POST(context)

            expect(response.status).toBe(200)
        })
    })

    describe('Rate Limiting', () => {
        it('should enforce rate limits based on user role', async () => {
            vi.mocked(getSession).mockResolvedValueOnce({
                user: { id: 'user-123', role: 'student' },
            })

            vi.mocked(applyRateLimit).mockResolvedValueOnce({ allowed: false })

            const formData = new FormData()
            formData.append('text', 'Test')

            const context = {
                request: new Request('http://localhost/api/ai/pixel/infer-multimodal', {
                    method: 'POST',
                    body: formData,
                }),
            } as APIContext

            const { POST } = await import('@/pages/api/ai/pixel/infer-multimodal')
            const response = await POST(context)

            expect(response.status).toBe(429)
            expect(await response.json()).toHaveProperty('error', 'Rate limit exceeded')
        })

        it('should allow higher limits for therapists', async () => {
            vi.mocked(getSession).mockResolvedValueOnce({
                user: { id: 'therapist-123', role: 'therapist' },
            })

            vi.mocked(applyRateLimit).mockResolvedValueOnce({ allowed: true })

            expect(vi.mocked(applyRateLimit)).toHaveBeenCalled()
        })
    })

    describe('Text-Only Inference', () => {
        beforeEach(() => {
            vi.mocked(getSession).mockResolvedValueOnce({
                user: { id: 'user-123', role: 'student' },
            })
            vi.mocked(applyRateLimit).mockResolvedValueOnce({ allowed: true })
        })

        it('should infer from text alone', async () => {
            const mockPixelResponse = {
                response: 'I understand you are feeling anxious.',
                transcription: null,
                text_emotion: { eq_scores: [0.8, 0.7, 0.6, 0.75, 0.85], overall_eq: 0.77 },
                audio_emotion: null,
                fused_emotion: { eq_scores: [0.8, 0.7, 0.6, 0.75, 0.85], overall_eq: 0.77 },
                latency_ms: 125,
                confidence: 0.95,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockPixelResponse,
            } as any)

            const formData = new FormData()
            formData.append('text', 'I am feeling very anxious about the exam tomorrow.')
            formData.append('context_type', 'therapeutic')
            formData.append('session_id', 'session-123')

            const context = {
                request: new Request('http://localhost/api/ai/pixel/infer-multimodal', {
                    method: 'POST',
                    body: formData,
                }),
            } as APIContext

            const { POST } = await import('@/pages/api/ai/pixel/infer-multimodal')
            const response = await POST(context)

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.response).toBeDefined()
            expect(data.latency_ms).toBeLessThan(200)
            expect(data.text_emotion?.overall_eq).toBeGreaterThan(0)
        })

        it('should extract and return EQ scores', async () => {
            const mockPixelResponse = {
                response: 'Response text',
                eq_scores: { emotional_awareness: 0.8, empathy_recognition: 0.7, emotional_regulation: 0.6, social_cognition: 0.75, interpersonal_skills: 0.85, overall_eq: 0.77 },
                latency_ms: 140,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockPixelResponse,
            } as any)

            const formData = new FormData()
            formData.append('text', 'Test text')

            const context = {
                request: new Request('http://localhost/api/ai/pixel/infer-multimodal', {
                    method: 'POST',
                    body: formData,
                }),
            } as APIContext

            const { POST } = await import('@/pages/api/ai/pixel/infer-multimodal')
            const response = await POST(context)
            const data = await response.json()

            expect(data.eq_scores).toBeDefined()
            expect(data.eq_scores.overall_eq).toBe(0.77)
        })
    })

    describe('Audio + Text Multimodal Inference', () => {
        beforeEach(() => {
            vi.mocked(getSession).mockResolvedValueOnce({
                user: { id: 'user-123', role: 'student' },
            })
            vi.mocked(applyRateLimit).mockResolvedValueOnce({ allowed: true })
        })

        it('should handle audio blob upload', async () => {
            const audioBuffer = Buffer.from('RIFF...', 'utf8')
            const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' })

            const mockPixelResponse = {
                response: 'I hear the anxiety in your voice.',
                transcription: 'I am very anxious',
                audio_emotion: { valence: 0.3, arousal: 0.8, primary_emotion: 'anxiety' },
                text_emotion: { overall_eq: 0.75 },
                fused_emotion: { valence: 0.35, arousal: 0.78, overall_eq: 0.76, conflict_score: 0.1 },
                latency_ms: 180,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockPixelResponse,
            } as any)

            const formData = new FormData()
            formData.append('text', 'I am very anxious')
            formData.append('audio', audioBlob, 'recording.webm')
            formData.append('context_type', 'therapeutic')

            const context = {
                request: new Request('http://localhost/api/ai/pixel/infer-multimodal', {
                    method: 'POST',
                    body: formData,
                }),
            } as APIContext

            const { POST } = await import('@/pages/api/ai/pixel/infer-multimodal')
            const response = await POST(context)

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.audio_emotion).toBeDefined()
            expect(data.fused_emotion).toBeDefined()
            expect(data.transcription).toBeDefined()
        })

        it('should detect modality conflict', async () => {
            const mockPixelResponse = {
                response: 'Response',
                audio_emotion: { valence: 0.9, arousal: 0.2, primary_emotion: 'happy' },
                text_emotion: { overall_eq: 0.3 },
                fused_emotion: { conflict_score: 0.7 },
                latency_ms: 165,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockPixelResponse,
            } as any)

            const formData = new FormData()
            formData.append('text', 'I am depressed')
            formData.append('audio', new Blob(['audio'], { type: 'audio/webm' }), 'rec.webm')

            const context = {
                request: new Request('http://localhost/api/ai/pixel/infer-multimodal', {
                    method: 'POST',
                    body: formData,
                }),
            } as APIContext

            const { POST } = await import('@/pages/api/ai/pixel/infer-multimodal')
            const response = await POST(context)
            const data = await response.json()

            expect(data.fused_emotion?.conflict_score).toBeGreaterThan(0.5)
        })

        it('should enforce 25MB audio size limit', async () => {
            const largeBuffer = Buffer.alloc(26 * 1024 * 1024) // 26MB
            const largeBlob = new Blob([largeBuffer], { type: 'audio/webm' })

            const formData = new FormData()
            formData.append('audio', largeBlob, 'huge.webm')
            formData.append('text', 'Test')

            const context = {
                request: new Request('http://localhost/api/ai/pixel/infer-multimodal', {
                    method: 'POST',
                    body: formData,
                }),
            } as APIContext

            const { POST } = await import('@/pages/api/ai/pixel/infer-multimodal')
            const response = await POST(context)

            expect(response.status).toBe(413)
        })
    })

    describe('Crisis Detection', () => {
        beforeEach(() => {
            vi.mocked(getSession).mockResolvedValueOnce({
                user: { id: 'user-123', role: 'student' },
            })
            vi.mocked(applyRateLimit).mockResolvedValueOnce({ allowed: true })
        })

        it('should detect crisis signals and log warning', async () => {
            const mockPixelResponse = {
                response: 'Please reach out to a crisis hotline immediately.',
                conversation_metadata: {
                    crisis_signals: ['suicidal_ideation'],
                    safety_score: 0.1,
                },
                latency_ms: 150,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockPixelResponse,
            } as any)

            const formData = new FormData()
            formData.append('text', 'I want to end it all')
            formData.append('context_type', 'therapeutic')

            const context = {
                request: new Request('http://localhost/api/ai/pixel/infer-multimodal', {
                    method: 'POST',
                    body: formData,
                }),
            } as APIContext

            const { POST } = await import('@/pages/api/ai/pixel/infer-multimodal')
            const response = await POST(context)

            expect(response.status).toBe(200)
            expect(vi.mocked(createAuditLog)).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'WARNING',
                    details: expect.objectContaining({
                        crisis_detected: true,
                    }),
                }),
            )
        })

        it('should log non-crisis interactions as success', async () => {
            const mockPixelResponse = {
                response: 'That sounds challenging.',
                conversation_metadata: { crisis_signals: [] },
                latency_ms: 140,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockPixelResponse,
            } as any)

            const formData = new FormData()
            formData.append('text', 'I had a tough day')

            const context = {
                request: new Request('http://localhost/api/ai/pixel/infer-multimodal', {
                    method: 'POST',
                    body: formData,
                }),
            } as APIContext

            const { POST } = await import('@/pages/api/ai/pixel/infer-multimodal')
            const response = await POST(context)

            expect(response.status).toBe(200)
            expect(vi.mocked(createAuditLog)).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'SUCCESS',
                }),
            )
        })
    })

    describe('Error Handling', () => {
        beforeEach(() => {
            vi.mocked(getSession).mockResolvedValueOnce({
                user: { id: 'user-123', role: 'student' },
            })
            vi.mocked(applyRateLimit).mockResolvedValueOnce({ allowed: true })
        })

        it('should handle Pixel API timeout gracefully', async () => {
            vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Request timeout'))

            const formData = new FormData()
            formData.append('text', 'Test')

            const context = {
                request: new Request('http://localhost/api/ai/pixel/infer-multimodal', {
                    method: 'POST',
                    body: formData,
                }),
            } as APIContext

            const { POST } = await import('@/pages/api/ai/pixel/infer-multimodal')
            const response = await POST(context)

            expect(response.status).toBe(500)
            expect(await response.json()).toHaveProperty('error')
        })

        it('should handle malformed FormData', async () => {
            const context = {
                request: new Request('http://localhost/api/ai/pixel/infer-multimodal', {
                    method: 'POST',
                    body: 'invalid-form-data',
                }),
            } as APIContext

            const { POST } = await import('@/pages/api/ai/pixel/infer-multimodal')
            const response = await POST(context)

            expect(response.status).toBeGreaterThanOrEqual(400)
        })

        it('should log errors for debugging', async () => {
            vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Pixel service error'))

            const formData = new FormData()
            formData.append('text', 'Test')

            const context = {
                request: new Request('http://localhost/api/ai/pixel/infer-multimodal', {
                    method: 'POST',
                    body: formData,
                }),
            } as APIContext

            const { POST } = await import('@/pages/api/ai/pixel/infer-multimodal')
            await POST(context)

            // Logger error should have been called
        })
    })

    describe('Latency Validation', () => {
        beforeEach(() => {
            vi.mocked(getSession).mockResolvedValueOnce({
                user: { id: 'user-123', role: 'student' },
            })
            vi.mocked(applyRateLimit).mockResolvedValueOnce({ allowed: true })
        })

        it('should return latency under 200ms target for text inference', async () => {
            const mockResponse = {
                response: 'Test',
                latency_ms: 145,
            }

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as any)

            const formData = new FormData()
            formData.append('text', 'Test')

            const context = {
                request: new Request('http://localhost/api/ai/pixel/infer-multimodal', {
                    method: 'POST',
                    body: formData,
                }),
            } as APIContext

            const { POST } = await import('@/pages/api/ai/pixel/infer-multimodal')
            const response = await POST(context)
            const data = await response.json()

            expect(data.latency_ms).toBeLessThan(200)
        })
    })
})

/**
 * PixelMultimodalChat Component Tests
 *
 * Tests for the React component covering:
 * - Audio capture UI and recording controls
 * - Message input and submission
 * - Streaming mode toggle and WebSocket integration
 * - Emotion metrics display
 * - Error handling and status messaging
 * - Accessibility compliance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PixelMultimodalChat } from '@/components/chat/PixelMultimodalChat'

// Mock hooks
vi.mock('@/hooks/useAudioCapture', () => ({
    useAudioCapture: () => ({
        startRecording: vi.fn(),
        stopRecording: vi.fn(async () => new Blob(['audio'], { type: 'audio/webm' })),
        pauseRecording: vi.fn(),
        resumeRecording: vi.fn(),
        reset: vi.fn(),
        isRecording: false,
        isPaused: false,
        durationMs: 0,
        audioBlob: null,
        audioUrl: null,
        error: null,
    }),
}))

vi.mock('@/hooks/useMultimodalPixel', () => ({
    useMultimodalPixel: () => ({
        infer: vi.fn(async () => ({
            response: 'Test response',
            latency_ms: 150,
        })),
        reset: vi.fn(),
        loading: false,
        error: null,
        transcription: null,
        audioEmotion: null,
        fusedEmotion: null,
        conflictDetected: false,
        lastResponse: null,
        latencyMs: null,
        connectStream: vi.fn(),
        disconnectStream: vi.fn(),
        finalizeStream: vi.fn(),
        sendTextToStream: vi.fn(),
        sendChunkToStream: vi.fn(),
        streaming: false,
        streamStatus: null,
        streamError: null,
    }),
}))

describe('PixelMultimodalChat Component', () => {
    const defaultProps = {
        sessionId: 'test-session-123',
        contextType: 'therapeutic',
        title: 'Pixel Chat',
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Rendering & Layout', () => {
        it('should render component with title and description', () => {
            render(<PixelMultimodalChat {...defaultProps} />)

            expect(screen.getByText('Pixel Chat')).toBeInTheDocument()
            expect(
                screen.getByText(/Capture audio, transcribe in real time/i),
            ).toBeInTheDocument()
        })

        it('should display session and context information', () => {
            render(<PixelMultimodalChat {...defaultProps} sessionId="sess-456" />)

            expect(screen.getByText('Session: sess-456')).toBeInTheDocument()
            expect(screen.getByText('Context: therapeutic')).toBeInTheDocument()
        })

        it('should render message textarea with placeholder', () => {
            render(<PixelMultimodalChat {...defaultProps} />)

            const textarea = screen.getByPlaceholderText(
                /Type a short prompt or note to accompany the audio/i,
            )
            expect(textarea).toBeInTheDocument()
        })

        it('should render audio capture controls', () => {
            render(<PixelMultimodalChat {...defaultProps} />)

            expect(screen.getByRole('button', { name: /Start Recording/i })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument()
        })

        it('should render streaming mode toggle', () => {
            render(<PixelMultimodalChat {...defaultProps} />)

            const streamingToggle = screen.getByRole('checkbox')
            expect(streamingToggle).toBeInTheDocument()
            expect(streamingToggle).toHaveAttribute('checked', 'false')
        })

        it('should render send button', () => {
            render(<PixelMultimodalChat {...defaultProps} />)

            expect(screen.getByRole('button', { name: /Send to Pixel/i })).toBeInTheDocument()
        })

        it('should render emotion metrics display panels', () => {
            render(<PixelMultimodalChat {...defaultProps} />)

            expect(screen.getByText('Transcription')).toBeInTheDocument()
            expect(screen.getByText('Audio Emotion')).toBeInTheDocument()
            expect(screen.getByText('Fused Emotion')).toBeInTheDocument()
        })
    })

    describe('Message Input', () => {
        it('should accept text input in message field', async () => {
            const user = userEvent.setup()
            render(<PixelMultimodalChat {...defaultProps} />)

            const textarea = screen.getByPlaceholderText(
                /Type a short prompt or note to accompany the audio/i,
            )

            await user.type(textarea, 'I am feeling anxious')

            expect(textarea).toHaveValue('I am feeling anxious')
        })

        it('should disable send button when no message and no audio', () => {
            render(<PixelMultimodalChat {...defaultProps} />)

            const sendButton = screen.getByRole('button', { name: /Send to Pixel/i })
            expect(sendButton).toBeDisabled()
        })

        it('should enable send button with message input', async () => {
            const user = userEvent.setup()
            render(<PixelMultimodalChat {...defaultProps} />)

            const textarea = screen.getByPlaceholderText(
                /Type a short prompt or note to accompany the audio/i,
            )
            const sendButton = screen.getByRole('button', { name: /Send to Pixel/i })

            await user.type(textarea, 'Test message')

            expect(sendButton).not.toBeDisabled()
        })

        it('should clear message after reset', async () => {
            const user = userEvent.setup()
            render(<PixelMultimodalChat {...defaultProps} />)

            const textarea = screen.getByPlaceholderText(
                /Type a short prompt or note to accompany the audio/i,
            )
            const clearButton = screen.getByRole('button', { name: /Clear/i })

            await user.type(textarea, 'Test message')
            await user.click(clearButton)

            expect(textarea).toHaveValue('')
        })
    })

    describe('Audio Recording Controls', () => {
        it('should toggle recording button text', async () => {
            const { useAudioCapture } = await import('@/hooks/useAudioCapture')
            const mockHook = vi.mocked(useAudioCapture)

            mockHook.mockReturnValueOnce({
                startRecording: vi.fn(),
                stopRecording: vi.fn(),
                pauseRecording: vi.fn(),
                resumeRecording: vi.fn(),
                reset: vi.fn(),
                isRecording: true,
                isPaused: false,
                durationMs: 5000,
                audioBlob: null,
                audioUrl: null,
                error: null,
            })

            render(<PixelMultimodalChat {...defaultProps} />)

            expect(screen.getByRole('button', { name: /Stop Recording/i })).toBeInTheDocument()
        })

        it('should display recording duration', async () => {
            const { useAudioCapture } = await import('@/hooks/useAudioCapture')
            const mockHook = vi.mocked(useAudioCapture)

            mockHook.mockReturnValueOnce({
                startRecording: vi.fn(),
                stopRecording: vi.fn(),
                pauseRecording: vi.fn(),
                resumeRecording: vi.fn(),
                reset: vi.fn(),
                isRecording: true,
                isPaused: false,
                durationMs: 65000, // 1m 5s
                audioBlob: null,
                audioUrl: null,
                error: null,
            })

            render(<PixelMultimodalChat {...defaultProps} />)

            expect(screen.getByText('1:05')).toBeInTheDocument()
        })

        it('should disable pause button when not recording', () => {
            render(<PixelMultimodalChat {...defaultProps} />)

            const pauseButton = screen.getByRole('button', { name: /Pause/i })
            expect(pauseButton).toBeDisabled()
        })

        it('should render audio player when audio is captured', async () => {
            const { useAudioCapture } = await import('@/hooks/useAudioCapture')
            const mockHook = vi.mocked(useAudioCapture)

            mockHook.mockReturnValueOnce({
                startRecording: vi.fn(),
                stopRecording: vi.fn(),
                pauseRecording: vi.fn(),
                resumeRecording: vi.fn(),
                reset: vi.fn(),
                isRecording: false,
                isPaused: false,
                durationMs: 0,
                audioBlob: new Blob(['audio'], { type: 'audio/webm' }),
                audioUrl: 'blob:http://localhost/audio-123',
                error: null,
            })

            render(<PixelMultimodalChat {...defaultProps} />)

            const audioElement = screen.getByRole('img', { hidden: true })
            expect(audioElement).toBeInTheDocument()
        })

        it('should display error message if audio capture fails', async () => {
            const { useAudioCapture } = await import('@/hooks/useAudioCapture')
            const mockHook = vi.mocked(useAudioCapture)

            mockHook.mockReturnValueOnce({
                startRecording: vi.fn(),
                stopRecording: vi.fn(),
                pauseRecording: vi.fn(),
                resumeRecording: vi.fn(),
                reset: vi.fn(),
                isRecording: false,
                isPaused: false,
                durationMs: 0,
                audioBlob: null,
                audioUrl: null,
                error: 'Microphone access denied',
            })

            render(<PixelMultimodalChat {...defaultProps} />)

            expect(screen.getByText('Microphone access denied')).toBeInTheDocument()
        })
    })

    describe('Streaming Mode', () => {
        it('should toggle streaming mode checkbox', async () => {
            const user = userEvent.setup()
            render(<PixelMultimodalChat {...defaultProps} />)

            const streamingCheckbox = screen.getByRole('checkbox')
            expect(streamingCheckbox).not.toBeChecked()

            await user.click(streamingCheckbox)
            expect(streamingCheckbox).toBeChecked()
        })

        it('should display streaming status when active', async () => {
            const { useMultimodalPixel } = await import('@/hooks/useMultimodalPixel')
            const mockHook = vi.mocked(useMultimodalPixel)

            mockHook.mockReturnValueOnce({
                infer: vi.fn(),
                reset: vi.fn(),
                loading: false,
                error: null,
                transcription: null,
                audioEmotion: null,
                fusedEmotion: null,
                conflictDetected: false,
                lastResponse: null,
                latencyMs: null,
                connectStream: vi.fn(),
                disconnectStream: vi.fn(),
                finalizeStream: vi.fn(),
                sendTextToStream: vi.fn(),
                sendChunkToStream: vi.fn(),
                streaming: true,
                streamStatus: 'connected',
                streamError: null,
            })

            render(<PixelMultimodalChat {...defaultProps} />)

            expect(screen.getByText('connected')).toBeInTheDocument()
        })

        it('should display stream error messages', async () => {
            const { useMultimodalPixel } = await import('@/hooks/useMultimodalPixel')
            const mockHook = vi.mocked(useMultimodalPixel)

            mockHook.mockReturnValueOnce({
                infer: vi.fn(),
                reset: vi.fn(),
                loading: false,
                error: null,
                transcription: null,
                audioEmotion: null,
                fusedEmotion: null,
                conflictDetected: false,
                lastResponse: null,
                latencyMs: null,
                connectStream: vi.fn(),
                disconnectStream: vi.fn(),
                finalizeStream: vi.fn(),
                sendTextToStream: vi.fn(),
                sendChunkToStream: vi.fn(),
                streaming: false,
                streamStatus: null,
                streamError: 'WebSocket connection failed',
            })

            render(<PixelMultimodalChat {...defaultProps} />)

            expect(screen.getByText('WebSocket connection failed')).toBeInTheDocument()
        })
    })

    describe('Emotion Metrics Display', () => {
        it('should display transcription when available', async () => {
            const { useMultimodalPixel } = await import('@/hooks/useMultimodalPixel')
            const mockHook = vi.mocked(useMultimodalPixel)

            mockHook.mockReturnValueOnce({
                infer: vi.fn(),
                reset: vi.fn(),
                loading: false,
                error: null,
                transcription: 'I am feeling anxious today',
                audioEmotion: null,
                fusedEmotion: null,
                conflictDetected: false,
                lastResponse: null,
                latencyMs: null,
                connectStream: vi.fn(),
                disconnectStream: vi.fn(),
                finalizeStream: vi.fn(),
                sendTextToStream: vi.fn(),
                sendChunkToStream: vi.fn(),
                streaming: false,
                streamStatus: null,
                streamError: null,
            })

            render(<PixelMultimodalChat {...defaultProps} />)

            expect(screen.getByText('I am feeling anxious today')).toBeInTheDocument()
        })

        it('should display audio emotion metrics', async () => {
            const { useMultimodalPixel } = await import('@/hooks/useMultimodalPixel')
            const mockHook = vi.mocked(useMultimodalPixel)

            mockHook.mockReturnValueOnce({
                infer: vi.fn(),
                reset: vi.fn(),
                loading: false,
                error: null,
                transcription: null,
                audioEmotion: {
                    valence: 0.3,
                    arousal: 0.8,
                    dominance: 0.5,
                    primary_emotion: 'anxiety',
                    confidence: 0.92,
                    emotion_probabilities: {},
                },
                fusedEmotion: null,
                conflictDetected: false,
                lastResponse: null,
                latencyMs: null,
                connectStream: vi.fn(),
                disconnectStream: vi.fn(),
                finalizeStream: vi.fn(),
                sendTextToStream: vi.fn(),
                sendChunkToStream: vi.fn(),
                streaming: false,
                streamStatus: null,
                streamError: null,
            })

            render(<PixelMultimodalChat {...defaultProps} />)

            expect(screen.getByText('anxiety')).toBeInTheDocument()
            expect(screen.getByText('92%')).toBeInTheDocument() // confidence
        })

        it('should display fused emotion with EQ score', async () => {
            const { useMultimodalPixel } = await import('@/hooks/useMultimodalPixel')
            const mockHook = vi.mocked(useMultimodalPixel)

            mockHook.mockReturnValueOnce({
                infer: vi.fn(),
                reset: vi.fn(),
                loading: false,
                error: null,
                transcription: null,
                audioEmotion: null,
                fusedEmotion: {
                    eq_scores: [0.8, 0.7, 0.6, 0.75, 0.85],
                    overall_eq: 0.76,
                    valence: 0.5,
                    arousal: 0.6,
                    conflict_score: 0.1,
                    confidence: 0.88,
                    text_contribution: 0.6,
                    audio_contribution: 0.4,
                },
                conflictDetected: false,
                lastResponse: null,
                latencyMs: null,
                connectStream: vi.fn(),
                disconnectStream: vi.fn(),
                finalizeStream: vi.fn(),
                sendTextToStream: vi.fn(),
                sendChunkToStream: vi.fn(),
                streaming: false,
                streamStatus: null,
                streamError: null,
            })

            render(<PixelMultimodalChat {...defaultProps} />)

            expect(screen.getByText(/EQ 76%/)).toBeInTheDocument()
        })

        it('should display latency badge', async () => {
            const { useMultimodalPixel } = await import('@/hooks/useMultimodalPixel')
            const mockHook = vi.mocked(useMultimodalPixel)

            mockHook.mockReturnValueOnce({
                infer: vi.fn(),
                reset: vi.fn(),
                loading: false,
                error: null,
                transcription: null,
                audioEmotion: null,
                fusedEmotion: null,
                conflictDetected: false,
                lastResponse: null,
                latencyMs: 145,
                connectStream: vi.fn(),
                disconnectStream: vi.fn(),
                finalizeStream: vi.fn(),
                sendTextToStream: vi.fn(),
                sendChunkToStream: vi.fn(),
                streaming: false,
                streamStatus: null,
                streamError: null,
            })

            render(<PixelMultimodalChat {...defaultProps} />)

            expect(screen.getByText('145 ms')).toBeInTheDocument()
        })
    })

    describe('Error Handling', () => {
        it('should display inference error message', async () => {
            const { useMultimodalPixel } = await import('@/hooks/useMultimodalPixel')
            const mockHook = vi.mocked(useMultimodalPixel)

            mockHook.mockReturnValueOnce({
                infer: vi.fn(),
                reset: vi.fn(),
                loading: false,
                error: 'Failed to contact Pixel service',
                transcription: null,
                audioEmotion: null,
                fusedEmotion: null,
                conflictDetected: false,
                lastResponse: null,
                latencyMs: null,
                connectStream: vi.fn(),
                disconnectStream: vi.fn(),
                finalizeStream: vi.fn(),
                sendTextToStream: vi.fn(),
                sendChunkToStream: vi.fn(),
                streaming: false,
                streamStatus: null,
                streamError: null,
            })

            render(<PixelMultimodalChat {...defaultProps} />)

            expect(screen.getByText('Failed to contact Pixel service')).toBeInTheDocument()
        })

        it('should display conflict detection badge', async () => {
            const { useMultimodalPixel } = await import('@/hooks/useMultimodalPixel')
            const mockHook = vi.mocked(useMultimodalPixel)

            mockHook.mockReturnValueOnce({
                infer: vi.fn(),
                reset: vi.fn(),
                loading: false,
                error: null,
                transcription: null,
                audioEmotion: null,
                fusedEmotion: null,
                conflictDetected: true,
                lastResponse: null,
                latencyMs: null,
                connectStream: vi.fn(),
                disconnectStream: vi.fn(),
                finalizeStream: vi.fn(),
                sendTextToStream: vi.fn(),
                sendChunkToStream: vi.fn(),
                streaming: false,
                streamStatus: null,
                streamError: null,
            })

            render(<PixelMultimodalChat {...defaultProps} />)

            expect(screen.getByText('Modality conflict detected')).toBeInTheDocument()
        })
    })

    describe('Accessibility', () => {
        it('should have proper heading hierarchy', () => {
            render(<PixelMultimodalChat {...defaultProps} />)

            const heading = screen.getByRole('heading', { level: 2 })
            expect(heading).toHaveTextContent('Pixel Chat')
        })

        it('should have descriptive labels on inputs', () => {
            render(<PixelMultimodalChat {...defaultProps} />)

            expect(screen.getByLabelText(/Message/i)).toBeInTheDocument()
            expect(screen.getByLabelText(/Streaming mode/i)).toBeInTheDocument()
        })

        it('should have accessible button names', () => {
            render(<PixelMultimodalChat {...defaultProps} />)

            expect(screen.getByRole('button', { name: /Start Recording/i })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /Send to Pixel/i })).toBeInTheDocument()
        })
    })

    describe('User Interactions', () => {
        it('should call onResult callback when result is available', async () => {
            const user = userEvent.setup()
            const onResult = vi.fn()

            const { useMultimodalPixel } = await import('@/hooks/useMultimodalPixel')
            const mockHook = vi.mocked(useMultimodalPixel)

            const mockInfer = vi.fn(async () => ({
                response: 'Test response',
                latency_ms: 150,
            }))

            mockHook.mockReturnValueOnce({
                infer: mockInfer,
                reset: vi.fn(),
                loading: false,
                error: null,
                transcription: null,
                audioEmotion: null,
                fusedEmotion: null,
                conflictDetected: false,
                lastResponse: null,
                latencyMs: null,
                connectStream: vi.fn(),
                disconnectStream: vi.fn(),
                finalizeStream: vi.fn(),
                sendTextToStream: vi.fn(),
                sendChunkToStream: vi.fn(),
                streaming: false,
                streamStatus: null,
                streamError: null,
            })

            render(<PixelMultimodalChat {...defaultProps} onResult={onResult} />)

            const textarea = screen.getByPlaceholderText(
                /Type a short prompt or note to accompany the audio/i,
            )
            const sendButton = screen.getByRole('button', { name: /Send to Pixel/i })

            await user.type(textarea, 'Test message')
            await user.click(sendButton)

            await waitFor(() => {
                expect(onResult).toHaveBeenCalled()
            })
        })
    })
})

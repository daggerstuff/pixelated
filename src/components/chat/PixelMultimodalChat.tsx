import { useMemo, useState } from 'react'

import { useAudioCapture } from '@/hooks/useAudioCapture'
import {
    type FusedEmotion,
    type MultimodalInferenceResponse,
    useMultimodalPixel,
} from '@/hooks/useMultimodalPixel'

interface PixelMultimodalChatProps {
    sessionId: string
    contextType?: string
    title?: string
    onResult?: (result: MultimodalInferenceResponse | null) => void
}

export function PixelMultimodalChat({
    sessionId,
    contextType = 'therapeutic',
    title = 'Pixel Multimodal Chat',
    onResult,
}: PixelMultimodalChatProps) {
    const [message, setMessage] = useState('')
    const [recordingNote, setRecordingNote] = useState<string | null>(null)
    const [streamingMode, setStreamingMode] = useState(false)

    const {
        infer,
        reset: resetInference,
        loading,
        error,
        transcription,
        audioEmotion,
        fusedEmotion,
        conflictDetected,
        lastResponse,
        latencyMs,
        connectStream,
        disconnectStream,
        finalizeStream,
        sendTextToStream,
        sendChunkToStream,
        streaming,
        streamStatus,
        streamError,
    } = useMultimodalPixel({ contextType })

    const handleChunk = useMemo(
        () =>
            (chunk: Blob) => {
                setRecordingNote('Capturing audio…')
                if (streamingMode) {
                    sendChunkToStream(chunk)
                }
            },
        [streamingMode, sendChunkToStream],
    )

    const {
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        reset,
        isRecording,
        isPaused,
        durationMs,
        audioBlob,
        audioUrl,
        error: audioError,
    } = useAudioCapture({
        chunkDurationMs: 1000,
        sampleRate: 16000,
        onChunk: handleChunk,
    })

    const durationLabel = useMemo(() => {
        const seconds = Math.floor(durationMs / 1000)
        const minutes = Math.floor(seconds / 60)
        const remaining = seconds % 60
        return `${minutes}:${remaining.toString().padStart(2, '0')}`
    }, [durationMs])

    const handleStartRecording = async () => {
        if (streamingMode) {
            connectStream({ sessionId, contextType })
            if (message) {
                sendTextToStream(message)
            }
        }
        await startRecording()
    }

    const handleStopRecording = async () => {
        const blob = await stopRecording()
        if (streamingMode) {
            finalizeStream({ text: message, sessionId, contextType })
        } else if (!audioBlob && blob) {
            // update local audio blob when not streaming and no existing blob
        }
    }

    const handleSend = async () => {
        if (!message && !audioBlob) return

        if (streamingMode) {
            finalizeStream({ text: message, sessionId, contextType })
            return
        }

        const result = await infer({
            text: message,
            audioBlob,
            sessionId,
            contextType,
        })

        if (result && onResult) {
            onResult(result)
        }
    }

    const handleReset = () => {
        reset()
        resetInference()
        disconnectStream()
        setMessage('')
        setRecordingNote(null)
    }

    const fusedSummary = useMemo(() => {
        if (!fusedEmotion) return null
        return formatFusedSummary(fusedEmotion)
    }, [fusedEmotion])

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                    <p className="text-sm text-slate-500">
                        Capture audio, transcribe in real time, and fuse with Pixel text analysis.
                    </p>
                </div>
                {latencyMs ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                        {latencyMs.toFixed(0)} ms
                    </span>
                ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                    <label className="text-sm font-medium text-slate-800">Message</label>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type a short prompt or note to accompany the audio…"
                        className="min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>Session: {sessionId}</span>
                        <span className="hidden md:inline">Context: {contextType}</span>
                    </div>
                </div>

                <div className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-slate-800">Audio capture</div>
                        <div className="text-xs text-slate-500">{durationLabel}</div>
                    </div>

                    <label className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner">
                        <span className="flex flex-col">
                            <span className="font-medium text-slate-800">Streaming mode</span>
                            <span className="text-xs text-slate-500">Send audio chunks over WebSocket for lower latency.</span>
                        </span>
                        <input
                            type="checkbox"
                            className="h-4 w-4 accent-indigo-600"
                            checked={streamingMode}
                            onChange={(e) => setStreamingMode(e.target.checked)}
                        />
                    </label>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={isRecording ? handleStopRecording : handleStartRecording}
                            className={
                                'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm transition ' +
                                (isRecording
                                    ? 'bg-rose-600 hover:bg-rose-700'
                                    : 'bg-indigo-600 hover:bg-indigo-700')
                            }
                        >
                            {isRecording ? 'Stop Recording' : 'Start Recording'}
                        </button>

                        <button
                            type="button"
                            onClick={isPaused ? resumeRecording : pauseRecording}
                            disabled={!isRecording}
                            className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isPaused ? 'Resume' : 'Pause'}
                        </button>

                        <button
                            type="button"
                            onClick={reset}
                            className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                            Reset
                        </button>
                    </div>

                    {audioUrl ? (
                        <audio controls src={audioUrl} className="mt-2 w-full" />
                    ) : (
                        <div className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                            No audio captured yet.
                        </div>
                    )}

                    {recordingNote ? (
                        <div className="text-xs text-indigo-600">{recordingNote}</div>
                    ) : null}

                    {streaming ? (
                        <div className="text-xs text-emerald-600">{streamStatus || 'Streaming audio…'}</div>
                    ) : streamStatus ? (
                        <div className="text-xs text-slate-500">{streamStatus}</div>
                    ) : null}

                    {streamError ? (
                        <div className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{streamError}</div>
                    ) : null}

                    {audioError ? (
                        <div className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                            {audioError}
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={loading || (!message && !audioBlob)}
                    className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading ? 'Sending…' : 'Send to Pixel'}
                </button>

                <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                    Clear
                </button>

                {error ? (
                    <span className="rounded-md bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                        {error}
                    </span>
                ) : null}

                {conflictDetected ? (
                    <span className="rounded-md bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                        Modality conflict detected
                    </span>
                ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-slate-100 bg-white p-3">
                    <div className="flex items-center justify-between text-sm font-medium text-slate-800">
                        <span>Transcription</span>
                        {lastResponse?.warning ? (
                            <span className="text-xs font-semibold text-amber-600">{lastResponse.warning}</span>
                        ) : null}
                    </div>
                    <div className="mt-2 text-sm text-slate-700">
                        {transcription || 'No transcript yet.'}
                    </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-white p-3">
                    <div className="flex items-center justify-between text-sm font-medium text-slate-800">
                        <span>Audio Emotion</span>
                        {audioEmotion?.confidence ? (
                            <span className="text-xs text-slate-500">
                                {Math.round((audioEmotion.confidence || 0) * 100)}%
                            </span>
                        ) : null}
                    </div>
                    <div className="mt-2 text-sm text-slate-700">
                        {audioEmotion?.primary_emotion || 'Not available'}
                    </div>
                    {audioEmotion ? (
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-600">
                            <Stat label="Valence" value={audioEmotion.valence} />
                            <Stat label="Arousal" value={audioEmotion.arousal} />
                            {audioEmotion.dominance !== undefined ? (
                                <Stat label="Dominance" value={audioEmotion.dominance} />
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <div className="rounded-lg border border-slate-100 bg-white p-3">
                    <div className="flex items-center justify-between text-sm font-medium text-slate-800">
                        <span>Fused Emotion</span>
                        {fusedEmotion?.confidence ? (
                            <span className="text-xs text-slate-500">
                                {Math.round((fusedEmotion.confidence || 0) * 100)}%
                            </span>
                        ) : null}
                    </div>
                    <div className="mt-2 text-sm text-slate-700">
                        {fusedSummary || 'Not available'}
                    </div>
                    {fusedEmotion ? (
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-600">
                            <Stat label="Valence" value={fusedEmotion.valence} />
                            <Stat label="Arousal" value={fusedEmotion.arousal} />
                            <Stat label="EQ" value={fusedEmotion.overall_eq} />
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

function Stat({ label, value }: { label: string; value?: number }) {
    if (value === undefined || Number.isNaN(value)) {
        return (
            <div className="rounded-md bg-slate-50 px-2 py-1 text-slate-500">—</div>
        )
    }

    return (
        <div className="rounded-md bg-slate-50 px-2 py-1 text-slate-700">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
            <div className="font-semibold">{value.toFixed(2)}</div>
        </div>
    )
}

function formatFusedSummary(fused: FusedEmotion): string {
    const { valence, arousal, overall_eq, conflict_score } = fused
    const parts = []
    if (overall_eq !== undefined) parts.push(`EQ ${(overall_eq * 100).toFixed(0)}%`)
    if (valence !== undefined) parts.push(`Val ${(valence * 100).toFixed(0)}%`)
    if (arousal !== undefined) parts.push(`Aro ${(arousal * 100).toFixed(0)}%`)
    if (conflict_score !== undefined) {
        parts.push(`Conflict ${(conflict_score * 100).toFixed(0)}%`)
    }
    return parts.join(' · ')
}

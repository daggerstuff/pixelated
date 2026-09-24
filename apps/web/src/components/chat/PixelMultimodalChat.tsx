import { useMemo, useState } from 'react'

import { useAudioCapture } from '@/hooks/useAudioCapture'
import {
  type FusedEmotion,
  type MultimodalInferenceResponse,
  useMultimodalPixel,
} from '@/hooks/useMultimodalPixel'

interface PixelMultimodalChatProps {
  sessionId: string
  defaultContextType?: string
  title?: string
  onResult?: (result: MultimodalInferenceResponse | null) => void
}

export function PixelMultimodalChat({
  sessionId,
  defaultContextType = 'therapeutic',
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
    behavioralPattern,
    behavioralPatternConfidence,
    connectStream,
    disconnectStream,
    finalizeStream,
    sendTextToStream,
    sendChunkToStream,
    streaming,
    streamStatus,
    streamError,
  } = useMultimodalPixel({})

  const handleChunk = useMemo(
    () => (chunk: Blob) => {
      setRecordingNote('Capturing audio…')
      if (streamingMode) {
        void sendChunkToStream(chunk)
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
      connectStream({ sessionId })
      if (message) {
        sendTextToStream(message)
      }
    }
    await startRecording()
  }

  const handleStopRecording = async () => {
    const blob = await stopRecording()
    if (streamingMode) {
      finalizeStream({ text: message, sessionId })
    } else if (!audioBlob && blob) {
      // update local audio blob when not streaming and no existing blob
    }
  }

  const handleSend = async () => {
    if (!message && !audioBlob) return

    if (streamingMode) {
      finalizeStream({ text: message, sessionId })
      return
    }

    const result = await infer({
      text: message,
      audioBlob,
      sessionId,
      contextType: defaultContextType,
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
    <div className="flex flex-col gap-4 rounded-none border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">
            Capture audio, transcribe in real time, and fuse with Pixel text
            analysis.
          </p>
        </div>
        {latencyMs ? (
          <span className="rounded-none border border-input bg-secondary px-3 py-1 text-xs font-medium text-foreground">
            {latencyMs.toFixed(0)} ms
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-none border border-border bg-secondary p-3">
          <label className="text-sm font-medium text-foreground">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a short prompt or note to accompany the audio…"
            className="min-h-[110px] w-full rounded-none border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring"
          />
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Session: {sessionId}</span>
            <span className="hidden md:inline">
              Context: {defaultContextType}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-none border border-border bg-secondary p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-foreground">
              Audio capture
            </div>
            <div className="text-xs text-muted-foreground">{durationLabel}</div>
          </div>

          <label className="flex items-center justify-between rounded-none border border-input bg-card px-3 py-2 text-sm text-foreground">
            <span className="flex flex-col">
              <span className="font-medium text-foreground">
                Streaming mode
              </span>
              <span className="text-xs text-muted-foreground">
                Send audio chunks over WebSocket for lower latency.
              </span>
            </span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-foreground"
              checked={streamingMode}
              onChange={(e) => setStreamingMode(e.target.checked)}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              className={
                'inline-flex items-center gap-2 rounded-none px-3 py-2 text-sm font-semibold text-primary-foreground transition ' +
                (isRecording
                  ? 'bg-primary hover:bg-accent'
                  : 'bg-primary hover:bg-accent')
              }
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>

            <button
              type="button"
              onClick={isPaused ? resumeRecording : pauseRecording}
              disabled={!isRecording}
              className="inline-flex items-center gap-2 rounded-none border border-input px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>

            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-none border border-input px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary"
            >
              Reset
            </button>
          </div>

          {audioUrl ? (
            <audio controls src={audioUrl} className="mt-2 w-full" />
          ) : (
            <div className="rounded-none border border-dashed border-input bg-card px-3 py-2 text-xs text-muted-foreground">
              No audio captured yet.
            </div>
          )}

          {recordingNote ? (
            <div className="text-xs text-foreground">{recordingNote}</div>
          ) : null}

          {streaming ? (
            <div className="text-xs text-foreground">
              {streamStatus ?? 'Streaming audio…'}
            </div>
          ) : streamStatus ? (
            <div className="text-xs text-muted-foreground">{streamStatus}</div>
          ) : null}

          {streamError ? (
            <div className="rounded-none border border-ring bg-card px-3 py-2 text-xs text-foreground">
              {streamError}
            </div>
          ) : null}

          {audioError ? (
            <div className="rounded-none border border-ring bg-card px-3 py-2 text-xs text-foreground">
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
          className="inline-flex items-center gap-2 rounded-none bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-35"
        >
          {loading ? 'Sending…' : 'Send to Pixel'}
        </button>

        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-none border border-input px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary"
        >
          Clear
        </button>

        {error ? (
          <span className="rounded-none border border-ring bg-card px-3 py-1 text-xs font-semibold text-foreground">
            {error}
          </span>
        ) : null}

        {conflictDetected ? (
          <span className="rounded-none border border-ring bg-secondary px-3 py-1 text-xs font-medium text-foreground">
            Modality conflict detected
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-none border border-border bg-card p-3">
          <div className="flex items-center justify-between text-sm font-medium text-foreground">
            <span>Transcription</span>
            {lastResponse?.warning ? (
              <span className="text-xs font-semibold text-foreground">
                {lastResponse.warning}
              </span>
            ) : null}
          </div>
          <div className="mt-2 text-sm text-foreground">
            {transcription ?? 'No transcript yet.'}
          </div>
        </div>

        <div className="rounded-none border border-border bg-card p-3">
          <div className="flex items-center justify-between text-sm font-medium text-foreground">
            <span>Audio Emotion</span>
            {audioEmotion?.confidence ? (
              <span className="text-xs text-muted-foreground">
                {Math.round((audioEmotion.confidence || 0) * 100)}%
              </span>
            ) : null}
          </div>
          <div className="mt-2 text-sm text-foreground">
            {audioEmotion?.primary_emotion ?? 'Not available'}
          </div>
          {audioEmotion ? (
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <Stat label="Valence" value={audioEmotion.valence} />
              <Stat label="Arousal" value={audioEmotion.arousal} />
              {audioEmotion.dominance !== undefined ? (
                <Stat label="Dominance" value={audioEmotion.dominance} />
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-none border border-border bg-card p-3">
          <div className="flex items-center justify-between text-sm font-medium text-foreground">
            <span>Fused Emotion</span>
            {fusedEmotion?.confidence ? (
              <span className="text-xs text-muted-foreground">
                {Math.round((fusedEmotion.confidence || 0) * 100)}%
              </span>
            ) : null}
          </div>
          <div className="mt-2 text-sm text-foreground">
            {fusedSummary ?? 'Not available'}
          </div>
          {fusedEmotion ? (
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <Stat label="Valence" value={fusedEmotion.valence} />
              <Stat label="Arousal" value={fusedEmotion.arousal} />
              <Stat label="EQ" value={fusedEmotion.overall_eq} />
            </div>
          ) : null}
        </div>

        {behavioralPattern ? (
          <div className="rounded-none border border-border bg-card p-3">
            <div className="text-sm font-medium text-foreground">
              Behavioral Pattern
            </div>
            <div
              className="mt-2 text-sm text-foreground"
              data-testid="multimodal-behavioral-pattern"
            >
              {behavioralPattern}
            </div>
            {behavioralPatternConfidence !== null ? (
              <div className="mt-1 text-xs text-muted-foreground">
                {(behavioralPatternConfidence * 100).toFixed(0)}% confidence
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value?: number }) {
  if (value === undefined || Number.isNaN(value)) {
    return (
      <div className="rounded-none bg-secondary px-2 py-1 text-muted-foreground">
        —
      </div>
    )
  }

  return (
    <div className="rounded-none bg-secondary px-2 py-1 text-foreground">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-semibold">{value.toFixed(2)}</div>
    </div>
  )
}

function formatFusedSummary(fused: FusedEmotion): string {
  const { valence, arousal, overall_eq, conflict_score } = fused
  const parts: string[] = []
  if (overall_eq !== undefined)
    parts.push(`EQ ${(overall_eq * 100).toFixed(0)}%`)
  if (valence !== undefined) parts.push(`Val ${(valence * 100).toFixed(0)}%`)
  if (arousal !== undefined) parts.push(`Aro ${(arousal * 100).toFixed(0)}%`)
  if (conflict_score !== undefined) {
    parts.push(`Conflict ${(conflict_score * 100).toFixed(0)}%`)
  }
  return parts.join(' · ')
}

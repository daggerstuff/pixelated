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
    <div className='border-slate-200 bg-white/80 flex flex-col gap-4 rounded-xl border p-4 shadow-sm backdrop-blur'>
      <div className='flex items-center justify-between gap-3'>
        <div className='flex flex-col'>
          <h2 className='text-slate-900 text-lg font-semibold'>{title}</h2>
          <p className='text-slate-500 text-sm'>
            Capture audio, transcribe in real time, and fuse with Pixel text
            analysis.
          </p>
        </div>
        {latencyMs ? (
          <span className='bg-emerald-50 text-emerald-700 rounded-full px-3 py-1 text-xs font-medium'>
            {latencyMs.toFixed(0)} ms
          </span>
        ) : null}
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <div className='border-slate-100 bg-slate-50/60 flex flex-col gap-3 rounded-lg border p-3'>
          <label className='text-slate-800 text-sm font-medium'>Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder='Type a short prompt or note to accompany the audio…'
            className='border-slate-200 bg-white text-slate-900 focus:border-indigo-400 focus:ring-indigo-100 min-h-[110px] w-full rounded-md border px-3 py-2 text-sm shadow-inner outline-none transition focus:ring-2'
          />
          <div className='text-slate-500 flex flex-wrap items-center gap-3 text-xs'>
            <span>Session: {sessionId}</span>
            <span className='hidden md:inline'>Context: {contextType}</span>
          </div>
        </div>

        <div className='border-slate-100 bg-slate-50/60 flex flex-col gap-3 rounded-lg border p-3'>
          <div className='flex items-center justify-between'>
            <div className='text-slate-800 text-sm font-medium'>
              Audio capture
            </div>
            <div className='text-slate-500 text-xs'>{durationLabel}</div>
          </div>

          <label className='border-slate-200 bg-white text-slate-700 flex items-center justify-between rounded-md border px-3 py-2 text-sm shadow-inner'>
            <span className='flex flex-col'>
              <span className='text-slate-800 font-medium'>Streaming mode</span>
              <span className='text-slate-500 text-xs'>
                Send audio chunks over WebSocket for lower latency.
              </span>
            </span>
            <input
              type='checkbox'
              className='accent-indigo-600 h-4 w-4'
              checked={streamingMode}
              onChange={(e) => setStreamingMode(e.target.checked)}
            />
          </label>

          <div className='flex flex-wrap items-center gap-2'>
            <button
              type='button'
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              className={
                'text-white inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold shadow-sm transition ' +
                (isRecording
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-indigo-600 hover:bg-indigo-700')
              }
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>

            <button
              type='button'
              onClick={isPaused ? resumeRecording : pauseRecording}
              disabled={!isRecording}
              className='border-slate-200 text-slate-700 hover:bg-slate-100 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60'
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>

            <button
              type='button'
              onClick={reset}
              className='border-slate-200 text-slate-700 hover:bg-slate-100 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition'
            >
              Reset
            </button>
          </div>

          {audioUrl ? (
            <audio controls src={audioUrl} className='mt-2 w-full' />
          ) : (
            <div className='border-slate-200 bg-white text-slate-500 rounded-md border border-dashed px-3 py-2 text-xs'>
              No audio captured yet.
            </div>
          )}

          {recordingNote ? (
            <div className='text-indigo-600 text-xs'>{recordingNote}</div>
          ) : null}

          {streaming ? (
            <div className='text-emerald-600 text-xs'>
              {streamStatus || 'Streaming audio…'}
            </div>
          ) : streamStatus ? (
            <div className='text-slate-500 text-xs'>{streamStatus}</div>
          ) : null}

          {streamError ? (
            <div className='bg-rose-50 text-rose-700 rounded-md px-3 py-2 text-xs'>
              {streamError}
            </div>
          ) : null}

          {audioError ? (
            <div className='bg-rose-50 text-rose-700 rounded-md px-3 py-2 text-xs'>
              {audioError}
            </div>
          ) : null}
        </div>
      </div>

      <div className='flex flex-wrap items-center gap-3'>
        <button
          type='button'
          onClick={handleSend}
          disabled={loading || (!message && !audioBlob)}
          className='bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60'
        >
          {loading ? 'Sending…' : 'Send to Pixel'}
        </button>

        <button
          type='button'
          onClick={handleReset}
          className='border-slate-200 text-slate-700 hover:bg-slate-100 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition'
        >
          Clear
        </button>

        {error ? (
          <span className='bg-rose-50 text-rose-700 rounded-md px-3 py-1 text-xs font-medium'>
            {error}
          </span>
        ) : null}

        {conflictDetected ? (
          <span className='bg-amber-50 text-amber-700 rounded-md px-3 py-1 text-xs font-medium'>
            Modality conflict detected
          </span>
        ) : null}
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        <div className='border-slate-100 bg-white rounded-lg border p-3'>
          <div className='text-slate-800 flex items-center justify-between text-sm font-medium'>
            <span>Transcription</span>
            {lastResponse?.warning ? (
              <span className='text-amber-600 text-xs font-semibold'>
                {lastResponse.warning}
              </span>
            ) : null}
          </div>
          <div className='text-slate-700 mt-2 text-sm'>
            {transcription || 'No transcript yet.'}
          </div>
        </div>

        <div className='border-slate-100 bg-white rounded-lg border p-3'>
          <div className='text-slate-800 flex items-center justify-between text-sm font-medium'>
            <span>Audio Emotion</span>
            {audioEmotion?.confidence ? (
              <span className='text-slate-500 text-xs'>
                {Math.round((audioEmotion.confidence || 0) * 100)}%
              </span>
            ) : null}
          </div>
          <div className='text-slate-700 mt-2 text-sm'>
            {audioEmotion?.primary_emotion || 'Not available'}
          </div>
          {audioEmotion ? (
            <div className='text-slate-600 mt-2 grid grid-cols-3 gap-2 text-xs'>
              <Stat label='Valence' value={audioEmotion.valence} />
              <Stat label='Arousal' value={audioEmotion.arousal} />
              {audioEmotion.dominance !== undefined ? (
                <Stat label='Dominance' value={audioEmotion.dominance} />
              ) : null}
            </div>
          ) : null}
        </div>

        <div className='border-slate-100 bg-white rounded-lg border p-3'>
          <div className='text-slate-800 flex items-center justify-between text-sm font-medium'>
            <span>Fused Emotion</span>
            {fusedEmotion?.confidence ? (
              <span className='text-slate-500 text-xs'>
                {Math.round((fusedEmotion.confidence || 0) * 100)}%
              </span>
            ) : null}
          </div>
          <div className='text-slate-700 mt-2 text-sm'>
            {fusedSummary || 'Not available'}
          </div>
          {fusedEmotion ? (
            <div className='text-slate-600 mt-2 grid grid-cols-3 gap-2 text-xs'>
              <Stat label='Valence' value={fusedEmotion.valence} />
              <Stat label='Arousal' value={fusedEmotion.arousal} />
              <Stat label='EQ' value={fusedEmotion.overall_eq} />
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
      <div className='bg-slate-50 text-slate-500 rounded-md px-2 py-1'>—</div>
    )
  }

  return (
    <div className='bg-slate-50 text-slate-700 rounded-md px-2 py-1'>
      <div className='text-slate-500 text-[11px] uppercase tracking-wide'>
        {label}
      </div>
      <div className='font-semibold'>{value.toFixed(2)}</div>
    </div>
  )
}

function formatFusedSummary(fused: FusedEmotion): string {
  const { valence, arousal, overall_eq, conflict_score } = fused
  const parts = []
  if (overall_eq !== undefined)
    parts.push(`EQ ${(overall_eq * 100).toFixed(0)}%`)
  if (valence !== undefined) parts.push(`Val ${(valence * 100).toFixed(0)}%`)
  if (arousal !== undefined) parts.push(`Aro ${(arousal * 100).toFixed(0)}%`)
  if (conflict_score !== undefined) {
    parts.push(`Conflict ${(conflict_score * 100).toFixed(0)}%`)
  }
  return parts.join(' · ')
}

import { useCallback, useEffect, useRef, useState } from 'react'

type PermissionState = 'prompt' | 'granted' | 'denied'

type UseAudioCaptureOptions = {
    sampleRate?: number
    channelCount?: number
    chunkDurationMs?: number
    mimeType?: string
    echoCancellation?: boolean
    noiseSuppression?: boolean
    autoGainControl?: boolean
    onChunk?: (chunk: Blob) => void
}

type UseAudioCaptureReturn = {
    startRecording: () => Promise<void>
    stopRecording: () => Promise<Blob | null>
    pauseRecording: () => void
    resumeRecording: () => void
    reset: () => void
    isRecording: boolean
    isPaused: boolean
    permission: PermissionState
    durationMs: number
    audioBlob: Blob | null
    audioUrl: string | null
    error: string | null
}

export function useAudioCapture(
    options: UseAudioCaptureOptions = {}
): UseAudioCaptureReturn {
    const {
        sampleRate = 16000,
        channelCount = 1,
        chunkDurationMs = 1000,
        mimeType = 'audio/webm',
        echoCancellation = true,
        noiseSuppression = true,
        autoGainControl = true,
        onChunk,
    } = options

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const startTimeRef = useRef<number | null>(null)
    const durationIntervalRef = useRef<number | null>(null)

    const [permission, setPermission] = useState<PermissionState>('prompt')
    const [isRecording, setIsRecording] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [durationMs, setDurationMs] = useState(0)
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
    const [audioUrl, setAudioUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Clean up object URL when blob changes
    useEffect(() => {
        return () => {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl)
            }
        }
    }, [audioUrl])

    // Clear duration interval on unmount
    useEffect(() => {
        return () => {
            if (durationIntervalRef.current) {
                window.clearInterval(durationIntervalRef.current)
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop()
            }
            streamRef.current?.getTracks().forEach((track) => track.stop())
        }
    }, [])

    const updateDuration = useCallback(() => {
        if (startTimeRef.current) {
            setDurationMs(Date.now() - startTimeRef.current)
        }
    }, [])

    const startRecording = useCallback(async () => {
        if (isRecording) return

        try {
            setError(null)
            setAudioBlob(null)
            setAudioUrl(null)
            chunksRef.current = []

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate,
                    channelCount,
                    echoCancellation,
                    noiseSuppression,
                    autoGainControl,
                },
            })

            streamRef.current = stream
            setPermission('granted')

            const recorder = new MediaRecorder(stream, { mimeType })
            mediaRecorderRef.current = recorder

            recorder.ondataavailable = (event: BlobEvent) => {
                if (event.data && event.data.size > 0) {
                    chunksRef.current.push(event.data)
                    if (onChunk) {
                        onChunk(event.data)
                    }
                }
            }

            recorder.onerror = (event: MediaRecorderErrorEvent) => {
                setError(event.error?.message || 'Recording error')
            }

            recorder.onstop = () => {
                const combined = new Blob(chunksRef.current, { type: mimeType })
                setAudioBlob(combined)
                const url = URL.createObjectURL(combined)
                setAudioUrl(url)
            }

            recorder.start(chunkDurationMs)
            startTimeRef.current = Date.now()
            setDurationMs(0)
            durationIntervalRef.current = window.setInterval(updateDuration, 200)

            setIsRecording(true)
            setIsPaused(false)
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Microphone access failed'
            setError(message)
            setPermission('denied')
        }
    }, [
        autoGainControl,
        channelCount,
        chunkDurationMs,
        echoCancellation,
        isRecording,
        mimeType,
        noiseSuppression,
        onChunk,
        sampleRate,
        updateDuration,
    ])

    const stopRecording = useCallback(async (): Promise<Blob | null> => {
        if (!mediaRecorderRef.current) return null

        return new Promise<Blob | null>((resolve) => {
            const recorder = mediaRecorderRef.current

            const handleStop = () => {
                recorder.removeEventListener('stop', handleStop)
                setIsRecording(false)
                setIsPaused(false)
                if (durationIntervalRef.current) {
                    window.clearInterval(durationIntervalRef.current)
                }
                const combined = new Blob(chunksRef.current, { type: mimeType })
                setAudioBlob(combined)
                const url = URL.createObjectURL(combined)
                setAudioUrl(url)
                resolve(combined)
            }

            recorder.addEventListener('stop', handleStop)
            if (recorder.state !== 'inactive') {
                recorder.stop()
            }
            streamRef.current?.getTracks().forEach((track) => track.stop())
        })
    }, [mimeType])

    const pauseRecording = useCallback(() => {
        if (!mediaRecorderRef.current) return
        if (mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause()
            setIsPaused(true)
        }
    }, [])

    const resumeRecording = useCallback(() => {
        if (!mediaRecorderRef.current) return
        if (mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume()
            setIsPaused(false)
        }
    }, [])

    const reset = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop()
        }
        streamRef.current?.getTracks().forEach((track) => track.stop())
        chunksRef.current = []
        setAudioBlob(null)
        setAudioUrl(null)
        setDurationMs(0)
        setIsRecording(false)
        setIsPaused(false)
        setError(null)
    }, [])

    return {
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        reset,
        isRecording,
        isPaused,
        permission,
        durationMs,
        audioBlob,
        audioUrl,
        error,
    }
}

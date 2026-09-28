import { useState, useRef, useCallback, useEffect } from 'react'

import type { TelehealthProvider } from '@/lib/ehr-native/types'

import {
  PreCallCheck,
  type DeviceCheckResult as ComponentDeviceCheckResult,
} from './PreCallCheck'
import { RecordingConsentGate } from './RecordingConsentGate'

/**
 * Main telehealth session component.
 * One-click join from Appointment, pre-call check gate, video canvas, recording controls.
 *
 * F1.12 — Native Telehealth: WebRTC primary, Zoom fallback.
 */

export interface TelehealthSessionProps {
  appointmentId: string
  patientId: string
  practitionerId: string
  patientName: string
  providerType?: TelehealthProvider
  zoomJoinUrl?: string
  onSessionStart?: (provider: TelehealthProvider) => void
  onSessionEnd?: () => void
  onStartRecording?: (consentGiven: boolean) => void
  onStopRecording?: () => void
}

type SessionPhase = 'pre-check' | 'connecting' | 'active' | 'ended' | 'failed'

interface SessionState {
  phase: SessionPhase
  provider: TelehealthProvider | null
  isRecording: boolean
  showConsentGate: boolean
  errorMessage: string | null
}

function createInitialSessionState(): SessionState {
  return {
    phase: 'pre-check',
    provider: null,
    isRecording: false,
    showConsentGate: false,
    errorMessage: null,
  }
}

/**
 * Attempt to establish a WebRTC connection.
 * Returns true on success, false to trigger Zoom fallback.
 */
async function tryWebRTC(): Promise<boolean> {
  if (typeof RTCPeerConnection === 'undefined') {
    return false
  }
  let pc: RTCPeerConnection | undefined
  try {
    pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    })
    await pc.setLocalDescription(offer)
    return true
  } catch {
    return false
  } finally {
    pc?.close()
  }
}

/**
 * Open Zoom join URL in a new window.
 */
function openZoom(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function TelehealthSession({
  appointmentId,
  patientId,
  practitionerId,
  patientName,
  providerType = 'webrtc',
  zoomJoinUrl,
  onSessionStart,
  onSessionEnd,
  onStartRecording,
  onStopRecording,
}: TelehealthSessionProps) {
  const [state, setState] = useState<SessionState>(createInitialSessionState)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (
      state.phase === 'active' &&
      streamRef.current &&
      localVideoRef.current
    ) {
      localVideoRef.current.srcObject = streamRef.current
    }
  }, [state.phase])

  const handleDeviceCheckComplete = useCallback(
    async (_result: ComponentDeviceCheckResult) => {
      setState((prev) => ({ ...prev, phase: 'connecting' }))

      // If a specific provider was requested, use it directly
      if (providerType === 'zoom' && zoomJoinUrl) {
        openZoom(zoomJoinUrl)
        setState((prev) => ({
          ...prev,
          phase: 'active',
          provider: 'zoom',
        }))
        onSessionStart?.('zoom')
        return
      }

      // Try WebRTC first
      const webRtcOk = await tryWebRTC()

      if (webRtcOk) {
        // Get local media stream for video preview
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          })
          streamRef.current = stream
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream
          }
        } catch {
          // Video preview failed but session can proceed (audio-only)
        }

        setState((prev) => ({
          ...prev,
          phase: 'active',
          provider: 'webrtc',
        }))
        onSessionStart?.('webrtc')
        return
      }

      // WebRTC failed — fall back to Zoom
      if (zoomJoinUrl) {
        openZoom(zoomJoinUrl)
        setState((prev) => ({
          ...prev,
          phase: 'active',
          provider: 'zoom',
        }))
        onSessionStart?.('zoom')
        return
      }

      // Both providers failed
      setState((prev) => ({
        ...prev,
        phase: 'failed',
        errorMessage:
          'Unable to establish WebRTC connection and no Zoom fallback URL provided.',
      }))
    },
    [providerType, zoomJoinUrl, onSessionStart],
  )

  const handleEndSession = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    setState((prev) => ({ ...prev, phase: 'ended', isRecording: false }))
    onSessionEnd?.()
  }, [onSessionEnd])

  const handleStartRecording = useCallback(() => {
    setState((prev) => ({ ...prev, showConsentGate: true }))
  }, [])

  const handleConsentGiven = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isRecording: true,
      showConsentGate: false,
    }))
    onStartRecording?.(true)
  }, [onStartRecording])

  const handleCancelRecording = useCallback(() => {
    setState((prev) => ({ ...prev, showConsentGate: false }))
  }, [])

  const handleStopRecording = useCallback(() => {
    setState((prev) => ({ ...prev, isRecording: false }))
    onStopRecording?.()
  }, [onStopRecording])

  return (
    <div
      className="flex flex-col gap-4 rounded-none border border-border bg-card p-4"
      data-testid="telehealth-session"
      data-appointment-id={appointmentId}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Telehealth Session — {patientName}
        </h2>
        <span
          className={`rounded-none px-3 py-1 text-xs font-medium ${
            state.phase === 'active'
              ? 'bg-primary text-primary-foreground'
              : state.phase === 'failed'
                ? 'border border-ring bg-secondary font-bold text-foreground'
                : 'bg-secondary text-muted-foreground'
          }`}
        >
          {state.phase}
        </span>
      </div>

      {state.phase === 'pre-check' && (
        <PreCallCheck
          onComplete={(_r) => void handleDeviceCheckComplete(_r)}
          onCancel={handleEndSession}
        />
      )}

      {state.phase === 'connecting' && (
        <div className="flex min-h-[300px] items-center justify-center text-muted-foreground">
          Connecting via {providerType}…
        </div>
      )}

      {state.phase === 'active' && (
        <>
          <div className="relative aspect-video overflow-hidden rounded-none bg-background">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
              aria-label="Your video preview"
            />
            {state.isRecording && (
              <div className="absolute right-3 top-3 flex items-center gap-2 rounded-none bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary-foreground" />
                REC
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {state.provider === 'webrtc' && (
              <>
                <button
                  type="button"
                  onClick={handleStartRecording}
                  disabled={state.isRecording}
                  className="hover:bg-primary/90 rounded-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Start Recording
                </button>
                <button
                  type="button"
                  onClick={handleStopRecording}
                  disabled={!state.isRecording}
                  className="rounded-none border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Stop Recording
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleEndSession}
              className="rounded-none border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
            >
              End Session
            </button>
          </div>
        </>
      )}

      {state.phase === 'failed' && state.errorMessage && (
        <div
          className="rounded-none border border-ring bg-secondary p-4 text-sm text-foreground"
          role="alert"
        >
          {state.errorMessage}
          <button
            type="button"
            onClick={handleEndSession}
            className="mt-3 rounded-none border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
          >
            Close
          </button>
        </div>
      )}

      {state.phase === 'ended' && (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
          <p className="text-muted-foreground">Session ended.</p>
          <button
            type="button"
            onClick={handleEndSession}
            className="rounded-none border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
          >
            Close
          </button>
        </div>
      )}

      {state.showConsentGate && (
        <RecordingConsentGate
          patientName={patientName}
          onConsent={handleConsentGiven}
          onCancel={handleCancelRecording}
        />
      )}
    </div>
  )
}

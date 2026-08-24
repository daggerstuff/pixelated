import { useState, useRef, useCallback, useEffect } from 'react';

import type { TelehealthProvider } from '@/lib/ehr-native/types';

import { PreCallCheck, type DeviceCheckResult as ComponentDeviceCheckResult } from './PreCallCheck';
import { RecordingConsentGate } from './RecordingConsentGate';

/**
 * Main telehealth session component.
 * One-click join from Appointment, pre-call check gate, video canvas, recording controls.
 *
 * F1.12 — Native Telehealth: WebRTC primary, Zoom fallback.
 */

export interface TelehealthSessionProps {
  appointmentId: string;
  patientId: string;
  practitionerId: string;
  patientName: string;
  providerType?: TelehealthProvider;
  zoomJoinUrl?: string;
  onSessionStart?: (provider: TelehealthProvider) => void;
  onSessionEnd?: () => void;
  onStartRecording?: (consentGiven: boolean) => void;
  onStopRecording?: () => void;
}

type SessionPhase = 'pre-check' | 'connecting' | 'active' | 'ended' | 'failed';

interface SessionState {
  phase: SessionPhase;
  provider: TelehealthProvider | null;
  isRecording: boolean;
  showConsentGate: boolean;
  errorMessage: string | null;
}

function createInitialSessionState(): SessionState {
  return {
    phase: 'pre-check',
    provider: null,
    isRecording: false,
    showConsentGate: false,
    errorMessage: null,
  };
}

/**
 * Attempt to establish a WebRTC connection.
 * Returns true on success, false to trigger Zoom fallback.
 */
async function tryWebRTC(): Promise<boolean> {
  if (typeof RTCPeerConnection === 'undefined') {
    return false;
  }
  try {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    // Create a minimal offer to verify the API works
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);
    pc.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Open Zoom join URL in a new window.
 */
function openZoom(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
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
  const [state, setState] = useState<SessionState>(createInitialSessionState);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const handleDeviceCheckComplete = useCallback(
    async (_result: ComponentDeviceCheckResult) => {
      setState((prev) => ({ ...prev, phase: 'connecting' }));

      // If a specific provider was requested, use it directly
      if (providerType === 'zoom' && zoomJoinUrl) {
        openZoom(zoomJoinUrl);
        setState((prev) => ({
          ...prev,
          phase: 'active',
          provider: 'zoom',
        }));
        onSessionStart?.('zoom');
        return;
      }

      // Try WebRTC first
      const webRtcOk = await tryWebRTC();

      if (webRtcOk) {
        // Get local media stream for video preview
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          streamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        } catch {
          // Video preview failed but session can proceed (audio-only)
        }

        setState((prev) => ({
          ...prev,
          phase: 'active',
          provider: 'webrtc',
        }));
        onSessionStart?.('webrtc');
        return;
      }

      // WebRTC failed — fall back to Zoom
      if (zoomJoinUrl) {
        openZoom(zoomJoinUrl);
        setState((prev) => ({
          ...prev,
          phase: 'active',
          provider: 'zoom',
        }));
        onSessionStart?.('zoom');
        return;
      }

      // Both providers failed
      setState((prev) => ({
        ...prev,
        phase: 'failed',
        errorMessage:
          'Unable to establish WebRTC connection and no Zoom fallback URL provided.',
      }));
    },
    [providerType, zoomJoinUrl, onSessionStart],
  );

  const handleEndSession = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    setState((prev) => ({ ...prev, phase: 'ended', isRecording: false }));
    onSessionEnd?.();
  }, [onSessionEnd]);

  const handleStartRecording = useCallback(() => {
    setState((prev) => ({ ...prev, showConsentGate: true }));
  }, []);

  const handleConsentGiven = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isRecording: true,
      showConsentGate: false,
    }));
    onStartRecording?.(true);
  }, [onStartRecording]);

  const handleCancelRecording = useCallback(() => {
    setState((prev) => ({ ...prev, showConsentGate: false }));
  }, []);

  const handleStopRecording = useCallback(() => {
    setState((prev) => ({ ...prev, isRecording: false }));
    onStopRecording?.();
  }, [onStopRecording]);

  return (
    <div
      className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      data-testid="telehealth-session"
      data-appointment-id={appointmentId}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Telehealth Session — {patientName}
        </h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            state.phase === 'active'
              ? 'bg-green-100 text-green-700'
              : state.phase === 'failed'
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-600'
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
        <div className="flex min-h-[300px] items-center justify-center text-gray-500">
          Connecting via {providerType}…
        </div>
      )}

      {state.phase === 'active' && (
        <>
          <div className="relative aspect-video overflow-hidden rounded-md bg-gray-900">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
              aria-label="Your video preview"
            />
            {state.isRecording && (
              <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
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
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  Start Recording
                </button>
                <button
                  type="button"
                  onClick={handleStopRecording}
                  disabled={!state.isRecording}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Stop Recording
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleEndSession}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              End Session
            </button>
          </div>
        </>
      )}

      {state.phase === 'failed' && state.errorMessage && (
        <div
          className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          {state.errorMessage}
          <button
            type="button"
            onClick={handleEndSession}
            className="mt-3 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Close
          </button>
        </div>
      )}

      {state.phase === 'ended' && (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
          <p className="text-gray-600">Session ended.</p>
          <button
            type="button"
            onClick={handleEndSession}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
  );
}

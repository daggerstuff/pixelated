import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Pre-call device check component.
 * Verifies camera and microphone availability before joining a telehealth session.
 * Blocks join on failure with actionable error messages.
 *
 * F1.12 — Native Telehealth
 */

export interface PreCallCheckProps {
  onComplete: (result: DeviceCheckResult) => void
  onCancel: () => void
}

export interface DeviceCheckResult {
  cameraAvailable: boolean
  microphoneAvailable: boolean
  cameraLabel?: string
  microphoneLabel?: string
  errors: string[]
}

interface DeviceState {
  checked: boolean
  checking: boolean
  result: DeviceCheckResult | null
}

function createInitialDeviceState(): DeviceState {
  return { checked: false, checking: false, result: null }
}

/**
 * Check if a MediaDeviceInfo is a video input device.
 */
function isVideoDevice(device: MediaDeviceInfo): boolean {
  return device.kind === 'videoinput'
}

/**
 * Check if a MediaDeviceInfo is an audio input device.
 */
function isAudioDevice(device: MediaDeviceInfo): boolean {
  return device.kind === 'audioinput'
}

/**
 * Run device checks using the browser's mediaDevices API.
 * Returns a DeviceCheckResult with availability and any errors.
 */
async function runDeviceChecks(): Promise<DeviceCheckResult> {
  const errors: string[] = []

  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    return {
      cameraAvailable: false,
      microphoneAvailable: false,
      errors: ['Media devices API not available in this environment.'],
    }
  }

  let devices: MediaDeviceInfo[] = []
  try {
    devices = await navigator.mediaDevices.enumerateDevices()
  } catch {
    return {
      cameraAvailable: false,
      microphoneAvailable: false,
      errors: ['Failed to enumerate media devices. Check browser permissions.'],
    }
  }

  const camera = devices.find(isVideoDevice)
  const microphone = devices.find(isAudioDevice)

  // Try to get actual tracks to verify the devices work
  let cameraAvailable = camera !== undefined
  let microphoneAvailable = microphone !== undefined

  // Verify camera with getUserMedia
  if (cameraAvailable) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach((track) => track.stop())
    } catch {
      cameraAvailable = false
      errors.push(
        'Camera not accessible. Check that no other app is using it and permissions are granted.',
      )
    }
  } else {
    errors.push('No camera device found. Connect a camera to join the session.')
  }

  // Verify microphone with getUserMedia
  if (microphoneAvailable) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
    } catch {
      microphoneAvailable = false
      errors.push(
        'Microphone not accessible. Check that no other app is using it and permissions are granted.',
      )
    }
  } else {
    errors.push(
      'No microphone device found. Connect a microphone to join the session.',
    )
  }

  return {
    cameraAvailable,
    microphoneAvailable,
    cameraLabel: camera?.label,
    microphoneLabel: microphone?.label,
    errors,
  }
}

export function PreCallCheck({ onComplete, onCancel }: PreCallCheckProps) {
  const [state, setState] = useState<DeviceState>(createInitialDeviceState)
  const hasCheckedRef = useRef(false)

  const checkDevices = useCallback(async () => {
    setState((prev) => ({ ...prev, checking: true }))
    const result = await runDeviceChecks()
    setState({ checked: true, checking: false, result })
  }, [])

  useEffect(() => {
    if (hasCheckedRef.current) return
    hasCheckedRef.current = true
    void checkDevices()
  }, [checkDevices])

  const canJoin =
    state.result?.cameraAvailable && state.result?.microphoneAvailable

  return (
    <div
      className="border-gray-200 bg-white flex min-h-[400px] flex-col items-center justify-center gap-6 rounded-lg border p-8 shadow-sm"
      role="dialog"
      aria-label="Pre-call device check"
    >
      <div className="text-center">
        <h2 className="text-gray-900 text-xl font-semibold">Device Check</h2>
        <p className="text-gray-600 mt-1 text-sm">
          Verifying your camera and microphone before joining the session.
        </p>
      </div>

      {state.checking && (
        <div className="text-gray-500 flex items-center gap-3">
          <span
            className="border-gray-300 border-t-blue-500 h-5 w-5 animate-spin rounded-full border-2"
            aria-hidden="true"
          />
          <span>Checking devices…</span>
        </div>
      )}

      {state.checked && state.result && (
        <>
          <div className="w-full max-w-md space-y-3">
            <div className="flex items-center justify-between rounded-md border px-4 py-3">
              <span className="text-gray-700 text-sm font-medium">Camera</span>
              <span
                className={
                  state.result.cameraAvailable
                    ? 'text-green-600 text-sm font-medium'
                    : 'text-red-600 text-sm font-medium'
                }
              >
                {state.result.cameraAvailable ? '✓ Available' : '✗ Unavailable'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border px-4 py-3">
              <span className="text-gray-700 text-sm font-medium">
                Microphone
              </span>
              <span
                className={
                  state.result.microphoneAvailable
                    ? 'text-green-600 text-sm font-medium'
                    : 'text-red-600 text-sm font-medium'
                }
              >
                {state.result.microphoneAvailable
                  ? '✓ Available'
                  : '✗ Unavailable'}
              </span>
            </div>
          </div>

          {state.result.errors.length > 0 && (
            <div
              className="border-amber-200 bg-amber-50 w-full max-w-md rounded-md border p-4"
              role="alert"
            >
              <ul className="text-amber-800 list-disc space-y-1 pl-5 text-sm">
                {state.result.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void checkDevices()}
              className="border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md border px-4 py-2 text-sm font-medium"
            >
              Re-check
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md border px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canJoin}
              onClick={() => state.result && onComplete(state.result)}
              className={
                canJoin
                  ? 'bg-blue-600 text-white hover:bg-blue-700 rounded-md px-4 py-2 text-sm font-medium'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed rounded-md px-4 py-2 text-sm font-medium'
              }
            >
              Join Session
            </button>
          </div>
        </>
      )}
    </div>
  )
}

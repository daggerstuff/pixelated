import { useState, useCallback } from 'react'

/**
 * Recording consent gate component.
 * Requires explicit boolean consent before recording can start.
 * Part of F1.12 Native Telehealth — recording consent + audit trail.
 */

export interface RecordingConsentGateProps {
  patientName: string
  onConsent: () => void
  onCancel: () => void
}

interface ConsentState {
  checked: boolean
}

function createInitialConsentState(): ConsentState {
  return { checked: false }
}

export function RecordingConsentGate({
  patientName,
  onConsent,
  onCancel,
}: RecordingConsentGateProps) {
  const [state, setState] = useState<ConsentState>(createInitialConsentState)

  const handleConsent = useCallback(() => {
    onConsent()
  }, [onConsent])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Recording consent"
    >
      <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">
          Recording Consent Required
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          You are about to start recording this telehealth session with{' '}
          <span className="font-medium">{patientName}</span>. Recording requires
          explicit patient consent.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          The recording will be stored securely and an audit trail entry will be
          created. The patient has the right to withdraw consent at any time.
        </p>

        <label className="mt-4 flex items-start gap-3">
          <input
            type="checkbox"
            checked={state.checked}
            onChange={(e) => setState({ checked: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          <span className="text-sm text-gray-700">
            I confirm that the patient has explicitly consented to recording
            this session.
          </span>
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!state.checked}
            onClick={handleConsent}
            className={
              state.checked
                ? 'rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700'
                : 'cursor-not-allowed rounded-md bg-gray-300 px-4 py-2 text-sm font-medium text-gray-500'
            }
          >
            Start Recording
          </button>
        </div>
      </div>
    </div>
  )
}

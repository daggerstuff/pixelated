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
      className="bg-black/50 fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Recording consent"
    >
      <div className="bg-white mx-4 max-w-md rounded-lg p-6 shadow-xl">
        <h2 className="text-gray-900 text-lg font-semibold">
          Recording Consent Required
        </h2>
        <p className="text-gray-600 mt-2 text-sm">
          You are about to start recording this telehealth session with{' '}
          <span className="font-medium">{patientName}</span>. Recording requires
          explicit patient consent.
        </p>
        <p className="text-gray-600 mt-2 text-sm">
          The recording will be stored securely and an audit trail entry will be
          created. The patient has the right to withdraw consent at any time.
        </p>

        <label className="mt-4 flex items-start gap-3">
          <input
            type="checkbox"
            checked={state.checked}
            onChange={(e) => setState({ checked: e.target.checked })}
            className="border-gray-300 text-blue-600 mt-1 h-4 w-4 rounded"
          />
          <span className="text-gray-700 text-sm">
            I confirm that the patient has explicitly consented to recording
            this session.
          </span>
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md border px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!state.checked}
            onClick={handleConsent}
            className={
              state.checked
                ? 'bg-red-600 text-white hover:bg-red-700 rounded-md px-4 py-2 text-sm font-medium'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed rounded-md px-4 py-2 text-sm font-medium'
            }
          >
            Start Recording
          </button>
        </div>
      </div>
    </div>
  )
}

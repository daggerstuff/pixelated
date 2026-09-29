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
      <div className="mx-4 max-w-md rounded-none border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">
          Recording Consent Required
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You are about to start recording this telehealth session with{' '}
          <span className="font-medium text-foreground">{patientName}</span>.
          Recording requires explicit patient consent.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          The recording will be stored securely and an audit trail entry will be
          created. The patient has the right to withdraw consent at any time.
        </p>

        <label className="mt-4 flex items-start gap-3">
          <input
            type="checkbox"
            checked={state.checked}
            onChange={(e) => setState({ checked: e.target.checked })}
            className="mt-1 h-4 w-4 rounded-none border border-input"
          />
          <span className="text-sm text-foreground">
            I confirm that the patient has explicitly consented to recording
            this session.
          </span>
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-none border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!state.checked}
            onClick={handleConsent}
            className={
              state.checked
                ? 'hover:bg-primary/90 rounded-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground'
                : 'cursor-not-allowed rounded-none bg-secondary px-4 py-2 text-sm font-medium text-muted-foreground'
            }
          >
            Start Recording
          </button>
        </div>
      </div>
    </div>
  )
}

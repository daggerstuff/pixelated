import React, { useState, useEffect, useRef } from 'react'

import { FocusTrap } from '@/components/accessibility/FocusTrap'
import { generateConsentForm } from '@/simulator/utils/privacy'

interface ConsentDialogProps {
  isOpen: boolean
  onClose: () => void
  onConsent: (consent: boolean) => void
}

/**
 * Dialog for obtaining informed consent for anonymized metrics collection
 * Displays clear information about what data is and isn't collected
 */
export function ConsentDialog({
  isOpen,
  onClose,
  onConsent,
}: ConsentDialogProps) {
  const [checked, setChecked] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const { consentText, privacyPoints } = generateConsentForm()

  // Focus the dialog when it opens for accessibility
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus()
    }
  }, [isOpen])

  const handleConsentClick = () => {
    onConsent(true)
    onClose()
  }

  const handleDeclineClick = () => {
    onConsent(false)
    onClose()
  }

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
    }
  }

  // If dialog is not open, don't render anything
  if (!isOpen) {
    return null
  }

  return (
    <div className="bg-foreground/60 fixed inset-0 z-50 flex items-center justify-center p-4">
      <FocusTrap active={isOpen}>
        <div
          ref={dialogRef}
          tabIndex={-1}
          onKeyDown={handleDialogKeyDown}
          className="flex w-full max-w-2xl flex-col rounded-none border border-border bg-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-dialog-title"
          aria-describedby="consent-dialog-description"
        >
          {/* Header */}
          <div className="border-b p-4">
            <h2
              id="consent-dialog-title"
              className="text-xl font-semibold text-foreground"
            >
              Privacy & Data Collection Consent
            </h2>
          </div>

          {/* Content */}
          <div
            id="consent-dialog-description"
            className="max-h-[70vh] overflow-y-auto p-4"
          >
            <div className="mb-6">
              <svg
                className="mx-auto mb-3 h-16 w-16 text-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <p className="text-center font-medium text-foreground">
                Your privacy is our priority
              </p>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 font-medium text-foreground">
                About This Simulator
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                This therapeutic practice simulator is designed to help you
                improve your skills in a completely private environment. We take
                privacy and security seriously, especially when it comes to
                healthcare interactions.
              </p>

              <div className="mb-4">
                <h4 className="mb-2 font-medium text-foreground">
                  What we DO NOT collect or store:
                </h4>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>
                    No audio or video recordings are ever created or stored
                  </li>
                  <li>No conversation transcripts are saved</li>
                  <li>No personally identifiable information is collected</li>
                  <li>No data is sent to external servers or third parties</li>
                </ul>
              </div>

              <div className="mb-4">
                <h4 className="mb-2 font-medium text-foreground">
                  What you can optionally allow:
                </h4>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {privacyPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-none border border-border bg-secondary p-4">
              <div className="mb-4 flex items-start">
                <div className="flex h-5 items-center">
                  <input
                    id="consent-checkbox"
                    type="checkbox"
                    checked={checked}
                    onChange={() => setChecked(!checked)}
                    className="focus:ring-3 h-4 w-4 rounded-none border border-input bg-background focus:ring-ring"
                  />
                </div>
                <label
                  htmlFor="consent-checkbox"
                  className="ml-2 text-sm text-foreground"
                >
                  {consentText}
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                You can change your preference at any time from the metrics
                panel. You can always use the simulator without enabling metrics
                collection.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t p-4">
            <button
              onClick={handleDeclineClick}
              className="rounded-none border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Decline
            </button>
            <button
              onClick={handleConsentClick}
              disabled={!checked}
              className={`rounded-none px-4 py-2 text-sm font-medium text-primary-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                checked
                  ? 'hover:bg-primary/90 bg-primary'
                  : 'bg-primary/35 cursor-not-allowed'
              }`}
            >
              I Consent
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  )
}

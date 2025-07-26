'use client'

import { useState } from 'react'
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
  const [checked, setChecked] = useState<boolean>(false)
  const { consentText, privacyPoints } = generateConsentForm()

  const handleConsentClick = () => {
    onConsent(true)
    onClose()
  }

  const handleDeclineClick = () => {
    onConsent(false)
    onClose()
  }

  // If dialog is not open, don't render anything
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">
            Privacy & Data Collection Consent
          </h2>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[70vh]">
          <div className="mb-6">
            <svg
              className="w-16 h-16 text-blue-500 mx-auto mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>

            <p className="text-center text-gray-700 font-medium">
              Your privacy is our priority
            </p>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">
              About This Simulator
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This therapeutic practice simulator is designed to help you
              improve your skills in a completely private environment. We take
              privacy and security seriously, especially when it comes to
              healthcare interactions.
            </p>

            <div className="mb-4">
              <h4 className="font-medium text-blue-800 mb-2">
                What we DO NOT collect or store:
              </h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc pl-5">
                <li>No audio or video recordings are ever created or stored</li>
                <li>No conversation transcripts are saved</li>
                <li>No personally identifiable information is collected</li>
                <li>No data is sent to external servers or third parties</li>
              </ul>
            </div>

            <div className="mb-4">
              <h4 className="font-medium text-blue-800 mb-2">
                What you can optionally allow:
              </h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc pl-5">
                {privacyPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
            <div className="flex items-start mb-4">
              <div className="flex items-center h-5">
                <input
                  id="consent-checkbox"
                  type="checkbox"
                  checked={checked}
                  onChange={() => setChecked(!checked)}
                  className="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-3 focus:ring-blue-300"
                />
              </div>
              <label
                htmlFor="consent-checkbox"
                className="ml-2 text-sm text-gray-700"
              >
                {consentText}
              </label>
            </div>

            <p className="text-xs text-gray-500">
              You can change your preference at any time from the metrics panel.
              You can always use the simulator without enabling metrics
              collection.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-3">
          <button
            onClick={handleDeclineClick}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-md"
          >
            Decline
          </button>

          <button
            onClick={handleConsentClick}
            disabled={!checked}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
              checked
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-blue-300 cursor-not-allowed'
            }`}
          >
            I Consent
          </button>
        </div>
      </div>
    </div>
  )
}

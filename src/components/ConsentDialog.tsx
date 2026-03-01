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
    <div className='bg-black fixed inset-0 z-50 flex items-center justify-center bg-opacity-50 p-4'>
      <div className='bg-white flex w-full max-w-2xl flex-col rounded-lg shadow-xl'>
        {/* Header */}
        <div className='border-b p-4'>
          <h2 className='text-gray-800 text-xl font-semibold'>
            Privacy & Data Collection Consent
          </h2>
        </div>

        {/* Content */}
        <div className='max-h-[70vh] overflow-y-auto p-4'>
          <div className='mb-6'>
            <svg
              className='text-blue-500 mx-auto mb-3 h-16 w-16'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
              />
            </svg>

            <p className='text-gray-700 text-center font-medium'>
              Your privacy is our priority
            </p>
          </div>

          <div className='mb-6'>
            <h3 className='text-gray-800 mb-2 font-medium'>
              About This Simulator
            </h3>
            <p className='text-gray-600 mb-4 text-sm'>
              This therapeutic practice simulator is designed to help you
              improve your skills in a completely private environment. We take
              privacy and security seriously, especially when it comes to
              healthcare interactions.
            </p>

            <div className='mb-4'>
              <h4 className='text-blue-800 mb-2 font-medium'>
                What we DO NOT collect or store:
              </h4>
              <ul className='text-gray-600 list-disc space-y-1 pl-5 text-sm'>
                <li>No audio or video recordings are ever created or stored</li>
                <li>No conversation transcripts are saved</li>
                <li>No personally identifiable information is collected</li>
                <li>No data is sent to external servers or third parties</li>
              </ul>
            </div>

            <div className='mb-4'>
              <h4 className='text-blue-800 mb-2 font-medium'>
                What you can optionally allow:
              </h4>
              <ul className='text-gray-600 list-disc space-y-1 pl-5 text-sm'>
                {privacyPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className='bg-gray-50 border-gray-200 rounded-md border p-4'>
            <div className='mb-4 flex items-start'>
              <div className='flex h-5 items-center'>
                <input
                  id='consent-checkbox'
                  type='checkbox'
                  checked={checked}
                  onChange={() => setChecked(!checked)}
                  className='border-gray-300 bg-gray-50 focus:ring-3 focus:ring-blue-300 h-4 w-4 rounded border'
                />
              </div>
              <label
                htmlFor='consent-checkbox'
                className='text-gray-700 ml-2 text-sm'
              >
                {consentText}
              </label>
            </div>

            <p className='text-gray-500 text-xs'>
              You can change your preference at any time from the metrics panel.
              You can always use the simulator without enabling metrics
              collection.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className='flex justify-end gap-3 border-t p-4'>
          <button
            onClick={handleDeclineClick}
            className='text-gray-700 bg-white hover:bg-gray-50 border-gray-300 rounded-md border px-4 py-2 text-sm font-medium'
          >
            Decline
          </button>

          <button
            onClick={handleConsentClick}
            disabled={!checked}
            className={`text-white rounded-md px-4 py-2 text-sm font-medium ${
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

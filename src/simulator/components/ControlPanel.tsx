import React from 'react'

interface ControlPanelProps {
  isConnected: boolean
  isProcessing: boolean
  onStart: () => void
  onEnd: () => void
  className?: string
}

/**
 * Control panel for starting, ending, and controlling simulations
 */
const ControlPanel: React.FC<ControlPanelProps> = ({
  isConnected,
  isProcessing,
  onStart,
  onEnd,
  className = '',
}) => {
  return (
    <div
      className={`control-panel bg-white border-gray-200 flex items-center justify-between rounded-lg border p-3 ${className}`}
    >
      <div className='flex items-center space-x-2'>
        {/* Simulation status */}
        <div className='bg-gray-100 text-gray-700 flex items-center rounded-md px-3 py-1.5 text-sm'>
          <span
            className={`mr-2 h-2.5 w-2.5 rounded-full ${
              isConnected
                ? 'bg-green-500'
                : isProcessing
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-gray-400'
            }`}
          />

          <span className='font-medium'>
            {isConnected
              ? 'Simulation in progress'
              : isProcessing
                ? 'Connecting...'
                : 'Ready'}
          </span>
        </div>
      </div>

      <div className='flex items-center space-x-2'>
        {/* Start button - shows only when not connected */}
        {!isConnected && (
          <button
            onClick={onStart}
            disabled={isProcessing}
            className={`flex items-center rounded-md px-4 py-2 text-sm font-medium ${
              isProcessing
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 focus:outline-none focus:ring-2 focus:ring-offset-2'
            }`}
          >
            {isProcessing ? (
              <>
                <svg
                  className='text-gray-400 -ml-1 mr-2 h-4 w-4 animate-spin'
                  xmlns='http://www.w3.org/2000/svg'
                  fill='none'
                  viewBox='0 0 24 24'
                >
                  <circle
                    className='opacity-25'
                    cx='12'
                    cy='12'
                    r='10'
                    stroke='currentColor'
                    strokeWidth='4'
                  ></circle>
                  <path
                    className='opacity-75'
                    fill='currentColor'
                    d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                  ></path>
                </svg>
                Connecting...
              </>
            ) : (
              <>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='-ml-0.5 mr-2 h-4 w-4'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z'
                  />

                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                  />
                </svg>
                Start Simulation
              </>
            )}
          </button>
        )}

        {/* End button - shows only when connected */}
        {isConnected && (
          <button
            onClick={onEnd}
            className='bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 flex items-center rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='-ml-0.5 mr-2 h-4 w-4'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
              />

              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z'
              />
            </svg>
            End Simulation
          </button>
        )}
      </div>
    </div>
  )
}

export default ControlPanel

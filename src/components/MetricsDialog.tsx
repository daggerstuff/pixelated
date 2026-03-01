import { useAnonymizedMetrics } from '@/simulator'

interface MetricsDialogProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Dialog component to display anonymized metrics from practice sessions
 * Only shows data that has been anonymized and collected with user consent
 */
export function MetricsDialog({ isOpen, onClose }: MetricsDialogProps) {
  const metrics = useAnonymizedMetrics()

  if (!isOpen) {
    return null
  }

  return (
    <div className='bg-black fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-opacity-50 p-4'>
      <div className='bg-white dark:bg-gray-800 relative w-full max-w-md rounded-lg p-6'>
        <button
          onClick={onClose}
          className='text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 absolute right-3 top-3'
        >
          <svg
            className='h-5 w-5'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth='2'
              d='M6 18L18 6M6 6l12 12'
            />
          </svg>
        </button>

        <h3 className='mb-6 text-xl font-semibold'>Practice Progress</h3>

        <div className='space-y-6'>
          <div>
            <h4 className='text-md mb-2 font-medium'>Overview</h4>
            <div className='grid grid-cols-2 gap-4'>
              <div className='bg-gray-100 dark:bg-gray-700 rounded-lg p-3'>
                <p className='text-gray-500 dark:text-gray-400 text-xs'>
                  Total Sessions
                </p>
                <p className='text-2xl font-bold'>{metrics.sessionCount}</p>
              </div>
              <div className='bg-gray-100 dark:bg-gray-700 rounded-lg p-3'>
                <p className='text-gray-500 dark:text-gray-400 text-xs'>
                  Average Score
                </p>
                <p className='text-2xl font-bold'>{metrics.averageScore}%</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className='text-md mb-2 font-medium'>Skills Breakdown</h4>
            <div className='space-y-2'>
              <div>
                <p className='mb-1 text-sm font-medium'>Skills Improving</p>
                {metrics.skillsImproving.length > 0 ? (
                  <ul className='text-gray-600 dark:text-gray-400 list-disc pl-5 text-sm'>
                    {metrics.skillsImproving.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                ) : (
                  <p className='text-gray-500 dark:text-gray-400 text-sm italic'>
                    Complete more practice sessions to see progress
                  </p>
                )}
              </div>
              <div>
                <p className='mb-1 text-sm font-medium'>Skills Needing Focus</p>
                {metrics.skillsNeeding.length > 0 ? (
                  <ul className='text-gray-600 dark:text-gray-400 list-disc pl-5 text-sm'>
                    {metrics.skillsNeeding.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                ) : (
                  <p className='text-gray-500 dark:text-gray-400 text-sm italic'>
                    Keep practicing to identify areas for improvement
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className='mt-8 flex justify-center'>
          <button
            onClick={onClose}
            className='bg-blue-600 text-white hover:bg-blue-700 rounded-md px-4 py-2'
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

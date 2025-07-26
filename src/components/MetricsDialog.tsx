'use client'

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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <h3 className="text-xl font-semibold mb-6">Practice Progress</h3>

        <div className="space-y-6">
          <div>
            <h4 className="text-md font-medium mb-2">Overview</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Total Sessions
                </p>
                <p className="text-2xl font-bold">{metrics.sessionCount}</p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Average Score
                </p>
                <p className="text-2xl font-bold">{metrics.averageScore}%</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-md font-medium mb-2">Skills Breakdown</h4>
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium mb-1">Skills Improving</p>
                {metrics.skillsImproving.length > 0 ? (
                  <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc pl-5">
                    {metrics.skillsImproving.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    Complete more practice sessions to see progress
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Skills Needing Focus</p>
                {metrics.skillsNeeding.length > 0 ? (
                  <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc pl-5">
                    {metrics.skillsNeeding.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    Keep practicing to identify areas for improvement
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

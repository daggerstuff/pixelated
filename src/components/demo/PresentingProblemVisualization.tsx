import type { FC } from 'react'
  PresentingProblemVisualizationProps
> = ({ events, presentingProblem }) => {
  // Sort events by time (rough chronological order)
  const sortedEvents = [...events].sort((a, b) => {
    // Simple sorting by extracting numbers from time strings
    const getTimeValue = (timeStr: string) => {
      const match = timeStr.match(/(\d+)\s*(month|week|day|year)/i)
      if (match && match[1] && match[2]) {
        const num = parseInt(match[1], 10)
        const unit = match[2].toLowerCase()

      if (match && match[1] && match[2]) {
        const num = parseInt(match[1], 10)
        const unit = match[2].toLowerCase()
        }
      if (match && match[1] && match[2]) {
        const num = parseInt(match[1], 10)
        const unit = match[2].toLowerCase()
    }
    if (intensity <= 0.66) {
      return 'bg-orange-200 border-orange-400'
    }
    return 'bg-red-200 border-red-400'
  }

  return (
    <div className="presenting-problem-visualization bg-white rounded-lg p-6 border shadow-sm">
      <h4 className="text-lg font-semibold text-gray-800 mb-4">
        Presenting Problem Development Timeline
      </h4>

      {/* Current Problem Summary */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
        <h5 className="font-medium text-blue-800 mb-2">
          Current Presenting Problem
        </h5>
        <p className="text-blue-700 text-sm">{presentingProblem}</p>
      </div>

      {/* Timeline Visualization */}
      {sortedEvents.length > 0 && (
        <div className="relative">
          <h5 className="font-medium text-gray-700 mb-4">
            Problem Development History
          </h5>

          {/* Timeline Line */}
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300"></div>

            {/* Timeline Events */}
            <div className="space-y-6">
              {sortedEvents.map((event, index) => (
                <div
                  key={`${event.time}-${event.description.slice(0, 20)}`}
                  className="relative flex items-start"
                >
                  {/* Timeline Dot */}
                  <div
                    className={`
                    relative z-10 flex items-center justify-center w-4 h-4 rounded-full border-2
                    ${getSeverityColor(index, sortedEvents.length)}
                  `}
                  >
                    <div className="w-2 h-2 rounded-full bg-current opacity-60"></div>
                  </div>

                  {/* Event Content */}
                  <div className="ml-6 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        {event.time}
                      </span>
                      <span className="text-xs text-gray-500">
                        Stage {index + 1} of {sortedEvents.length}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {event.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Severity Legend */}
          <div className="mt-6 p-3 bg-gray-50 rounded-lg">
            <h6 className="text-sm font-medium text-gray-700 mb-2">
              Severity Progression
            </h6>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-yellow-200 border border-yellow-400"></div>
                <span>Early Stage</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-orange-200 border border-orange-400"></div>
                <span>Developing</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-200 border border-red-400"></div>
                <span>Acute/Current</span>
              </div>
            </div>
          </div>

          {/* Problem Progression Analysis */}
          <div className="mt-4 p-3 bg-indigo-50 rounded-lg">
            <h6 className="text-sm font-medium text-indigo-800 mb-2">
              Clinical Insights
            </h6>
            <div className="text-xs text-indigo-700 space-y-1">
              <p>
                • <strong>Duration:</strong> Problem has been developing over{' '}
                {sortedEvents.length} documented stages
              </p>
              <p>
                • <strong>Pattern:</strong>{' '}
                {sortedEvents.length > 2
                  ? 'Progressive escalation with identifiable triggers'
                  : 'Recent onset with clear precipitating factors'}
              </p>
              <p>
                • <strong>Intervention Window:</strong>{' '}
                {sortedEvents.length <= 2
                  ? 'Early intervention opportunity'
                  : 'Established pattern requiring comprehensive treatment'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {sortedEvents.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-sm">
            Add timeline events to visualize problem development
          </p>
        </div>
      )}
    </div>
  )
}

export default PresentingProblemVisualization
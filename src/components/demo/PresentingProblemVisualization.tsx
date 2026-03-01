import React, { FC } from 'react'

import type { PresentingProblemEvent } from '../../lib/types/psychology-pipeline'

interface PresentingProblemVisualizationProps {
  events: PresentingProblemEvent[]
  presentingProblem: string
}

const PresentingProblemVisualization: FC<
  PresentingProblemVisualizationProps
> = ({ events, presentingProblem }) => {
  // Sort events by time (rough chronological order)
  const sortedEvents = [...events].sort((a, b) => {
    // Simple sorting by extracting numbers from time strings
    const getTimeValue = (timeStr: string) => {
      const match = timeStr.match(/(\d+)\s*(month|week|day|year)/i)
      if (!match) {
        return 0
      }
      const num = parseInt(match[1], 10)
      const unit = match[2].toLowerCase()

      switch (unit) {
        case 'year':
          return num * 365
        case 'month':
          return num * 30
        case 'week':
          return num * 7
        case 'day':
          return num
        default:
          return num
      }
    }

    return getTimeValue(b.time) - getTimeValue(a.time) // Reverse chronological
  })

  const getSeverityColor = (index: number, total: number) => {
    const intensity = (index + 1) / total
    if (intensity <= 0.33) {
      return 'bg-yellow-200 border-yellow-400'
    }
    if (intensity <= 0.66) {
      return 'bg-orange-200 border-orange-400'
    }
    return 'bg-red-200 border-red-400'
  }

  return (
    <div className='presenting-problem-visualization bg-white rounded-lg border p-6 shadow-sm'>
      <h4 className='text-gray-800 mb-4 text-lg font-semibold'>
        Presenting Problem Development Timeline
      </h4>

      {/* Current Problem Summary */}
      <div className='bg-blue-50 border-blue-400 mb-6 rounded-lg border-l-4 p-4'>
        <h5 className='text-blue-800 mb-2 font-medium'>
          Current Presenting Problem
        </h5>
        <p className='text-blue-700 text-sm'>{presentingProblem}</p>
      </div>

      {/* Timeline Visualization */}
      {sortedEvents.length > 0 && (
        <div className='relative'>
          <h5 className='text-gray-700 mb-4 font-medium'>
            Problem Development History
          </h5>

          {/* Timeline Line */}
          <div className='relative'>
            <div className='bg-gray-300 absolute bottom-0 left-8 top-0 w-0.5'></div>

            {/* Timeline Events */}
            <div className='space-y-6'>
              {sortedEvents.map((event, index) => (
                <div
                  key={`${event.time}-${event.description.slice(0, 20)}`}
                  className='relative flex items-start'
                >
                  {/* Timeline Dot */}
                  <div
                    className={`relative z-10 flex h-4 w-4 items-center justify-center rounded-full border-2 ${getSeverityColor(index, sortedEvents.length)} `}
                  >
                    <div className='bg-current h-2 w-2 rounded-full opacity-60'></div>
                  </div>

                  {/* Event Content */}
                  <div className='ml-6 flex-1'>
                    <div className='mb-1 flex items-center gap-3'>
                      <span className='text-gray-600 bg-gray-100 rounded px-2 py-1 text-sm font-medium'>
                        {event.time}
                      </span>
                      <span className='text-gray-500 text-xs'>
                        Stage {index + 1} of {sortedEvents.length}
                      </span>
                    </div>
                    <p className='text-gray-700 text-sm leading-relaxed'>
                      {event.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Severity Legend */}
          <div className='bg-gray-50 mt-6 rounded-lg p-3'>
            <h6 className='text-gray-700 mb-2 text-sm font-medium'>
              Severity Progression
            </h6>
            <div className='flex items-center gap-4 text-xs'>
              <div className='flex items-center gap-1'>
                <div className='bg-yellow-200 border-yellow-400 h-3 w-3 rounded-full border'></div>
                <span>Early Stage</span>
              </div>
              <div className='flex items-center gap-1'>
                <div className='bg-orange-200 border-orange-400 h-3 w-3 rounded-full border'></div>
                <span>Developing</span>
              </div>
              <div className='flex items-center gap-1'>
                <div className='bg-red-200 border-red-400 h-3 w-3 rounded-full border'></div>
                <span>Acute/Current</span>
              </div>
            </div>
          </div>

          {/* Problem Progression Analysis */}
          <div className='bg-indigo-50 mt-4 rounded-lg p-3'>
            <h6 className='text-indigo-800 mb-2 text-sm font-medium'>
              Clinical Insights
            </h6>
            <div className='text-indigo-700 space-y-1 text-xs'>
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
        <div className='text-gray-500 py-8 text-center'>
          <div className='bg-gray-100 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full'>
            <svg
              className='text-gray-400 h-8 w-8'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
          </div>
          <p className='text-sm'>
            Add timeline events to visualize problem development
          </p>
        </div>
      )}
    </div>
  )
}

export default PresentingProblemVisualization

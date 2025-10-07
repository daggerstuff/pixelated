import React, { useState, useEffect } from 'react'
import type { RealTimeFeedback, TherapeuticTechnique } from '../types'
import EmpathyMeter from './EmpathyMeter'

interface RealTimeFeedbackPanelProps {
  feedback: RealTimeFeedback[]
  detectedTechniques: TherapeuticTechnique[]
  emotionInsights: {
    energy: number
    valence: number
    dominance: number
  }
  className?: string
}

/**
 * Component for displaying real-time feedback during therapeutic sessions
 * Shows detected techniques, empathy levels, and improvement suggestions
 */
export default function RealTimeFeedbackPanel({
  feedback,
  detectedTechniques,
  emotionInsights,
  className = '',
}: RealTimeFeedbackPanelProps) {
  const [empathyHistory, setEmpathyHistory] = useState<number[]>([])
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null)

  // Update empathy history when emotionInsights changes
  useEffect(() => {
    // Calculate empathy score as weighted combination of valence and dominance
    // This is a simplified model - in a real implementation this would be more sophisticated
    const empathyScore =
      emotionInsights.valence * 0.7 + (1 - emotionInsights.dominance) * 0.3

    setEmpathyHistory((prev) => {
      const updated = [...prev, empathyScore]
      // Keep only the last 20 values
      return updated.slice(-20)
    })
  }, [emotionInsights])

  // Get most recent high-priority feedback
  const highPriorityFeedback = feedback
    .filter((item) => item.priority === 'high')
    .slice(-1)[0]

  // Format technique name for display
  const formatTechnique = (technique: string): string => {
    return technique
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Get color class based on feedback priority
  const getPriorityColorClass = (
    priority: 'low' | 'medium' | 'high' | undefined,
  ): string => {
    switch (priority) {
      case 'high':
        return 'border-red-200 bg-red-50'
      case 'medium':
        return 'border-amber-200 bg-amber-50'
      case 'low':
        return 'border-blue-200 bg-blue-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  // Get icon based on feedback type
  const getFeedbackIcon = (type: string): JSX.Element => {
    switch (type) {
      case 'empathetic_response':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        )

      case 'therapeutic_alliance':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-purple-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        )

      case 'technique_application':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        )

      case 'communication_style':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        )

      case 'question_formulation':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-cyan-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )

      case 'active_listening':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-indigo-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-4.242a1 1 0 011.414 0 1 1 0 010 1.414"
            />
          </svg>
        )

      default:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )
    }
  }

  return (
    <div
      className={`real-time-feedback-panel rounded-lg border border-gray-200 shadow-sm bg-white overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-700 flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-1 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          Real-Time Therapeutic Insights
        </h3>
        <span className="text-xs text-gray-500">
          Private &amp; Zero-Retention
        </span>
      </div>

      {/* Main content */}
      <div className="p-3">
        {/* Empathy Meter */}
        <div className="mb-4">
          <h4 className="text-xs font-medium text-gray-500 mb-2">
            THERAPEUTIC PRESENCE
          </h4>
          <div className="flex justify-center">
            <EmpathyMeter
              value={
                empathyHistory.length > 0
                  ? empathyHistory[empathyHistory.length - 1]
                  : 0.5
              }
              history={empathyHistory}
              width={200}
              height={100}
              showValue={true}
            />
          </div>
        </div>

        {/* Detected Techniques */}
        <div className="mb-4">
          <h4 className="text-xs font-medium text-gray-500 mb-2">
            DETECTED THERAPEUTIC TECHNIQUES
          </h4>
          {detectedTechniques.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {detectedTechniques.map((technique) => (
                <span
                  key={technique}
                  className="inline-block bg-blue-50 text-blue-700 rounded-full px-2 py-1 text-xs font-medium"
                >
                  {formatTechnique(technique)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">
              No techniques detected yet
            </p>
          )}
        </div>

        {/* High Priority Feedback */}
        {highPriorityFeedback && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-500 mb-2">
              PRIORITY FEEDBACK
            </h4>
            <div
              className={`rounded-lg border p-3 ${getPriorityColorClass(highPriorityFeedback.priority)}`}
            >
              <div className="flex gap-2">
                {getFeedbackIcon(highPriorityFeedback.type)}
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-1">
                    {highPriorityFeedback.suggestion}
                  </p>
                  <p className="text-xs text-gray-600">
                    {highPriorityFeedback.rationale}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Feedback History */}
        <div>
          <h4 className="text-xs font-medium text-gray-500 mb-2">
            FEEDBACK HISTORY
          </h4>
          {feedback.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {feedback
                .slice()
                .reverse()
                .map((item, index) => (
                  <button
                    key={`${item.timestamp}-${index}`}
                    className={`rounded-lg border text-sm p-2 cursor-pointer transition-colors w-full text-left ${getPriorityColorClass(item.priority)}`}
                    onClick={() =>
                      setExpandedFeedback(
                        expandedFeedback === `${item.timestamp}-${index}`
                          ? null
                          : `${item.timestamp}-${index}`,
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setExpandedFeedback(
                          expandedFeedback === `${item.timestamp}-${index}`
                            ? null
                            : `${item.timestamp}-${index}`,
                        )
                      }
                    }}
                    tabIndex={0}
                    aria-expanded={
                      expandedFeedback === `${item.timestamp}-${index}`
                    }
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-start gap-2">
                        {getFeedbackIcon(item.type)}
                        <span className="font-medium">{item.suggestion}</span>
                      </div>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 text-gray-400 transition-transform ${expandedFeedback === `${item.timestamp}-${index}` ? 'transform rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>

                    {expandedFeedback === `${item.timestamp}-${index}` && (
                      <div className="mt-2 ml-7 text-xs text-gray-600">
                        <p className="mb-1">{item.rationale}</p>
                        <p className="text-gray-500">
                          {new Date(item.timestamp).toLocaleTimeString()} •
                          {item.context &&
                            ` ${formatTechnique(item.context)} context`}
                        </p>
                      </div>
                    )}
                  </button>
                ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">
              No feedback recorded yet
            </p>
          )}
        </div>
      </div>

      {/* Privacy notice */}
      <div className="p-2 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          All analysis happens locally with zero data retention
        </p>
      </div>
    </div>
  )
}

// Example PHI audit logging - uncomment and customize as needed
// logger.info('Accessing PHI data', {
//   userId: 'user-id-here',
//   action: 'read',
//   dataType: 'patient-record',
//   recordId: 'record-id-here'
// });

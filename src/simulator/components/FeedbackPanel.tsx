import React from 'react'
import { useSimulator } from '../context/SimulatorContext'
import { FeedbackType } from '../types'

interface FeedbackPanelProps {
  className?: string
}

// Map of feedback types to user-friendly names
const feedbackTypeLabels: Record<FeedbackType, string> = {
  [FeedbackType.COMMUNICATION_STYLE]: 'Communication Style',
  [FeedbackType.TECHNIQUE_APPLICATION]: 'Technique Application',
  [FeedbackType.EMPATHETIC_RESPONSE]: 'Empathetic Response',
  [FeedbackType.THERAPEUTIC_ALLIANCE]: 'Therapeutic Alliance',
  [FeedbackType.QUESTION_FORMULATION]: 'Question Formulation',
  [FeedbackType.ACTIVE_LISTENING]: 'Active Listening',
  [FeedbackType.FRAMEWORK_ADHERENCE]: 'Framework Adherence',
  [FeedbackType.INTERVENTION_TIMING]: 'Intervention Timing',
  [FeedbackType.POSITIVE]: 'Positive Feedback',
  [FeedbackType.DEVELOPMENTAL]: 'Developmental Feedback',
  [FeedbackType.TECHNIQUE_SUGGESTION]: 'Technique Suggestion',
  [FeedbackType.ALTERNATIVE_APPROACH]: 'Alternative Approach',
}

// Map of feedback types to colors
const feedbackTypeColors: Record<FeedbackType, string> = {
  [FeedbackType.COMMUNICATION_STYLE]: 'bg-blue-100 text-blue-800',
  [FeedbackType.TECHNIQUE_APPLICATION]: 'bg-green-100 text-green-800',
  [FeedbackType.EMPATHETIC_RESPONSE]: 'bg-purple-100 text-purple-800',
  [FeedbackType.THERAPEUTIC_ALLIANCE]: 'bg-yellow-100 text-yellow-800',
  [FeedbackType.QUESTION_FORMULATION]: 'bg-indigo-100 text-indigo-800',
  [FeedbackType.ACTIVE_LISTENING]: 'bg-pink-100 text-pink-800',
  [FeedbackType.FRAMEWORK_ADHERENCE]: 'bg-teal-100 text-teal-800',
  [FeedbackType.INTERVENTION_TIMING]: 'bg-orange-100 text-orange-800',
  [FeedbackType.POSITIVE]: 'bg-green-100 text-green-800',
  [FeedbackType.DEVELOPMENTAL]: 'bg-blue-100 text-blue-800',
  [FeedbackType.TECHNIQUE_SUGGESTION]: 'bg-indigo-100 text-indigo-800',
  [FeedbackType.ALTERNATIVE_APPROACH]: 'bg-teal-100 text-teal-800',
}

// Map of priorities to colors
const priorityColors: Record<string, string> = {
  low: 'bg-gray-100',
  medium: 'bg-yellow-100',
  high: 'bg-red-100',
}

// Helper function to get border color based on feedback type
const getBorderColor = (type: FeedbackType): string => {
  switch (type) {
    case FeedbackType.EMPATHETIC_RESPONSE:
      return 'border-l-purple'
    case FeedbackType.TECHNIQUE_APPLICATION:
      return 'border-l-green'
    default:
      return 'border-l-blue'
  }
}

/**
 * Component for displaying real-time feedback during a simulation
 */
const FeedbackPanel: React.FC<FeedbackPanelProps> = ({ className = '' }) => {
  const { realtimeFeedback, clearFeedback, isConnected } = useSimulator()

  // Handle clearing feedback
  const handleClearFeedback = () => {
    clearFeedback()
  }

  return (
    <div
      className={`feedback-panel bg-white p-4 rounded-lg shadow-sm border border-gray-200 ${className}`}
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Real-Time Feedback
        </h2>

        {realtimeFeedback.length > 0 && (
          <button
            onClick={handleClearFeedback}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Clear
          </button>
        )}
      </div>

      {!isConnected && (
        <div className="bg-gray-50 p-4 rounded text-center text-gray-500 text-sm">
          Start a simulation to receive feedback
        </div>
      )}

      {isConnected && realtimeFeedback.length === 0 && (
        <div className="bg-gray-50 p-4 rounded text-center text-gray-500 text-sm">
          Waiting for feedback...
        </div>
      )}

      <div className="space-y-3 mt-2 max-h-[500px] overflow-y-auto pr-1">
        {realtimeFeedback.map((feedback, index) => (
          <div
            key={`${feedback.timestamp}-${index}`}
            className={`p-3 rounded-md border-l-4 ${priorityColors[feedback.priority]} ${getBorderColor(feedback.type as FeedbackType)}-500`}
          >
            <div className="flex justify-between items-start mb-1">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded ${feedbackTypeColors[feedback.type as FeedbackType]}`}
              >
                {feedbackTypeLabels[feedback.type as FeedbackType]}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(feedback.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            {feedback.context && (
              <div className="text-xs text-gray-500 italic mb-1">
                &quot;{feedback.context}&quot;
              </div>
            )}

            <div className="text-sm font-medium text-gray-800 mb-1">
              {feedback.suggestion}
            </div>

            <div className="text-xs text-gray-600">{feedback.rationale}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-gray-400 flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3 w-3 mr-1"
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
        Feedback is generated in real-time and is not recorded
      </div>
    </div>
  )
}

export default FeedbackPanel

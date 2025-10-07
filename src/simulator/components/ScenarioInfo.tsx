import React, { useState } from 'react'
import type { SimulationScenario, TherapeuticDomain } from '../types'

interface ScenarioInfoProps {
  scenario: SimulationScenario
  className?: string
}

// Map of therapeutic domains to user-friendly names
const domainLabels: Record<TherapeuticDomain, string> = {
  cognitive_behavioral: 'Cognitive Behavioral Therapy',
  psychodynamic: 'Psychodynamic Therapy',
  humanistic: 'Humanistic Therapy',
  family_systems: 'Family Systems Therapy',
  dialectical_behavioral: 'Dialectical Behavior Therapy',
  solution_focused: 'Solution-Focused Brief Therapy',
  motivational_interviewing: 'Motivational Interviewing',
  trauma_informed: 'Trauma-Informed Care',
  crisis_intervention: 'Crisis Intervention',
}

// Map of difficulty levels to colors
const difficultyColors: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800',
  intermediate: 'bg-yellow-100 text-yellow-800',
  advanced: 'bg-red-100 text-red-800',
}

/**
 * Component for displaying information about the current simulation scenario
 */
const ScenarioInfo: React.FC<ScenarioInfoProps> = ({
  scenario,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`scenario-info bg-white p-4 rounded-lg shadow-sm border border-gray-200 ${className}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            {scenario.title}
          </h2>
          <div className="flex flex-wrap gap-2 mt-1">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${difficultyColors[scenario.difficulty]}`}
            >
              {scenario.difficulty.charAt(0).toUpperCase() +
                scenario.difficulty.slice(1)}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-800">
              {domainLabels[scenario.domain]}
            </span>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600 focus:outline-none"
        >
          <span className="sr-only">{expanded ? 'Collapse' : 'Expand'}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-5 w-5 transform transition-transform ${expanded ? 'rotate-180' : ''}`}
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
        </button>
      </div>

      <div
        className={`transition-all duration-300 ease-in-out ${expanded ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0 overflow-hidden'}`}
      >
        <div className="space-y-3 text-sm text-gray-600">
          <p>{scenario.description}</p>

          <div>
            <div className="font-medium text-gray-700 mb-1">Context</div>
            <p>{scenario.scenarioContext}</p>
          </div>

          <div>
            <div className="font-medium text-gray-700 mb-1">
              Patient Background
            </div>
            <p>{scenario.patientBackground}</p>
          </div>

          <div>
            <div className="font-medium text-gray-700 mb-1">
              Presenting Issues
            </div>
            <ul className="list-disc list-inside">
              {scenario.presentingIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>

          {scenario.suggestedApproaches && (
            <div>
              <div className="font-medium text-gray-700 mb-1">
                Suggested Approaches
              </div>
              <ul className="list-disc list-inside">
                {scenario.suggestedApproaches.map((approach) => (
                  <li key={approach}>{approach}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="font-medium text-gray-700 mb-1">Target Skills</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {scenario.targetSkills.map((skill) => (
                <span
                  key={skill}
                  className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700"
                >
                  {skill
                    .split('_')
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 text-xs text-blue-600 hover:text-blue-800 focus:outline-none"
        >
          Show details
        </button>
      )}
    </div>
  )
}

export default ScenarioInfo

// Example PHI audit logging - uncomment and customize as needed
// logger.info('Accessing PHI data', {
//   userId: 'user-id-here',
//   action: 'read',
//   dataType: 'patient-record',
//   recordId: 'record-id-here'
// });

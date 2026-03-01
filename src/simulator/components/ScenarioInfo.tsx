import React, { useState } from 'react'

import type { Scenario, TherapeuticDomain } from '../types'

interface ScenarioInfoProps {
  scenario: Scenario
  className?: string
}

// Map of therapeutic domains to user-friendly names
const domainLabels: Record<TherapeuticDomain, string> = {
  [TherapeuticDomain.DEPRESSION]: 'Depression',
  [TherapeuticDomain.ANXIETY]: 'Anxiety',
  [TherapeuticDomain.TRAUMA]: 'Trauma',
  [TherapeuticDomain.SUBSTANCE_USE]: 'Substance Use',
  [TherapeuticDomain.GRIEF]: 'Grief',
  [TherapeuticDomain.RELATIONSHIP]: 'Relationship',
  [TherapeuticDomain.STRESS_MANAGEMENT]: 'Stress Management',
  [TherapeuticDomain.CRISIS_INTERVENTION]: 'Crisis Intervention',
  [TherapeuticDomain.EATING_DISORDERS]: 'Eating Disorders',
  [TherapeuticDomain.SELF_HARM]: 'Self Harm',
  [TherapeuticDomain.PERSONALITY_DISORDERS]: 'Personality Disorders',
  [TherapeuticDomain.DEVELOPMENTAL_DISORDERS]: 'Developmental Disorders',
  [TherapeuticDomain.PSYCHOSIS]: 'Psychosis',
  [TherapeuticDomain.BIPOLAR_DISORDER]: 'Bipolar Disorder',
  [TherapeuticDomain.SOMATIC_DISORDERS]: 'Somatic Disorders',
  [TherapeuticDomain.SLEEP_DISORDERS]: 'Sleep Disorders',
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
      className={`scenario-info bg-white border-gray-200 rounded-lg border p-4 shadow-sm ${className}`}
    >
      <div className='flex items-start justify-between'>
        <div>
          <h2 className='text-gray-800 text-lg font-semibold'>
            {scenario.title}
          </h2>
          <div className='mt-1 flex flex-wrap gap-2'>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${difficultyColors[scenario.difficulty]}`}
            >
              {scenario.difficulty.charAt(0).toUpperCase() +
                scenario.difficulty.slice(1)}
            </span>
            <span className='bg-blue-100 text-blue-800 rounded px-2 py-0.5 text-xs font-medium'>
              {domainLabels[scenario.domain]}
            </span>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className='text-gray-400 hover:text-gray-600 focus:outline-none'
        >
          <span className='sr-only'>{expanded ? 'Collapse' : 'Expand'}</span>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className={`h-5 w-5 transform transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M19 9l-7 7-7-7'
            />
          </svg>
        </button>
      </div>

      <div
        className={`transition-all duration-300 ease-in-out ${expanded ? 'mt-4 max-h-96 opacity-100' : 'max-h-0 overflow-hidden opacity-0'}`}
      >
        <div className='text-gray-600 space-y-3 text-sm'>
          <p>{scenario.description}</p>

          <div>
            <div className='text-gray-700 mb-1 font-medium'>Context</div>
            <p>{scenario.contextDescription}</p>
          </div>

          <div>
            <div className='text-gray-700 mb-1 font-medium'>
              Patient Background
            </div>
            <p>{scenario.clientBackground}</p>
          </div>

          <div>
            <div className='text-gray-700 mb-1 font-medium'>
              Presenting Issue
            </div>
            <p>{scenario.presentingIssue}</p>
          </div>

          {scenario.suggestedApproaches &&
            scenario.suggestedApproaches.length > 0 && (
              <div>
                <div className='text-gray-700 mb-1 font-medium'>
                  Suggested Approaches
                </div>
                <ul className='list-inside list-disc'>
                  {scenario.suggestedApproaches.map((approach: string) => (
                    <li key={approach}>{approach}</li>
                  ))}
                </ul>
              </div>
            )}

          <div>
            <div className='text-gray-700 mb-1 font-medium'>Target Skills</div>
            <div className='mt-1 flex flex-wrap gap-1'>
              {scenario.techniques.map((skill) => (
                <span
                  key={skill}
                  className='bg-gray-100 text-gray-700 rounded px-2 py-0.5 text-xs'
                >
                  {skill
                    .toString()
                    .split('_')
                    .map(
                      (word: string) =>
                        word.charAt(0).toUpperCase() + word.slice(1),
                    )
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
          className='text-blue-600 hover:text-blue-800 mt-2 text-xs focus:outline-none'
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

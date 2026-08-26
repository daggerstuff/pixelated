// Simple non-JSX simulator components for compatibility
import React from '@/lib/esm-compat/react'

// Simple simulator components without JSX
export function SimulatorProvider(props) {
  return React.createElement(React.Fragment, null, props.children)
}

export function SimulationContainer(props) {
  const { scenarioId, className = '' } = props

  return React.createElement(
    'div',
    { className },
    React.createElement(
      'div',
      { className: 'p-6' },
      React.createElement(
        'h3',
        { className: 'text-lg font-medium mb-4' },
        `Simulation: ${scenarioId}`,
      ),
      React.createElement(
        'p',
        { className: 'text-gray-600 mb-6' },
        'This is a placeholder for the simulation interface.',
      ),
      React.createElement(
        'div',
        { className: 'p-4 bg-gray-100 rounded-lg' },
        React.createElement(
          'p',
          { className: 'text-sm text-gray-700' },
          'Scenario description would appear here.',
        ),
      ),
    ),
  )
}

export function ScenarioSelector(props) {
  const { onSelect, className = '' } = props

  const scenarios = [
    {
      id: 'depression',
      name: 'Depression Assessment',
      difficulty: 'Intermediate',
    },
    { id: 'anxiety', name: 'Anxiety Management', difficulty: 'Beginner' },
    { id: 'trauma', name: 'Trauma-Informed Care', difficulty: 'Advanced' },
  ]

  return React.createElement(
    'div',
    { className },
    React.createElement(
      'div',
      { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' },
      scenarios.map((scenario) =>
        React.createElement(
          'div',
          {
            key: scenario.id,
            className: 'border rounded-lg p-4 hover:bg-gray-50 cursor-pointer',
            onClick: () => onSelect(scenario.id),
          },
          React.createElement(
            'h4',
            { className: 'font-medium mb-1' },
            scenario.name,
          ),
          React.createElement(
            'p',
            { className: 'text-sm text-gray-600 mb-2' },
            `Difficulty: ${scenario.difficulty}`,
          ),
          React.createElement(
            'button',
            {
              className: 'text-sm text-blue-600 hover:text-blue-800',
              onClick: (e) => {
                e.stopPropagation()
                onSelect(scenario.id)
              },
            },
            'Start Scenario →',
          ),
        ),
      ),
    ),
  )
}

export function useAnonymizedMetrics() {
  return {
    sessionCount: 0,
    averageScore: 0,
    skillsImproving: [],
    skillsNeeding: ['Active listening', 'Empathetic responses'],
    lastSessionDate: null,
  }
}

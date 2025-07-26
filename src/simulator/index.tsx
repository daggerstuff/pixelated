'use client'

import React from '@/lib/esm-compat/react'
import { useAnonymizedMetrics } from './hooks'

// Simple simulator components
export function SimulatorProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function SimulationContainer({
  scenarioId,
  className = '',
}: {
  scenarioId: string
  className?: string
}) {
  return (
    <div className={className}>
      <div className="p-6">
        <h3 className="text-lg font-medium mb-4">Simulation: {scenarioId}</h3>
        <p className="text-gray-600 mb-6">
          This is a placeholder for the simulation interface.
        </p>
        <div className="p-4 bg-gray-100 rounded-lg">
          <p className="text-sm text-gray-700">
            Scenario description would appear here.
          </p>
        </div>
      </div>
    </div>
  )
}

export function ScenarioSelector({
  onSelect,
  className = '',
}: {
  onSelect: (scenarioId: string) => void
  className?: string
}) {
  const scenarios = [
    {
      id: 'depression',
      name: 'Depression Assessment',
      difficulty: 'Intermediate',
    },
    { id: 'anxiety', name: 'Anxiety Management', difficulty: 'Beginner' },
    { id: 'trauma', name: 'Trauma-Informed Care', difficulty: 'Advanced' },
  ]

  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scenarios.map((scenario) => (
          <button
            key={scenario.id}
            className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer w-full text-left"
            onClick={() => onSelect(scenario.id)}
          >
            <h4 className="font-medium mb-1">{scenario.name}</h4>
            <p className="text-sm text-gray-600 mb-2">
              Difficulty: {scenario.difficulty}
            </p>
            <button
              className="text-sm text-blue-600 hover:text-blue-800"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                onSelect(scenario.id)
              }}
            >
              Start Scenario →
            </button>
          </button>
        ))}
      </div>
    </div>
  )
}

// Re-export the hook from the hooks directory
export { useAnonymizedMetrics } from './hooks'

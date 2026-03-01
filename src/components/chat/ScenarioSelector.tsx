import type { Scenario } from '@/types/scenarios'

import { IconChevronDown, IconUserCircle } from './icons'

interface ScenarioSelectorProps {
  scenarios: Scenario[]
  selectedScenario: Scenario
  showScenarios: boolean
  setShowScenarios: (show: boolean) => void
  onSelect: (scenario: Scenario) => void
}

export function ScenarioSelector({
  scenarios,
  selectedScenario,
  showScenarios,
  setShowScenarios,
  onSelect,
}: ScenarioSelectorProps) {
  return (
    <div className='relative mb-4'>
      <button
        onClick={() => setShowScenarios(!showScenarios)}
        className='border-purple-700 bg-black flex w-full items-center justify-between rounded-md border bg-opacity-50 p-2 text-left'
      >
        <span className='flex items-center'>
          <IconUserCircle className='text-purple-500 mr-2 h-5 w-5' />

          <span>
            Scenario: <strong>{selectedScenario.name}</strong>
          </span>
        </span>
        <IconChevronDown
          className={`h-5 w-5 transition-transform ${showScenarios ? 'rotate-180' : ''}`}
        />
      </button>

      {showScenarios && (
        <div className='bg-black border-purple-800 absolute z-10 mt-1 w-full rounded-md border bg-opacity-80 shadow-lg'>
          {scenarios.map((scenario) => (
            <button
              key={scenario.name}
              className='hover:bg-purple-900 block w-full px-4 py-2 text-left first:rounded-t-md last:rounded-b-md'
              onClick={() => onSelect(scenario)}
            >
              <div className='font-medium'>{scenario.name}</div>
              <div className='text-gray-300 text-sm'>
                {scenario.description}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

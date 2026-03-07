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
    <div className="relative mb-4">
      <button
        onClick={() => setShowScenarios(!showScenarios)}
        className="flex justify-between items-center w-full p-2 border border-purple-700 rounded-md bg-black bg-opacity-50 text-left"
      >
        <span className="flex items-center">
          <IconUserCircle className="h-5 w-5 mr-2 text-purple-500" />

          <span>
            Scenario: <strong>{selectedScenario.name}</strong>
          </span>
        </span>
        <IconChevronDown
          className={`h-5 w-5 transition-transform ${showScenarios ? 'rotate-180' : ''}`}
        />
      </button>

      {showScenarios && (
        <div className="absolute z-10 w-full mt-1 rounded-md shadow-lg bg-black bg-opacity-80 border border-purple-800">
          {scenarios.map((scenario) => (
            <button
              key={scenario.name}
              className="block w-full px-4 py-2 text-left hover:bg-purple-900 first:rounded-t-md last:rounded-b-md"
              onClick={() => onSelect(scenario)}
            >
              <div className="font-medium">{scenario.name}</div>
              <div className="text-sm text-gray-300">
                {scenario.description}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

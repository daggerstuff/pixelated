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
        className="flex w-full items-center justify-between rounded-none border border-border bg-card p-2 text-left"
      >
        <span className="flex items-center">
          <IconUserCircle className="mr-2 h-5 w-5 text-muted-foreground" />

          <span>
            Scenario: <strong>{selectedScenario.name}</strong>
          </span>
        </span>
        <IconChevronDown
          className={`h-5 w-5 transition-transform ${showScenarios ? 'rotate-180' : ''}`}
        />
      </button>

      {showScenarios && (
        <div className="absolute z-10 mt-1 w-full rounded-none border border-border bg-card">
          {scenarios.map((scenario) => (
            <button
              key={scenario.name}
              className="block w-full px-4 py-2 text-left hover:bg-accent"
              onClick={() => onSelect(scenario)}
            >
              <div className="font-medium">{scenario.name}</div>
              <div className="text-sm text-muted-foreground">
                {scenario.description}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

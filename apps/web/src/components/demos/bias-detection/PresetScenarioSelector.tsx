// Interactive preset scenario selector with filtering and preview

import { useState, useMemo, type FC } from 'react'

import type { PresetScenario } from '../../../lib/types/bias-detection'

interface PresetScenarioSelectorProps {
  scenarios: PresetScenario[]
  selectedScenario: PresetScenario | null
  onScenarioSelect: (scenario: PresetScenario) => void
  disabled?: boolean
}

export const PresetScenarioSelector: FC<PresetScenarioSelectorProps> = ({
  scenarios,
  selectedScenario,
  onScenarioSelect,
  disabled = false,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterRiskLevel, setFilterRiskLevel] = useState<string>('all')
  const [previewScenario, setPreviewScenario] = useState<PresetScenario | null>(
    null,
  )

  // Get unique categories and risk levels
  const categories = useMemo(() => {
    const cats = [...new Set(scenarios.map((s: PresetScenario) => s.category))]
    return cats.sort()
  }, [scenarios])

  const riskLevels = useMemo(() => {
    const levels = [
      ...new Set(scenarios.map((s: PresetScenario) => s.riskLevel)),
    ]
    return levels.sort((a, b) => {
      const order = { low: 1, medium: 2, high: 3, critical: 4 }
      return order[a] - order[b]
    })
  }, [scenarios])

  // Filter scenarios
  const filteredScenarios = useMemo(() => {
    return scenarios.filter((scenario) => {
      const categoryMatch =
        filterCategory === 'all' || scenario.category === filterCategory
      const riskMatch =
        filterRiskLevel === 'all' || scenario.riskLevel === filterRiskLevel
      return categoryMatch && riskMatch
    })
  }, [scenarios, filterCategory, filterRiskLevel])

  // Helper function to get risk level styling
  const getRiskLevelStyle = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-card border border-ring text-foreground font-semibold'
      case 'high':
        return 'bg-secondary border border-ring text-foreground font-medium'
      case 'medium':
        return 'bg-secondary border border-ring text-foreground font-medium'
      case 'low':
        return 'bg-secondary border border-input text-foreground'
      default:
        return 'bg-secondary text-foreground border-border'
    }
  }

  // Helper function to get category color
  const getCategoryColor = (category: string) => {
    const colors = {
      cultural: 'bg-secondary border border-input text-foreground',
      gender: 'bg-secondary border border-input text-foreground',
      age: 'bg-secondary border border-input text-foreground',
      linguistic: 'bg-secondary border border-input text-foreground',
      intersectional: 'bg-secondary text-foreground',
      inclusive: 'bg-secondary border border-input text-foreground',
    }
    return (
      colors[category as keyof typeof colors] || 'bg-secondary text-foreground'
    )
  }

  return (
    <div className="preset-scenario-selector">
      {/* Filters */}
      <div className="mb-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Category Filter */}
          <div>
            <label
              htmlFor="category-filter"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Category
            </label>
            <select
              id="category-filter"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              disabled={disabled}
              className="w-full rounded-none border border-input px-3 py-2 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-35"
            >
              <option value="all">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Risk Level Filter */}
          <div>
            <label
              htmlFor="risk-level-filter"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Risk Level
            </label>
            <select
              id="risk-level-filter"
              value={filterRiskLevel}
              onChange={(e) => setFilterRiskLevel(e.target.value)}
              disabled={disabled}
              className="w-full rounded-none border border-input px-3 py-2 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-35"
            >
              <option value="all">All Risk Levels</option>
              {riskLevels.map((level) => (
                <option key={level} value={level}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="text-sm text-muted-foreground">
          Showing {filteredScenarios.length} of {scenarios.length} scenarios
        </div>
      </div>

      {/* Scenario List */}
      <div className="max-h-96 space-y-3 overflow-y-auto">
        {filteredScenarios.map((scenario) => (
          <button
            key={scenario.id}
            className={`hover: w-full cursor-pointer rounded-none border p-4 text-left transition-all ${
              selectedScenario?.id === scenario.id
                ? 'border-ring bg-secondary'
                : 'border-border hover:border-ring'
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            onClick={() => !disabled && onScenarioSelect(scenario)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                e.preventDefault()
                onScenarioSelect(scenario)
              }
            }}
            tabIndex={disabled ? -1 : 0}
            aria-label={`Select scenario: ${scenario['title']}`}
            aria-disabled={disabled}
            onMouseEnter={() => setPreviewScenario(scenario)}
            onMouseLeave={() => setPreviewScenario(null)}
          >
            {/* Header */}
            <div className="mb-2 flex items-start justify-between">
              <h4 className="font-semibold text-foreground">{scenario.name}</h4>
              <div className="flex space-x-2">
                <span
                  className={`rounded-none px-2 py-1 text-xs font-medium ${getCategoryColor(scenario.category)}`}
                >
                  {scenario.category}
                </span>
                <span
                  className={`rounded-none border px-2 py-1 text-xs font-medium ${getRiskLevelStyle(scenario.riskLevel)}`}
                >
                  {scenario.riskLevel}
                </span>
              </div>
            </div>

            {/* Description */}
            <p className="mb-3 text-sm text-muted-foreground">
              {scenario.description}
            </p>

            {/* Demographics */}
            <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="text-xs">
                <span className="text-muted-foreground">Age:</span>
                <span className="ml-1 font-medium">
                  {scenario.demographics.age}
                </span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Gender:</span>
                <span className="ml-1 font-medium">
                  {scenario.demographics.gender}
                </span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Ethnicity:</span>
                <span className="ml-1 font-medium">
                  {scenario.demographics.ethnicity}
                </span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Language:</span>
                <span className="ml-1 font-medium">
                  {scenario.demographics.primaryLanguage}
                </span>
              </div>
            </div>

            {/* Content Preview */}
            <div className="mb-3 rounded bg-secondary p-3">
              <div className="mb-1 text-xs text-muted-foreground">
                Sample Content:
              </div>
              <div className="text-sm italic text-foreground">
                &quot;
                {scenario.content.length > 100
                  ? scenario.content.substring(0, 100) + '...'
                  : scenario.content}
                &quot;
              </div>
            </div>

            {/* Learning Objectives */}
            <div className="border-t pt-3">
              <div className="mb-2 text-xs text-muted-foreground">
                Learning Objectives:
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {scenario.learningObjectives.slice(0, 2).map((objective) => (
                  <li key={objective} className="flex items-start">
                    <span className="mr-1 text-foreground">•</span>
                    {objective}
                  </li>
                ))}
                {scenario.learningObjectives.length > 2 && (
                  <li className="italic text-muted-foreground">
                    +{scenario.learningObjectives.length - 2} more objectives
                  </li>
                )}
              </ul>
            </div>

            {/* Selection Indicator */}
            {selectedScenario?.id === scenario.id && (
              <div className="mt-3 flex items-center text-foreground">
                <svg
                  className="mr-1 h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm font-medium">Selected</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* No Results */}
      {filteredScenarios.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          <svg
            className="mx-auto mb-4 h-12 w-12 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p>No scenarios match the selected filters</p>
          <button
            onClick={() => {
              setFilterCategory('all')
              setFilterRiskLevel('all')
            }}
            className="mt-2 text-sm font-medium text-foreground hover:text-foreground"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Preview Modal */}
      {previewScenario && (
        <div className="bg-black fixed inset-0 z-50 flex items-center justify-center bg-opacity-50 p-4">
          <div className="max-h-96 w-full max-w-2xl overflow-y-auto rounded-none bg-card p-6">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {previewScenario.name}
              </h3>
              <button
                onClick={() => setPreviewScenario(null)}
                className="text-muted-foreground hover:text-muted-foreground"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="mb-2 font-medium text-foreground">
                  Full Content:
                </h4>
                <div className="rounded bg-secondary p-3 text-sm italic text-foreground">
                  &quot;{previewScenario.content}&quot;
                </div>
              </div>

              <div>
                <h4 className="mb-2 font-medium text-foreground">
                  All Learning Objectives:
                </h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {previewScenario.learningObjectives.map((objective) => (
                    <li key={objective} className="flex items-start">
                      <span className="mr-2 text-foreground">•</span>
                      {objective}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PresetScenarioSelector

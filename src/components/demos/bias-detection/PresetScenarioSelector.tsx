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
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Helper function to get category color
  const getCategoryColor = (category: string) => {
    const colors = {
      cultural: 'bg-purple-100 text-purple-800',
      gender: 'bg-pink-100 text-pink-800',
      age: 'bg-blue-100 text-blue-800',
      linguistic: 'bg-indigo-100 text-indigo-800',
      intersectional: 'bg-gray-100 text-gray-800',
      inclusive: 'bg-green-100 text-green-800',
    }
    return (
      colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800'
    )
  }

  return (
    <div className='preset-scenario-selector'>
      {/* Filters */}
      <div className='mb-4 space-y-3'>
        <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
          {/* Category Filter */}
          <div>
            <label
              htmlFor='category-filter'
              className='text-gray-700 mb-1 block text-sm font-medium'
            >
              Category
            </label>
            <select
              id='category-filter'
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              disabled={disabled}
              className='border-gray-300 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed'
            >
              <option value='all'>All Categories</option>
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
              htmlFor='risk-level-filter'
              className='text-gray-700 mb-1 block text-sm font-medium'
            >
              Risk Level
            </label>
            <select
              id='risk-level-filter'
              value={filterRiskLevel}
              onChange={(e) => setFilterRiskLevel(e.target.value)}
              disabled={disabled}
              className='border-gray-300 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed'
            >
              <option value='all'>All Risk Levels</option>
              {riskLevels.map((level) => (
                <option key={level} value={level}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className='text-gray-600 text-sm'>
          Showing {filteredScenarios.length} of {scenarios.length} scenarios
        </div>
      </div>

      {/* Scenario List */}
      <div className='max-h-96 space-y-3 overflow-y-auto'>
        {filteredScenarios.map((scenario) => (
          <button
            key={scenario.id}
            className={`w-full cursor-pointer rounded-lg border p-4 text-left transition-all hover:shadow-md ${
              selectedScenario?.id === scenario.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
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
            <div className='mb-2 flex items-start justify-between'>
              <h4 className='text-gray-900 font-semibold'>{scenario.name}</h4>
              <div className='flex space-x-2'>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${getCategoryColor(scenario.category)}`}
                >
                  {scenario.category}
                </span>
                <span
                  className={`rounded-full border px-2 py-1 text-xs font-medium ${getRiskLevelStyle(scenario.riskLevel)}`}
                >
                  {scenario.riskLevel}
                </span>
              </div>
            </div>

            {/* Description */}
            <p className='text-gray-600 mb-3 text-sm'>{scenario.description}</p>

            {/* Demographics */}
            <div className='mb-3 grid grid-cols-2 gap-2 md:grid-cols-4'>
              <div className='text-xs'>
                <span className='text-gray-500'>Age:</span>
                <span className='ml-1 font-medium'>
                  {scenario.demographics.age}
                </span>
              </div>
              <div className='text-xs'>
                <span className='text-gray-500'>Gender:</span>
                <span className='ml-1 font-medium'>
                  {scenario.demographics.gender}
                </span>
              </div>
              <div className='text-xs'>
                <span className='text-gray-500'>Ethnicity:</span>
                <span className='ml-1 font-medium'>
                  {scenario.demographics.ethnicity}
                </span>
              </div>
              <div className='text-xs'>
                <span className='text-gray-500'>Language:</span>
                <span className='ml-1 font-medium'>
                  {scenario.demographics.primaryLanguage}
                </span>
              </div>
            </div>

            {/* Content Preview */}
            <div className='bg-gray-50 mb-3 rounded p-3'>
              <div className='text-gray-500 mb-1 text-xs'>Sample Content:</div>
              <div className='text-gray-700 text-sm italic'>
                &quot;
                {scenario.content.length > 100
                  ? scenario.content.substring(0, 100) + '...'
                  : scenario.content}
                &quot;
              </div>
            </div>

            {/* Learning Objectives */}
            <div className='border-t pt-3'>
              <div className='text-gray-500 mb-2 text-xs'>
                Learning Objectives:
              </div>
              <ul className='text-gray-600 space-y-1 text-xs'>
                {scenario.learningObjectives.slice(0, 2).map((objective) => (
                  <li key={objective} className='flex items-start'>
                    <span className='text-blue-500 mr-1'>•</span>
                    {objective}
                  </li>
                ))}
                {scenario.learningObjectives.length > 2 && (
                  <li className='text-gray-500 italic'>
                    +{scenario.learningObjectives.length - 2} more objectives
                  </li>
                )}
              </ul>
            </div>

            {/* Selection Indicator */}
            {selectedScenario?.id === scenario.id && (
              <div className='text-blue-600 mt-3 flex items-center'>
                <svg
                  className='mr-1 h-4 w-4'
                  fill='currentColor'
                  viewBox='0 0 20 20'
                >
                  <path
                    fillRule='evenodd'
                    d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                    clipRule='evenodd'
                  />
                </svg>
                <span className='text-sm font-medium'>Selected</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* No Results */}
      {filteredScenarios.length === 0 && (
        <div className='text-gray-500 py-8 text-center'>
          <svg
            className='text-gray-400 mx-auto mb-4 h-12 w-12'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
            />
          </svg>
          <p>No scenarios match the selected filters</p>
          <button
            onClick={() => {
              setFilterCategory('all')
              setFilterRiskLevel('all')
            }}
            className='text-blue-600 hover:text-blue-800 mt-2 text-sm font-medium'
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Preview Modal */}
      {previewScenario && (
        <div className='bg-black fixed inset-0 z-50 flex items-center justify-center bg-opacity-50 p-4'>
          <div className='bg-white max-h-96 w-full max-w-2xl overflow-y-auto rounded-lg p-6'>
            <div className='mb-4 flex items-start justify-between'>
              <h3 className='text-gray-900 text-lg font-semibold'>
                {previewScenario.name}
              </h3>
              <button
                onClick={() => setPreviewScenario(null)}
                className='text-gray-400 hover:text-gray-600'
              >
                <svg
                  className='h-6 w-6'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>
            </div>

            <div className='space-y-4'>
              <div>
                <h4 className='text-gray-900 mb-2 font-medium'>
                  Full Content:
                </h4>
                <div className='bg-gray-50 text-gray-700 rounded p-3 text-sm italic'>
                  &quot;{previewScenario.content}&quot;
                </div>
              </div>

              <div>
                <h4 className='text-gray-900 mb-2 font-medium'>
                  All Learning Objectives:
                </h4>
                <ul className='text-gray-600 space-y-1 text-sm'>
                  {previewScenario.learningObjectives.map((objective) => (
                    <li key={objective} className='flex items-start'>
                      <span className='text-blue-500 mr-2'>•</span>
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

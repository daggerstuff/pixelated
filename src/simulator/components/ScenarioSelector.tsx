import { useState, useMemo } from 'react'

import { getAllScenarios } from '../data/scenarios'
import type { Scenario, ScenarioSelectorProps } from '../types'
import { ScenarioDifficulty } from '../types'

/**
 * Component for selecting scenarios to practice
 * Provides filtering options by domain and difficulty
 */
export function ScenarioSelector({ onSelectScenario }: ScenarioSelectorProps) {
  const [selectedDomain, setSelectedDomain] = useState<string>('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Get all available scenarios
  const allScenarios = useMemo(() => getAllScenarios(), [])

  // Filter scenarios based on selected filters
  const filteredScenarios = useMemo(() => {
    return allScenarios.filter((scenario) => {
      // Filter by domain if selected
      const domainMatch =
        selectedDomain === 'all' || scenario.domain === selectedDomain

      // Filter by difficulty if selected
      const difficultyMatch =
        selectedDifficulty === 'all' ||
        scenario.difficulty === selectedDifficulty

      // Filter by search query
      const searchMatch =
        searchQuery === '' ||
        scenario.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        scenario.description.toLowerCase().includes(searchQuery.toLowerCase())

      return domainMatch && difficultyMatch && searchMatch
    })
  }, [allScenarios, selectedDomain, selectedDifficulty, searchQuery])

  // Get unique domains for filter dropdown
  const domains = useMemo(() => {
    const uniqueDomains = new Set(
      allScenarios.map((scenario) => scenario.domain),
    )
    return Array.from(uniqueDomains)
  }, [allScenarios])

  // Get unique difficulties for filter dropdown
  const difficulties = useMemo(() => {
    const uniqueDifficulties = new Set(
      allScenarios.map((scenario) => scenario.difficulty),
    )
    return Array.from(uniqueDifficulties)
  }, [allScenarios])

  return (
    <div className='mx-auto w-full max-w-4xl'>
      <div className='mb-8'>
        <h2 className='text-gray-800 mb-2 text-2xl font-semibold'>
          Select a Practice Scenario
        </h2>
        <p className='text-gray-600'>
          Choose a scenario to practice your therapeutic skills. All
          interactions are processed in real-time with zero data retention.
        </p>
      </div>

      {/* Filters */}
      <div className='mb-6 grid grid-cols-1 gap-4 md:grid-cols-3'>
        <div>
          <label
            htmlFor='domain-filter'
            className='text-gray-700 mb-1 block text-sm font-medium'
          >
            Therapeutic Domain
          </label>
          <select
            id='domain-filter'
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className='border-gray-300 text-gray-700 focus:ring-blue-500 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2'
          >
            <option value='all'>All Domains</option>
            {domains.map((domain) => (
              <option key={domain} value={domain}>
                {domain.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor='difficulty-filter'
            className='text-gray-700 mb-1 block text-sm font-medium'
          >
            Difficulty Level
          </label>
          <select
            id='difficulty-filter'
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className='border-gray-300 text-gray-700 focus:ring-blue-500 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2'
          >
            <option value='all'>All Difficulties</option>
            {difficulties.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {difficulty}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor='search-filter'
            className='text-gray-700 mb-1 block text-sm font-medium'
          >
            Search Scenarios
          </label>
          <input
            id='search-filter'
            type='text'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Search by keyword...'
            className='border-gray-300 text-gray-700 focus:ring-blue-500 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2'
          />
        </div>
      </div>

      {/* Scenarios grid */}
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        {filteredScenarios.length > 0 ? (
          filteredScenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              onSelect={() => onSelectScenario(scenario.id)}
            />
          ))
        ) : (
          <div className='bg-gray-50 col-span-2 rounded-lg p-6 text-center'>
            <p className='text-gray-500'>
              No scenarios found matching your filters.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// Helper component for displaying a scenario card
function ScenarioCard({
  scenario,
  onSelect,
}: {
  scenario: Scenario
  onSelect: () => void
}) {
  // Function to get appropriate color based on difficulty
  const getDifficultyColor = (difficulty: ScenarioDifficulty) => {
    switch (difficulty) {
      case ScenarioDifficulty.BEGINNER:
        return 'text-green-700 bg-green-100'
      case ScenarioDifficulty.INTERMEDIATE:
        return 'text-yellow-700 bg-yellow-100'
      case ScenarioDifficulty.ADVANCED:
        return 'text-orange-700 bg-orange-100'
      case ScenarioDifficulty.EXPERT:
        return 'text-red-700 bg-red-100'
      default:
        return 'text-gray-700 bg-gray-100'
    }
  }

  return (
    <div className='overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md'>
      <div className='p-4'>
        <div className='mb-2 flex items-start justify-between'>
          <h3 className='text-gray-800 text-lg font-semibold'>
            {scenario.title}
          </h3>
          <span
            className={`rounded-md px-2 py-1 text-xs font-medium ${getDifficultyColor(scenario.difficulty)}`}
          >
            {scenario.difficulty}
          </span>
        </div>

        <p className='text-gray-600 mb-3 text-sm'>{scenario.description}</p>

        <div className='mb-3'>
          <span className='bg-blue-100 text-blue-700 inline-block rounded-full px-3 py-1 text-xs font-medium'>
            {scenario.domain.replace(/_/g, ' ')}
          </span>
        </div>

        <div className='mt-4'>
          <button
            onClick={onSelect}
            className='bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 w-full rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2'
          >
            Practice This Scenario
          </button>
        </div>
      </div>
    </div>
  )
}

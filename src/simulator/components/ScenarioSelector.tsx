import React, { useState, useMemo } from 'react'
import type { Scenario, ScenarioSelectorProps } from '../types'
import { ScenarioDifficulty } from '../types'
import { getAllScenarios } from '../data/scenarios'

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
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          Select a Practice Scenario
        </h2>
        <p className="text-gray-600">
          Choose a scenario to practice your therapeutic skills. All
          interactions are processed in real-time with zero data retention.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label
            htmlFor="domain-filter"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Therapeutic Domain
          </label>
          <select
            id="domain-filter"
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Domains</option>
            {domains.map((domain) => (
              <option key={domain} value={domain}>
                {domain.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="difficulty-filter"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Difficulty Level
          </label>
          <select
            id="difficulty-filter"
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Difficulties</option>
            {difficulties.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {difficulty}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="search-filter"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Search Scenarios
          </label>
          <input
            id="search-filter"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by keyword..."
            className="w-full rounded-md border border-gray-300 py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Scenarios grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredScenarios.length > 0 ? (
          filteredScenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              onSelect={() => onSelectScenario(scenario.id)}
            />
          ))
        ) : (
          <div className="col-span-2 p-6 text-center bg-gray-50 rounded-lg">
            <p className="text-gray-500">
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
    <div className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-gray-800">
            {scenario.title}
          </h3>
          <span
            className={`px-2 py-1 rounded-md text-xs font-medium ${getDifficultyColor(scenario.difficulty)}`}
          >
            {scenario.difficulty}
          </span>
        </div>

        <p className="text-gray-600 text-sm mb-3">{scenario.description}</p>

        <div className="mb-3">
          <span className="inline-block bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-xs font-medium">
            {scenario.domain.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="mt-4">
          <button
            onClick={onSelect}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Practice This Scenario
          </button>
        </div>
      </div>
    </div>
  )
}

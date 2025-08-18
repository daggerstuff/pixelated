// Counterfactual analysis visualization component

import React, { useState } from 'react'
import type {
  CounterfactualScenario,
  SessionData,
} from '../../../lib/types/bias-detection'

interface CounterfactualAnalysisProps {
  scenarios: CounterfactualScenario[]
  originalSession: SessionData | null
}

export const CounterfactualAnalysis: FC<CounterfactualAnalysisProps> = ({
  scenarios,
  originalSession,
}) => {
  const [selectedScenario, setSelectedScenario] =
    useState<CounterfactualScenario | null>(null)
  const [sortBy, setSortBy] = useState<'likelihood' | 'impact' | 'change'>(
    'likelihood',
  )

  // Sort scenarios based on selected criteria
  const sortedScenarios = [...scenarios].sort((a, b) => {
    switch (sortBy) {
      case 'likelihood': {
        const likelihoodOrder = { high: 3, medium: 2, low: 1 }
        return (
          likelihoodOrder[b.likelihood as keyof typeof likelihoodOrder] -
          likelihoodOrder[a.likelihood as keyof typeof likelihoodOrder]
        )
      }
      case 'impact':
        return Math.abs(b.biasScoreChange) - Math.abs(a.biasScoreChange)
      case 'change':
        return a.change.localeCompare(b.change)
      default:
        return 0
    }
  })

  // Helper function to get likelihood styling
  const getLikelihoodStyle = (likelihood: string) => {
    switch (likelihood) {
      case 'high': {
        return 'bg-green-100 text-green-800 border-green-200'
      }
      case 'medium': {
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      }
      case 'low': {
        return 'bg-red-100 text-red-800 border-red-200'
      }
      default: {
        return 'bg-gray-100 text-gray-800 border-gray-200'
      }
    }
  }

  // Helper function to get impact color
  const getImpactColor = (biasScoreChange: number) => {
    const absoluteChange = Math.abs(biasScoreChange)
    if (absoluteChange > 0.3) {
      return 'text-green-600'
    }
    if (absoluteChange > 0.1) {
      return 'text-yellow-600'
    }
    return 'text-red-600'
  }

  // Helper function to format percentage
  const formatPercentage = (value: number) =>
    `${(Math.abs(value) * 100).toFixed(1)}%`

  // Helper function to handle keyboard events for clickable buttons
  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    scenario: CounterfactualScenario,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setSelectedScenario(selectedScenario === scenario ? null : scenario)
    }
  }

  return (
    <div className="counterfactual-analysis space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Counterfactual Analysis
          </h3>
          <p className="text-gray-600">
            Explore how different scenarios might affect bias detection results
          </p>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center space-x-2">
          <label
            htmlFor="sort-select"
            className="text-sm font-medium text-gray-700"
          >
            Sort by:
          </label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setSortBy(e.target.value as 'likelihood' | 'impact' | 'change')
            }
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="likelihood">Likelihood</option>
            <option value="impact">Impact</option>
            <option value="change">Change Type</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">
            {scenarios.length}
          </div>
          <div className="text-sm text-blue-800">Total Scenarios</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">
            {scenarios.filter((s) => s.likelihood === 'high').length}
          </div>
          <div className="text-sm text-green-800">High Likelihood</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600">
            {scenarios.length > 0
              ? formatPercentage(
                  Math.max(
                    ...scenarios.map((s) => Math.abs(s.biasScoreChange)),
                  ),
                )
              : '0%'}
          </div>
          <div className="text-sm text-purple-800">Max Change</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-orange-600">
            {scenarios.length > 0
              ? formatPercentage(
                  scenarios.reduce(
                    (sum, s) => sum + Math.abs(s.biasScoreChange),
                    0,
                  ) / scenarios.length,
                )
              : '0%'}
          </div>
          <div className="text-sm text-orange-800">Avg Change</div>
        </div>
      </div>

      {/* Original Session Context */}
      {originalSession && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">
            Original Session Context
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Age:</span>
              <span className="ml-1 font-medium">
                {originalSession.demographics.age}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Gender:</span>
              <span className="ml-1 font-medium">
                {originalSession.demographics.gender}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Ethnicity:</span>
              <span className="ml-1 font-medium">
                {originalSession.demographics.ethnicity}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Language:</span>
              <span className="ml-1 font-medium">
                {originalSession.demographics.primaryLanguage}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Scenarios List */}
      <div className="space-y-4">
        {sortedScenarios.map((scenario) => (
          <button
            key={scenario.id}
            className={`w-full text-left border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
              selectedScenario === scenario
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() =>
              setSelectedScenario(
                selectedScenario === scenario ? null : scenario,
              )
            }
            onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) =>
              handleKeyDown(e, scenario)
            }
            aria-expanded={selectedScenario === scenario}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">
                  {scenario.change}
                </h4>
                <p className="text-sm text-gray-600">{scenario.impact}</p>
              </div>

              <div className="flex items-center space-x-3 ml-4">
                {/* Likelihood Badge */}
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium border ${getLikelihoodStyle(scenario.likelihood)}`}
                >
                  {scenario.likelihood} likelihood
                </span>

                {/* Impact Score */}
                <div className="text-right">
                  <div
                    className={`text-lg font-bold ${getImpactColor(scenario.biasScoreChange)}`}
                  >
                    {scenario.biasScoreChange > 0 ? '+' : ''}
                    {formatPercentage(scenario.biasScoreChange)}
                  </div>
                  <div className="text-xs text-gray-500">bias change</div>
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {selectedScenario === scenario && (
              <div className="border-t pt-4 mt-4 space-y-4">
                {/* Detailed Analysis */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* What Changes */}
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">
                      What Changes
                    </h5>
                    <div className="bg-white rounded border p-3">
                      <div className="text-sm text-gray-700">
                        {scenario.impact}
                      </div>
                      {scenario.change.includes('Demographics') && (
                        <div className="mt-2 text-xs text-blue-600">
                          This scenario explores how different demographic
                          characteristics might affect bias detection.
                        </div>
                      )}
                      {scenario.change.includes('Language') && (
                        <div className="mt-2 text-xs text-purple-600">
                          This scenario examines the impact of therapeutic
                          language choices on bias patterns.
                        </div>
                      )}
                      {scenario.change.includes('Cultural') && (
                        <div className="mt-2 text-xs text-green-600">
                          This scenario investigates cultural sensitivity in
                          therapeutic approaches.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expected Impact */}
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">
                      Expected Impact
                    </h5>
                    <div className="bg-white rounded border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">
                          Bias Score Change
                        </span>
                        <span
                          className={`font-semibold ${getImpactColor(scenario.biasScoreChange)}`}
                        >
                          {scenario.biasScoreChange > 0 ? '+' : ''}
                          {formatPercentage(scenario.biasScoreChange)}
                        </span>
                      </div>

                      {/* Impact Visualization */}
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div
                          className={`h-2 rounded-full ${
                            Math.abs(scenario.biasScoreChange) > 0.3
                              ? 'bg-green-500'
                              : Math.abs(scenario.biasScoreChange) > 0.1
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                          }`}
                          style={{
                            width: `${Math.min(Math.abs(scenario.biasScoreChange) * 100, 100)}%`,
                          }}
                        />
                      </div>

                      <div className="text-xs text-gray-500">
                        {Math.abs(scenario.biasScoreChange) > 0.3
                          ? 'High impact expected'
                          : Math.abs(scenario.biasScoreChange) > 0.1
                            ? 'Moderate impact expected'
                            : 'Low impact expected'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Implementation Likelihood */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">
                    Implementation Feasibility
                  </h5>
                  <div className="bg-white rounded border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        Likelihood of Success
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getLikelihoodStyle(scenario.likelihood)}`}
                      >
                        {scenario.likelihood.toUpperCase()}
                      </span>
                    </div>

                    <div className="mt-2 text-sm text-gray-700">
                      {scenario.likelihood === 'high' &&
                        'This change is highly feasible and likely to produce the expected results.'}
                      {scenario.likelihood === 'medium' &&
                        'This change is moderately feasible but may require additional considerations.'}
                      {scenario.likelihood === 'low' &&
                        'This change may be challenging to implement or may not produce consistent results.'}
                    </div>

                    <div className="mt-2 text-sm text-gray-600">
                      <strong>Confidence:</strong>{' '}
                      {(scenario.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Action Items */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">
                    Recommended Actions
                  </h5>
                  <div className="bg-blue-50 rounded border border-blue-200 p-3">
                    <ul className="text-sm text-blue-800 space-y-1">
                      {scenario.change.includes('Demographics') && (
                        <>
                          <li>
                            • Review demographic assumptions in assessment tools
                          </li>
                          <li>
                            • Implement culturally responsive therapeutic
                            approaches
                          </li>
                        </>
                      )}
                      {scenario.change.includes('Language') && (
                        <>
                          <li>• Use more inclusive and neutral language</li>
                          <li>• Avoid generalizations about cultural groups</li>
                        </>
                      )}
                      {scenario.change.includes('Cultural') && (
                        <>
                          <li>• Increase cultural competency training</li>
                          <li>• Develop culturally adapted interventions</li>
                        </>
                      )}
                      <li>• Monitor bias patterns in similar scenarios</li>
                      <li>
                        • Collect feedback from diverse client populations
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Expand/Collapse Indicator */}
            <div className="flex justify-center mt-3">
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  selectedScenario === scenario ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* No Scenarios */}
      {scenarios.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2V7a2 2 0 012-2h2a2 2 0 002 2v2a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 00-2 2h-2a2 2 0 00-2 2v6a2 2 0 01-2 2H9z"
            />
          </svg>
          <p>No counterfactual scenarios available</p>
          <p className="text-sm mt-1">
            Run a bias analysis first to generate scenarios
          </p>
        </div>
      )}
    </div>
  )
}

export default CounterfactualAnalysis

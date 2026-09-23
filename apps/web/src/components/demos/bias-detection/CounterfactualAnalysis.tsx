// Counterfactual analysis visualization component

import { useState, type FC } from 'react'

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
        return likelihoodOrder[b.likelihood] - likelihoodOrder[a.likelihood]
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
        return 'bg-secondary border border-input text-foreground'
      }
      case 'medium': {
        return 'bg-secondary border border-ring text-foreground font-medium'
      }
      case 'low': {
        return 'bg-card border border-ring text-foreground font-semibold'
      }
      default: {
        return 'bg-secondary text-foreground border-border'
      }
    }
  }

  // Helper function to get impact color
  const getImpactColor = (biasScoreChange: number) => {
    const absoluteChange = Math.abs(biasScoreChange)
    if (absoluteChange > 0.3) {
      return 'text-foreground'
    }
    if (absoluteChange > 0.1) {
      return 'text-foreground font-medium'
    }
    return 'text-foreground font-semibold'
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
      <div className="flex items-start justify-between">
        <div>
          <h3 className="mb-2 text-lg font-semibold text-foreground">
            Counterfactual Analysis
          </h3>
          <p className="text-muted-foreground">
            Explore how different scenarios might affect bias detection results
          </p>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center space-x-2">
          <label
            htmlFor="sort-select"
            className="text-sm font-medium text-foreground"
          >
            Sort by:
          </label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setSortBy(e.target.value as 'likelihood' | 'impact' | 'change')
            }
            className="rounded-none border border-input px-3 py-1 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="likelihood">Likelihood</option>
            <option value="impact">Impact</option>
            <option value="change">Change Type</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-none bg-secondary p-4">
          <div className="text-2xl font-bold text-foreground">
            {scenarios.length}
          </div>
          <div className="text-sm text-foreground">Total Scenarios</div>
        </div>
        <div className="rounded-none bg-secondary p-4">
          <div className="text-2xl font-bold text-foreground">
            {scenarios.filter((s) => s.likelihood === 'high').length}
          </div>
          <div className="text-sm text-foreground">High Likelihood</div>
        </div>
        <div className="rounded-none bg-secondary p-4">
          <div className="text-2xl font-bold text-muted-foreground">
            {scenarios.length > 0
              ? formatPercentage(
                  Math.max(
                    ...scenarios.map((s) => Math.abs(s.biasScoreChange)),
                  ),
                )
              : '0%'}
          </div>
          <div className="text-sm text-foreground">Max Change</div>
        </div>
        <div className="rounded-none bg-secondary p-4">
          <div className="text-2xl font-bold font-medium text-foreground">
            {scenarios.length > 0
              ? formatPercentage(
                  scenarios.reduce(
                    (sum, s) => sum + Math.abs(s.biasScoreChange),
                    0,
                  ) / scenarios.length,
                )
              : '0%'}
          </div>
          <div className="text-sm text-foreground">Avg Change</div>
        </div>
      </div>

      {/* Original Session Context */}
      {originalSession && (
        <div className="rounded-none border border-border bg-secondary p-4">
          <h4 className="mb-2 font-medium text-foreground">
            Original Session Context
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <span className="text-muted-foreground">Age:</span>
              <span className="ml-1 font-medium">
                {originalSession.demographics.age}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Gender:</span>
              <span className="ml-1 font-medium">
                {originalSession.demographics.gender}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Ethnicity:</span>
              <span className="ml-1 font-medium">
                {originalSession.demographics.ethnicity}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Language:</span>
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
            className={`hover: w-full cursor-pointer rounded-none border p-4 text-left transition-all ${
              selectedScenario === scenario
                ? 'border-ring bg-secondary'
                : 'border-border hover:border-ring'
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
            <div className="mb-3 flex items-start justify-between">
              <div className="flex-1">
                <h4 className="mb-1 font-semibold text-foreground">
                  {scenario.change}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {scenario.impact}
                </p>
              </div>

              <div className="ml-4 flex items-center space-x-3">
                {/* Likelihood Badge */}
                <span
                  className={`rounded-none border px-2 py-1 text-xs font-medium ${getLikelihoodStyle(scenario.likelihood)}`}
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
                  <div className="text-xs text-muted-foreground">
                    bias change
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {selectedScenario === scenario && (
              <div className="mt-4 space-y-4 border-t pt-4">
                {/* Detailed Analysis */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* What Changes */}
                  <div>
                    <h5 className="mb-2 font-medium text-foreground">
                      What Changes
                    </h5>
                    <div className="rounded border bg-card p-3">
                      <div className="text-sm text-foreground">
                        {scenario.impact}
                      </div>
                      {scenario.change.includes('Demographics') && (
                        <div className="mt-2 text-xs text-foreground">
                          This scenario explores how different demographic
                          characteristics might affect bias detection.
                        </div>
                      )}
                      {scenario.change.includes('Language') && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          This scenario examines the impact of therapeutic
                          language choices on bias patterns.
                        </div>
                      )}
                      {scenario.change.includes('Cultural') && (
                        <div className="mt-2 text-xs text-foreground">
                          This scenario investigates cultural sensitivity in
                          therapeutic approaches.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expected Impact */}
                  <div>
                    <h5 className="mb-2 font-medium text-foreground">
                      Expected Impact
                    </h5>
                    <div className="rounded border bg-card p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
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
                      <div className="mb-2 h-2 w-full rounded-none bg-secondary">
                        <div
                          className={`h-2 rounded-none ${
                            Math.abs(scenario.biasScoreChange) > 0.3
                              ? 'bg-primary'
                              : Math.abs(scenario.biasScoreChange) > 0.1
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                          }`}
                          style={{
                            width: `${Math.min(Math.abs(scenario.biasScoreChange) * 100, 100)}%`,
                          }}
                        />
                      </div>

                      <div className="text-xs text-muted-foreground">
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
                  <h5 className="mb-2 font-medium text-foreground">
                    Implementation Feasibility
                  </h5>
                  <div className="rounded border bg-card p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Likelihood of Success
                      </span>
                      <span
                        className={`rounded px-2 py-1 text-xs font-medium ${getLikelihoodStyle(scenario.likelihood)}`}
                      >
                        {scenario.likelihood.toUpperCase()}
                      </span>
                    </div>

                    <div className="mt-2 text-sm text-foreground">
                      {scenario.likelihood === 'high' &&
                        'This change is highly feasible and likely to produce the expected results.'}
                      {scenario.likelihood === 'medium' &&
                        'This change is moderately feasible but may require additional considerations.'}
                      {scenario.likelihood === 'low' &&
                        'This change may be challenging to implement or may not produce consistent results.'}
                    </div>

                    <div className="mt-2 text-sm text-muted-foreground">
                      <strong>Confidence:</strong>{' '}
                      {(scenario.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Action Items */}
                <div>
                  <h5 className="mb-2 font-medium text-foreground">
                    Recommended Actions
                  </h5>
                  <div className="rounded-none border border-input bg-secondary p-3">
                    <ul className="space-y-1 text-sm text-foreground">
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
            <div className="mt-3 flex justify-center">
              <svg
                className={`h-5 w-5 text-muted-foreground transition-transform ${
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
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2V7a2 2 0 012-2h2a2 2 0 002 2v2a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 00-2 2h-2a2 2 0 00-2 2v6a2 2 0 01-2 2H9z"
            />
          </svg>
          <p>No counterfactual scenarios available</p>
          <p className="mt-1 text-sm">
            Run a bias analysis first to generate scenarios
          </p>
        </div>
      )}
    </div>
  )
}

export default CounterfactualAnalysis

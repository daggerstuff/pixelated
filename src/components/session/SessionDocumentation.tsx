import { useState, useEffect } from 'react'
import type { SessionDocumentation } from '../../lib/documentation/types'
import { useDocumentation } from '../../lib/documentation/useDocumentation'

// Utility function to format duration
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  } else {
    return `${remainingSeconds}s`
  }
}

interface SessionDocumentationProps {
  sessionId: string
  clientId: string
  sessionDuration?: number
  readOnly?: boolean
  showControls?: boolean
}

export default function SessionDocumentationComponent({
  sessionId,
  clientId,
  sessionDuration,
  readOnly = false,
  showControls = true,
}: SessionDocumentationProps) {
  const [activeTab, setActiveTab] = useState<
    'summary' | 'techniques' | 'progress' | 'patterns' | 'full'
  >('summary')

  // Use our documentation hook
  const {
    documentation,
    isLoading,
    isGenerating,
    error,
    loadDocumentation,
    generateDocumentation,
    saveDocumentation,
  } = useDocumentation(sessionId)

  const [editableDocumentation, setEditableDocumentation] =
    useState<SessionDocumentation | null>(null)

  // Update editable documentation when prop changes
  useEffect(() => {
    if (documentation) {
      setEditableDocumentation(documentation)
    }
  }, [documentation])

  // Handle changes to editable fields (when not in readOnly mode)
  const handleChange = (
    field: string,
    value: any,
  ) => {
    if (readOnly || !editableDocumentation) {
      return
    }

    setEditableDocumentation((prev: SessionDocumentation | null) => {
      if (!prev) {
        return prev
      }

      return {
        ...prev,
        [field]: value,
      }
    })
  }

  // Save changes to documentation
  const handleSaveChanges = async () => {
    if (!editableDocumentation) {
      return
    }

    try {
      await saveDocumentation(editableDocumentation)
    } catch (error) {
      console.error('Error saving documentation:', error)
    }
  }

  // Generate documentation for the session
  const handleGenerateDocumentation = async () => {
    try {
      await generateDocumentation()
    } catch (error) {
      console.error('Error generating documentation:', error)
    }
  }

  // Generate mock documentation for demo/testing purposes
  const loadMockDocumentation = () => {
    const mockDoc: SessionDocumentation = {
      sessionId,
      clientId,
      therapistId: 'demo-therapist',
      startTime: new Date(),
      endTime: undefined,
      summary:
        'Client discussed ongoing anxiety related to work performance and family relationships. Expressed feeling overwhelmed with multiple responsibilities and difficulty sleeping.',
      keyInsights: [
        'Increased anxiety symptoms over last two weeks',
        'Sleep disruption (averaging 5 hours per night)',
        'Work performance concerns are primary stressor',
        'Family conflict with spouse about division of household duties',
      ],
      recommendations: [
        'Practice PMR daily',
        'Maintain anxiety log',
        'Schedule sleep assessment',
      ],
      emotionSummary:
        'Client presented with moderate anxiety, mild frustration, and occasional sadness throughout the session.',
      interventions: [
        'Guided PMR exercise',
        'Cognitive restructuring worksheet',
        'Mindfulness breathing practice',
      ],
      notes:
        'Session focused on identifying stressors and practicing relaxation techniques. Client engaged well and was receptive to interventions.',
      metadata: {},
      version: 1,
      lastModified: new Date(),
      therapeuticTechniques: [
        {
          name: 'Progressive Muscle Relaxation',
          description:
            'Guided client through full-body PMR sequence with focus on identifying tension patterns',
          effectiveness: 8,
        },
        {
          name: 'Cognitive Restructuring',
          description:
            'Identified and challenged catastrophic thinking about work performance review',
          effectiveness: 7,
        },
        {
          name: 'Mindfulness Breathing',
          description:
            'Introduced 4-7-8 breathing technique for anxiety management',
          effectiveness: 6,
        },
      ],
      emotionalPatterns: [
        {
          pattern: 'Anxiety -> Self-criticism -> Avoidance',
          significance:
            'Client demonstrates recurring pattern of anxiety triggering self-critical thoughts, leading to avoidance behaviors',
        },
        {
          pattern: 'Work stress -> Physical tension -> Sleep disruption',
          significance:
            'Physical manifestation of stress affecting sleep quality',
        },
      ],
      recommendedFollowUp:
        'Schedule sleep assessment, continue practicing PMR daily, maintain anxiety log for next session',
      treatmentProgress: {
        goals: [
          {
            description:
              'Reduce anxiety symptoms through regular practice of relaxation techniques',
            progress: 35,
            notes:
              'Client reports moderate benefit from relaxation practice when consistently applied',
          },
          {
            description: 'Improve work-life balance through boundary setting',
            progress: 20,
            notes: 'Beginning to identify specific boundaries needed',
          },
          {
            description: 'Develop more effective communication with spouse',
            progress: 45,
            notes:
              'Successfully initiated conversation about household responsibilities',
          },
        ],
        overallAssessment:
          'Client is making steady progress toward treatment goals, demonstrating good engagement with homework assignments and increasing insight into anxiety patterns.',
      },
      nextSessionPlan:
        'Review anxiety log, continue cognitive restructuring work focused on work performance beliefs, introduce additional sleep hygiene strategies',
      emergentIssues: [
        'Potential financial stressor mentioned briefly at end of session - explore next time',
      ],
      clientStrengths: [
        'Strong self-awareness',
        'Commitment to practice',
        'Willingness to examine thoughts',
        'Good problem-solving skills',
      ],
      outcomePredictions: [
        {
          technique: 'Progressive Muscle Relaxation',
          predictedEfficacy: 0.8,
          confidence: 0.7,
          rationale:
            'Client has responded well to relaxation techniques in the past.',
        },
        {
          technique: 'Cognitive Restructuring',
          predictedEfficacy: 0.7,
          confidence: 0.6,
          rationale:
            'Client is open to examining thoughts but needs more practice.',
        },
      ],
    }

    setEditableDocumentation(mockDoc)
  }

  // Show loading state
  if (isLoading || isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-sm space-y-4">
        <h3 className="text-xl font-medium text-gray-800">
          {isGenerating
            ? 'Generating Documentation...'
            : 'Loading Documentation...'}
        </h3>
        <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-gray-600 text-center max-w-md">
          {isGenerating
            ? 'Creating comprehensive clinical documentation based on session data. This may take a moment...'
            : 'Loading session documentation...'}
        </p>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-sm space-y-4">
        <h3 className="text-xl font-medium text-red-600">
          Error Loading Documentation
        </h3>
        <p className="text-gray-600 text-center max-w-md">
          {error?.['message'] ||
            'An error occurred while loading session documentation.'}
        </p>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => loadDocumentation(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Retry
          </button>
          <button
            onClick={loadMockDocumentation}
            className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition"
          >
            Load Sample Documentation
          </button>
        </div>
      </div>
    )
  }

  // If no documentation is available yet, show generate button
  if (!editableDocumentation) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-sm space-y-4">
        <h3 className="text-xl font-medium text-gray-800">
          Session Documentation
        </h3>
        <p className="text-gray-600 text-center max-w-md">
          Generate comprehensive clinical documentation based on this sessions
          data, including emotion analysis, therapeutic techniques, and progress
          tracking.
        </p>

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleGenerateDocumentation}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Generate Documentation
          </button>

          <button
            onClick={loadMockDocumentation}
            className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition"
          >
            Load Sample Documentation
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Header with client info and duration */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-800">
              Session Documentation
            </h3>
            <p className="text-sm text-gray-600">
              Client ID: {clientId} | Session ID: {sessionId}
            </p>
          </div>
          {sessionDuration && (
            <div className="mt-2 md:mt-0 text-sm text-gray-600">
              Duration: {formatDuration(sessionDuration)}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex overflow-x-auto">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
              activeTab === 'summary'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setActiveTab('techniques')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
              activeTab === 'techniques'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Techniques
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
              activeTab === 'progress'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Progress
          </button>
          <button
            onClick={() => setActiveTab('patterns')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
              activeTab === 'patterns'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Patterns
          </button>
          <button
            onClick={() => setActiveTab('full')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
              activeTab === 'full'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Full Documentation
          </button>
        </nav>
      </div>

      {/* Content based on active tab */}
      <div className="p-4">
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <section>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Session Summary
              </h4>
              {!readOnly ? (
                <textarea
                  value={editableDocumentation?.['summary'] || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    handleChange('summary', e.target.value)
                  }
                  className="w-full p-2 border border-gray-300 rounded-md min-h-[100px]"
                />
              ) : (
                <p className="text-gray-700">{editableDocumentation?.['summary']}</p>
              )}
            </section>

            <section>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Key Insights
              </h4>
              <ul className="list-disc pl-5 space-y-1">
                {editableDocumentation?.['keyInsights']?.map(
                  (insight: string, index: number) => (
                    <li key={`insight-${index}`} className="text-gray-700">
                      {!readOnly ? (
                        <input
                          type="text"
                          value={insight}
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
                            const newInsights = [
                              ...(editableDocumentation?.['keyInsights'] || []),
                            ]

                            newInsights[index] = e.target.value
                            handleChange('keyInsights', newInsights)
                          }}
                          className="w-full p-1 border border-gray-300 rounded-md"
                        />
                      ) : (
                        insight
                      )}
                    </li>
                  ),
                ) || []}
              </ul>
              {!readOnly && (
                <button
                  onClick={() => {
                    handleChange('keyInsights', [
                      ...(editableDocumentation?.['keyInsights'] || []),
                      '',
                    ])
                  }}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add Insight
                </button>
              )}
            </section>

            <section>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Recommended Follow-Up
              </h4>
              {!readOnly ? (
                <textarea
                  value={editableDocumentation.recommendedFollowUp}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    handleChange('recommendedFollowUp', e.target.value)
                  }
                  className="w-full p-2 border border-gray-300 rounded-md min-h-[80px]"
                />
              ) : (
                <p className="text-gray-700">
                  {editableDocumentation.recommendedFollowUp}
                </p>
              )}
            </section>

            <section>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Next Session Plan
              </h4>
              {!readOnly ? (
                <textarea
                  value={editableDocumentation.nextSessionPlan}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    handleChange('nextSessionPlan', e.target.value)
                  }
                  className="w-full p-2 border border-gray-300 rounded-md min-h-[80px]"
                />
              ) : (
                <p className="text-gray-700">
                  {editableDocumentation.nextSessionPlan}
                </p>
              )}
            </section>
          </div>
        )}

        {activeTab === 'techniques' && (
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-800 mb-2">
              Therapeutic Techniques Used
            </h4>
            <div className="space-y-3">
              {editableDocumentation.therapeuticTechniques.map(
                (
                  technique: {
                    name: string
                    description: string
                    effectiveness: number
                  },
                  index: number,
                ) => (
                  <div
                    key={`technique-${index}`}
                    className="border border-gray-200 rounded-md p-3"
                  >
                    <div className="mb-2">
                      <h5 className="font-medium text-gray-800">
                        {!readOnly ? (
                          <input
                            type="text"
                            value={technique.name}
                            onChange={(
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) => {
                              const newTechniques = [
                                ...editableDocumentation.therapeuticTechniques,
                              ]

                              newTechniques[index] = {
                                ...technique,
                                name: e.target.value,
                              }
                              handleChange(
                                'therapeuticTechniques',
                                newTechniques,
                              )
                            }}
                            className="w-full p-1 border border-gray-300 rounded-md"
                          />
                        ) : (
                          technique.name
                        )}
                      </h5>
                    </div>
                    <div className="mb-2">
                      {!readOnly ? (
                        <textarea
                          value={technique.description}
                          onChange={(
                            e: React.ChangeEvent<HTMLTextAreaElement>,
                          ) => {
                            const newTechniques = [
                              ...editableDocumentation.therapeuticTechniques,
                            ]

                            newTechniques[index] = {
                              ...technique,
                              description: e.target.value,
                            }
                            handleChange('therapeuticTechniques', newTechniques)
                          }}
                          className="w-full p-1 border border-gray-300 rounded-md"
                        />
                      ) : (
                        <p className="text-gray-700">{technique.description}</p>
                      )}
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm text-gray-600 mr-2">
                        Effectiveness:
                      </span>
                      {!readOnly ? (
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={technique.effectiveness}
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
                            const newTechniques = [
                              ...editableDocumentation.therapeuticTechniques,
                            ]

                            newTechniques[index] = {
                              ...technique,
                              effectiveness: parseInt(e.target.value),
                            }
                            handleChange('therapeuticTechniques', newTechniques)
                          }}
                          className="w-32 mr-2"
                        />
                      ) : (
                        <div className="w-32 h-2 bg-gray-200 rounded-full mr-2">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{
                              width: `${(technique.effectiveness / 10) * 100}%`,
                            }}
                          ></div>
                        </div>
                      )}
                      <span className="text-sm font-medium">
                        {technique.effectiveness}/10
                      </span>
                    </div>
                  </div>
                ),
              )}
            </div>
            {!readOnly && (
              <button
                onClick={() => {
                  handleChange('therapeuticTechniques', [
                    ...editableDocumentation.therapeuticTechniques,
                    {
                      name: '',
                      description: '',
                      effectiveness: 5,
                    },
                  ])
                }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                + Add Technique
              </button>
            )}
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="space-y-4">
            <section>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Treatment Progress
              </h4>

              <div className="mt-3 space-y-4">
                <h5 className="text-sm font-medium text-gray-700">
                  Treatment Goals
                </h5>
                {editableDocumentation.treatmentProgress.goals.map(
                  (
                    goal: {
                      description: string
                      progress: number
                      notes: string
                    },
                    index: number,
                  ) => (
                    <div
                      key={`goal-${index}`}
                      className="border border-gray-200 rounded-md p-3"
                    >
                      <div className="mb-2">
                        {!readOnly ? (
                          <textarea
                            value={goal.description}
                            onChange={(
                              e: React.ChangeEvent<HTMLTextAreaElement>,
                            ) => {
                              const newGoals = [
                                ...editableDocumentation.treatmentProgress
                                  .goals,
                              ]

                              newGoals[index] = {
                                ...goal,
                                description: e.target.value,
                              }
                              handleChange('treatmentProgress', {
                                ...editableDocumentation.treatmentProgress,
                                goals: newGoals,
                              })
                            }}
                            className="w-full p-1 border border-gray-300 rounded-md"
                          />
                        ) : (
                          <p className="text-gray-800 font-medium">
                            {goal.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center mb-2">
                        <span className="text-sm text-gray-600 mr-2">
                          Progress:
                        </span>
                        {!readOnly ? (
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={goal.progress}
                            onChange={(
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) => {
                              const newGoals = [
                                ...editableDocumentation.treatmentProgress
                                  .goals,
                              ]

                              newGoals[index] = {
                                ...goal,
                                progress: parseInt(e.target.value),
                              }
                              handleChange('treatmentProgress', {
                                ...editableDocumentation.treatmentProgress,
                                goals: newGoals,
                              })
                            }}
                            className="w-32 mr-2"
                          />
                        ) : (
                          <div className="w-32 h-2 bg-gray-200 rounded-full mr-2">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${goal.progress}%` }}
                            ></div>
                          </div>
                        )}
                        <span className="text-sm font-medium">
                          {goal.progress}%
                        </span>
                      </div>
                      <div>
                        {!readOnly ? (
                          <textarea
                            value={goal.notes}
                            onChange={(
                              e: React.ChangeEvent<HTMLTextAreaElement>,
                            ) => {
                              const newGoals = [
                                ...editableDocumentation.treatmentProgress
                                  .goals,
                              ]

                              newGoals[index] = {
                                ...goal,
                                notes: e.target.value,
                              }
                              handleChange('treatmentProgress', {
                                ...editableDocumentation.treatmentProgress,
                                goals: newGoals,
                              })
                            }}
                            className="w-full p-1 border border-gray-300 rounded-md"
                            placeholder="Notes on goal progress"
                          />
                        ) : (
                          <p className="text-gray-700 text-sm">{goal.notes}</p>
                        )}
                      </div>
                    </div>
                  ),
                )}
                {!readOnly && (
                  <button
                    onClick={() => {
                      const newGoals = [
                        ...editableDocumentation.treatmentProgress.goals,
                        {
                          description: '',
                          progress: 0,
                          notes: '',
                        },
                      ]

                      handleChange('treatmentProgress', {
                        ...editableDocumentation.treatmentProgress,
                        goals: newGoals,
                      })
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Add Goal
                  </button>
                )}
              </div>

              <div className="mt-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">
                  Overall Assessment
                </h5>
                {!readOnly ? (
                  <textarea
                    value={
                      editableDocumentation.treatmentProgress.overallAssessment
                    }
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                      handleChange('treatmentProgress', {
                        ...editableDocumentation.treatmentProgress,
                        overallAssessment: e.target.value,
                      })
                    }}
                    className="w-full p-2 border border-gray-300 rounded-md min-h-[100px]"
                  />
                ) : (
                  <p className="text-gray-700">
                    {editableDocumentation.treatmentProgress.overallAssessment}
                  </p>
                )}
              </div>
            </section>

            <section>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Client Strengths
              </h4>
              <ul className="list-disc pl-5 space-y-1">
                {editableDocumentation.clientStrengths?.map(
                  (strength: string, index: number) => (
                    <li key={`strength-${index}`} className="text-gray-700">
                      {!readOnly ? (
                        <input
                          type="text"
                          value={strength}
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
                            const newStrengths = [
                              ...(editableDocumentation.clientStrengths || []),
                            ]

                            newStrengths[index] = e.target.value
                            handleChange('clientStrengths', newStrengths)
                          }}
                          className="w-full p-1 border border-gray-300 rounded-md"
                        />
                      ) : (
                        strength
                      )}
                    </li>
                  ),
                )}
              </ul>
              {!readOnly && (
                <button
                  onClick={() => {
                    handleChange('clientStrengths', [
                      ...(editableDocumentation.clientStrengths || []),
                      '',
                    ])
                  }}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add Strength
                </button>
              )}
            </section>
          </div>
        )}

        {activeTab === 'patterns' && (
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-800 mb-2">
              Emotional Patterns Observed
            </h4>
            <div className="space-y-3">
              {editableDocumentation.emotionalPatterns.map(
                (
                  pattern: { pattern: string; significance: string },
                  index: number,
                ) => (
                  <div
                    key={`pattern-${index}`}
                    className="border border-gray-200 rounded-md p-3"
                  >
                    <div className="mb-2">
                      <h5 className="font-medium text-gray-800">
                        {!readOnly ? (
                          <input
                            type="text"
                            value={pattern.pattern}
                            onChange={(
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) => {
                              const newPatterns = [
                                ...editableDocumentation.emotionalPatterns,
                              ]

                              newPatterns[index] = {
                                ...pattern,
                                pattern: e.target.value,
                              }
                              handleChange('emotionalPatterns', newPatterns)
                            }}
                            className="w-full p-1 border border-gray-300 rounded-md"
                          />
                        ) : (
                          pattern.pattern
                        )}
                      </h5>
                    </div>
                    <div>
                      {!readOnly ? (
                        <textarea
                          value={pattern.significance}
                          onChange={(
                            e: React.ChangeEvent<HTMLTextAreaElement>,
                          ) => {
                            const newPatterns = [
                              ...editableDocumentation.emotionalPatterns,
                            ]

                            newPatterns[index] = {
                              ...pattern,
                              significance: e.target.value,
                            }
                            handleChange('emotionalPatterns', newPatterns)
                          }}
                          className="w-full p-1 border border-gray-300 rounded-md"
                        />
                      ) : (
                        <p className="text-gray-700">{pattern.significance}</p>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
            {!readOnly && (
              <button
                onClick={() => {
                  handleChange('emotionalPatterns', [
                    ...editableDocumentation.emotionalPatterns,
                    {
                      pattern: '',
                      significance: '',
                    },
                  ])
                }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                + Add Pattern
              </button>
            )}

            <section className="mt-4">
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Emergent Issues to Address
              </h4>
              <ul className="list-disc pl-5 space-y-1">
                {editableDocumentation.emergentIssues?.map(
                  (issue: string, index: number) => (
                    <li key={`issue-${index}`} className="text-gray-700">
                      {!readOnly ? (
                        <input
                          type="text"
                          value={issue}
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
                            const newIssues = [
                              ...(editableDocumentation.emergentIssues || []),
                            ]

                            newIssues[index] = e.target.value
                            handleChange('emergentIssues', newIssues)
                          }}
                          className="w-full p-1 border border-gray-300 rounded-md"
                        />
                      ) : (
                        issue
                      )}
                    </li>
                  ),
                )}
              </ul>
              {!readOnly && (
                <button
                  onClick={() => {
                    handleChange('emergentIssues', [
                      ...(editableDocumentation.emergentIssues || []),
                      '',
                    ])
                  }}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add Emergent Issue
                </button>
              )}
            </section>
          </div>
        )}

        {activeTab === 'full' && (
          <div className="space-y-6">
            <section>
              <h4 className="text-lg font-medium text-gray-800 mb-3">
                Session Summary
              </h4>
              <p className="text-gray-700 mb-4">
                {editableDocumentation.summary}
              </p>

              <h5 className="text-md font-medium text-gray-800 mb-2">
                Key Insights
              </h5>
              <ul className="list-disc pl-5 space-y-1 mb-4">
                {editableDocumentation.keyInsights.map(
                  (insight: string, index: number) => (
                    <li key={`insight-full-${index}`} className="text-gray-700">
                      {insight}
                    </li>
                  ),
                )}
              </ul>
            </section>

            <section>
              <h4 className="text-lg font-medium text-gray-800 mb-3">
                Therapeutic Techniques Used
              </h4>
              <div className="space-y-3 mb-4">
                {editableDocumentation.therapeuticTechniques.map(
                  (
                    technique: {
                      name: string
                      description: string
                      effectiveness: number
                    },
                    index: number,
                  ) => (
                    <div key={`technique-full-${index}`} className="mb-3">
                      <h5 className="font-medium text-gray-800">
                        {technique.name}{' '}
                        <span className="text-sm font-normal text-gray-600">
                          (Effectiveness: {technique.effectiveness}/10)
                        </span>
                      </h5>
                      <p className="text-gray-700">{technique.description}</p>
                    </div>
                  ),
                )}
              </div>
            </section>

            <section>
              <h4 className="text-lg font-medium text-gray-800 mb-3">
                Emotional Patterns Observed
              </h4>
              <div className="space-y-3 mb-4">
                {editableDocumentation.emotionalPatterns.map(
                  (
                    pattern: { pattern: string; significance: string },
                    index: number,
                  ) => (
                    <div key={`pattern-full-${index}`} className="mb-3">
                      <h5 className="font-medium text-gray-800">
                        {pattern.pattern}
                      </h5>
                      <p className="text-gray-700">{pattern.significance}</p>
                    </div>
                  ),
                )}
              </div>
            </section>

            <section>
              <h4 className="text-lg font-medium text-gray-800 mb-3">
                Treatment Progress
              </h4>

              <h5 className="text-md font-medium text-gray-700 mb-2">
                Treatment Goals
              </h5>
              {editableDocumentation.treatmentProgress.goals.map(
                (
                  goal: {
                    description: string
                    progress: number
                    notes: string
                  },
                  index: number,
                ) => (
                  <div key={`goal-full-${index}`} className="mb-3">
                    <p className="text-gray-800 font-medium">
                      {goal.description}
                    </p>
                    <div className="flex items-center mb-1 mt-1">
                      <span className="text-sm text-gray-600 mr-2">
                        Progress:
                      </span>
                      <div className="w-32 h-2 bg-gray-200 rounded-full mr-2">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${goal.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium">
                        {goal.progress}%
                      </span>
                    </div>
                    <p className="text-gray-700 text-sm">{goal.notes}</p>
                  </div>
                ),
              )}

              <h5 className="text-md font-medium text-gray-700 mt-4 mb-2">
                Overall Assessment
              </h5>
              <p className="text-gray-700 mb-4">
                {editableDocumentation.treatmentProgress.overallAssessment}
              </p>
            </section>

            <section>
              <h4 className="text-lg font-medium text-gray-800 mb-2">
                Client Strengths
              </h4>
              <ul className="list-disc pl-5 space-y-1 mb-4">
                {editableDocumentation.clientStrengths?.map(
                  (strength: string, index: number) => (
                    <li
                      key={`strength-full-${index}`}
                      className="text-gray-700"
                    >
                      {strength}
                    </li>
                  ),
                )}
              </ul>
            </section>

            <section>
              <h4 className="text-lg font-medium text-gray-800 mb-2">
                Emergent Issues to Address
              </h4>
              <ul className="list-disc pl-5 space-y-1 mb-4">
                {editableDocumentation.emergentIssues?.map(
                  (issue: string, index: number) => (
                    <li key={`issue-full-${index}`} className="text-gray-700">
                      {issue}
                    </li>
                  ),
                )}
              </ul>
            </section>

            <section>
              <h4 className="text-lg font-medium text-gray-800 mb-2">
                Follow-Up and Planning
              </h4>
              <div className="bg-gray-50 p-3 rounded-md mb-3">
                <h5 className="text-md font-medium text-gray-800 mb-1">
                  Recommended Follow-Up
                </h5>
                <p className="text-gray-700">
                  {editableDocumentation.recommendedFollowUp}
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-md">
                <h5 className="text-md font-medium text-gray-800 mb-1">
                  Next Session Plan
                </h5>
                <p className="text-gray-700">
                  {editableDocumentation.nextSessionPlan}
                </p>
              </div>
            </section>

            {editableDocumentation?.outcomePredictions &&
              editableDocumentation.outcomePredictions.length > 0 && (
                <section className="mt-8">
                  <h4 className="text-lg font-semibold text-blue-800 mb-3">
                    Outcome Predictions
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200 rounded-lg bg-white">
                      <thead>
                        <tr className="bg-blue-50">
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                            Technique
                          </th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                            Predicted Efficacy
                          </th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                            Confidence
                          </th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                            Rationale
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {editableDocumentation.outcomePredictions.map(
                          (
                            pred: {
                              technique: string
                              predictedEfficacy: number
                              confidence: number
                              rationale: string
                            },
                            idx: number,
                          ) => (
                            <tr
                              key={`prediction-${idx}`}
                              className="border-t border-gray-100 hover:bg-blue-50 transition-colors"
                            >
                              <td className="px-4 py-2 font-semibold text-gray-900">
                                {pred.technique}
                              </td>
                              <td className="px-4 py-2">
                                {(pred.predictedEfficacy * 100).toFixed(1)}%
                              </td>
                              <td className="px-4 py-2">
                                {(pred.confidence * 100).toFixed(0)}%
                              </td>
                              <td className="px-4 py-2 text-gray-700">
                                {pred.rationale}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
          </div>
        )}
      </div>

      {!readOnly && showControls && (
        <div className="flex justify-end space-x-3 p-4 pt-4 border-t border-gray-200">
          <button
            onClick={handleSaveChanges}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
            disabled={isLoading}
          >
            Save Changes
          </button>

          <button
            onClick={handleGenerateDocumentation}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            disabled={isGenerating}
          >
            Regenerate
          </button>

          <button
            onClick={() => {
              /* Export functionality could be implemented here */
              alert('Export functionality will be implemented soon!')
            }}
            className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition"
          >
            Export
          </button>
        </div>
      )}
    </div>
  )
}

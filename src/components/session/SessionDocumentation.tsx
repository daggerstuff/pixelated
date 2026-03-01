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
  const handleChange = (field: string, value: unknown) => {
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
    } catch (error: unknown) {
      console.error('Error saving documentation:', error)
    }
  }

  // Generate documentation for the session
  const handleGenerateDocumentation = async () => {
    try {
      await generateDocumentation()
    } catch (error: unknown) {
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
      <div className='bg-white flex flex-col items-center justify-center space-y-4 rounded-lg p-8 shadow-sm'>
        <h3 className='text-gray-800 text-xl font-medium'>
          {isGenerating
            ? 'Generating Documentation...'
            : 'Loading Documentation...'}
        </h3>
        <div className='border-gray-200 border-t-blue-600 h-12 w-12 animate-spin rounded-full border-4'></div>
        <p className='text-gray-600 max-w-md text-center'>
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
      <div className='bg-white flex flex-col items-center justify-center space-y-4 rounded-lg p-8 shadow-sm'>
        <h3 className='text-red-600 text-xl font-medium'>
          Error Loading Documentation
        </h3>
        <p className='text-gray-600 max-w-md text-center'>
          {error?.['message'] ||
            'An error occurred while loading session documentation.'}
        </p>
        <div className='mt-4 flex gap-3'>
          <button
            onClick={() => loadDocumentation(true)}
            className='bg-blue-600 text-white hover:bg-blue-700 rounded-md px-4 py-2 transition'
          >
            Retry
          </button>
          <button
            onClick={loadMockDocumentation}
            className='bg-gray-100 text-gray-800 hover:bg-gray-200 rounded-md px-4 py-2 transition'
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
      <div className='bg-white flex flex-col items-center justify-center space-y-4 rounded-lg p-8 shadow-sm'>
        <h3 className='text-gray-800 text-xl font-medium'>
          Session Documentation
        </h3>
        <p className='text-gray-600 max-w-md text-center'>
          Generate comprehensive clinical documentation based on this sessions
          data, including emotion analysis, therapeutic techniques, and progress
          tracking.
        </p>

        <div className='mt-4 flex gap-3'>
          <button
            onClick={handleGenerateDocumentation}
            className='bg-blue-600 text-white hover:bg-blue-700 rounded-md px-4 py-2 transition'
          >
            Generate Documentation
          </button>

          <button
            onClick={loadMockDocumentation}
            className='bg-gray-100 text-gray-800 hover:bg-gray-200 rounded-md px-4 py-2 transition'
          >
            Load Sample Documentation
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className='bg-white overflow-hidden rounded-lg shadow-sm'>
      {/* Header with client info and duration */}
      <div className='bg-gray-50 border-gray-200 border-b p-4'>
        <div className='flex flex-col md:flex-row md:items-center md:justify-between'>
          <div>
            <h3 className='text-gray-800 text-lg font-medium'>
              Session Documentation
            </h3>
            <p className='text-gray-600 text-sm'>
              Client ID: {clientId} | Session ID: {sessionId}
            </p>
          </div>
          {sessionDuration && (
            <div className='text-gray-600 mt-2 text-sm md:mt-0'>
              Duration: {formatDuration(sessionDuration)}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className='border-gray-200 border-b'>
        <nav className='flex overflow-x-auto'>
          <button
            onClick={() => setActiveTab('summary')}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium ${
              activeTab === 'summary'
                ? 'border-blue-500 text-blue-600 border-b-2'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setActiveTab('techniques')}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium ${
              activeTab === 'techniques'
                ? 'border-blue-500 text-blue-600 border-b-2'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Techniques
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium ${
              activeTab === 'progress'
                ? 'border-blue-500 text-blue-600 border-b-2'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Progress
          </button>
          <button
            onClick={() => setActiveTab('patterns')}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium ${
              activeTab === 'patterns'
                ? 'border-blue-500 text-blue-600 border-b-2'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Patterns
          </button>
          <button
            onClick={() => setActiveTab('full')}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium ${
              activeTab === 'full'
                ? 'border-blue-500 text-blue-600 border-b-2'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Full Documentation
          </button>
        </nav>
      </div>

      {/* Content based on active tab */}
      <div className='p-4'>
        {activeTab === 'summary' && (
          <div className='space-y-4'>
            <section>
              <h4 className='text-md text-gray-800 mb-2 font-medium'>
                Session Summary
              </h4>
              {!readOnly ? (
                <textarea
                  value={editableDocumentation?.['summary'] || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    handleChange('summary', e.target.value)
                  }
                  className='border-gray-300 min-h-[100px] w-full rounded-md border p-2'
                />
              ) : (
                <p className='text-gray-700'>
                  {editableDocumentation?.['summary']}
                </p>
              )}
            </section>

            <section>
              <h4 className='text-md text-gray-800 mb-2 font-medium'>
                Key Insights
              </h4>
              <ul className='list-disc space-y-1 pl-5'>
                {editableDocumentation?.['keyInsights']?.map(
                  (insight: string, index: number) => (
                    <li key={`insight-${index}`} className='text-gray-700'>
                      {!readOnly ? (
                        <input
                          type='text'
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
                          className='border-gray-300 w-full rounded-md border p-1'
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
                  className='text-blue-600 hover:text-blue-800 mt-2 text-sm'
                >
                  + Add Insight
                </button>
              )}
            </section>

            <section>
              <h4 className='text-md text-gray-800 mb-2 font-medium'>
                Recommended Follow-Up
              </h4>
              {!readOnly ? (
                <textarea
                  value={editableDocumentation?.['recommendedFollowUp'] || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    handleChange('recommendedFollowUp', e.target.value)
                  }
                  className='border-gray-300 min-h-[80px] w-full rounded-md border p-2'
                />
              ) : (
                <p className='text-gray-700'>
                  {editableDocumentation?.['recommendedFollowUp']}
                </p>
              )}
            </section>

            <section>
              <h4 className='text-md text-gray-800 mb-2 font-medium'>
                Next Session Plan
              </h4>
              {!readOnly ? (
                <textarea
                  value={editableDocumentation?.['nextSessionPlan'] || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    handleChange('nextSessionPlan', e.target.value)
                  }
                  className='border-gray-300 min-h-[80px] w-full rounded-md border p-2'
                />
              ) : (
                <p className='text-gray-700'>
                  {editableDocumentation?.['nextSessionPlan']}
                </p>
              )}
            </section>
          </div>
        )}

        {activeTab === 'techniques' && (
          <div className='space-y-4'>
            <h4 className='text-md text-gray-800 mb-2 font-medium'>
              Therapeutic Techniques Used
            </h4>
            <div className='space-y-3'>
              {editableDocumentation?.['therapeuticTechniques']?.map(
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
                    className='border-gray-200 rounded-md border p-3'
                  >
                    <div className='mb-2'>
                      <h5 className='text-gray-800 font-medium'>
                        {!readOnly ? (
                          <input
                            type='text'
                            value={technique?.['name'] || ''}
                            onChange={(
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) => {
                              const newTechniques = [
                                ...(editableDocumentation?.[
                                  'therapeuticTechniques'
                                ] || []),
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
                            className='border-gray-300 w-full rounded-md border p-1'
                          />
                        ) : (
                          technique?.['name']
                        )}
                      </h5>
                    </div>
                    <div className='mb-2'>
                      {!readOnly ? (
                        <textarea
                          value={technique?.['description'] || ''}
                          onChange={(
                            e: React.ChangeEvent<HTMLTextAreaElement>,
                          ) => {
                            const newTechniques = [
                              ...(editableDocumentation?.[
                                'therapeuticTechniques'
                              ] || []),
                            ]

                            newTechniques[index] = {
                              ...technique,
                              description: e.target.value,
                            }
                            handleChange('therapeuticTechniques', newTechniques)
                          }}
                          className='border-gray-300 w-full rounded-md border p-1'
                        />
                      ) : (
                        <p className='text-gray-700'>{technique.description}</p>
                      )}
                    </div>
                    <div className='flex items-center'>
                      <span className='text-gray-600 mr-2 text-sm'>
                        Effectiveness:
                      </span>
                      {!readOnly ? (
                        <input
                          type='range'
                          min='1'
                          max='10'
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
                          className='mr-2 w-32'
                        />
                      ) : (
                        <div className='bg-gray-200 mr-2 h-2 w-32 rounded-full'>
                          <div
                            className='bg-blue-600 h-full rounded-full'
                            style={{
                              width: `${(technique.effectiveness / 10) * 100}%`,
                            }}
                          ></div>
                        </div>
                      )}
                      <span className='text-sm font-medium'>
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
                className='text-blue-600 hover:text-blue-800 mt-2 text-sm'
              >
                + Add Technique
              </button>
            )}
          </div>
        )}

        {activeTab === 'progress' && (
          <div className='space-y-4'>
            <section>
              <h4 className='text-md text-gray-800 mb-2 font-medium'>
                Treatment Progress
              </h4>

              <div className='mt-3 space-y-4'>
                <h5 className='text-gray-700 text-sm font-medium'>
                  Treatment Goals
                </h5>
                {editableDocumentation.treatmentProgress?.goals.map(
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
                      className='border-gray-200 rounded-md border p-3'
                    >
                      <div className='mb-2'>
                        {!readOnly ? (
                          <textarea
                            value={goal.description}
                            onChange={(
                              e: React.ChangeEvent<HTMLTextAreaElement>,
                            ) => {
                              const newGoals = [
                                ...(editableDocumentation.treatmentProgress
                                  ?.goals || []),
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
                            className='border-gray-300 w-full rounded-md border p-1'
                          />
                        ) : (
                          <p className='text-gray-800 font-medium'>
                            {goal.description}
                          </p>
                        )}
                      </div>
                      <div className='mb-2 flex items-center'>
                        <span className='text-gray-600 mr-2 text-sm'>
                          Progress:
                        </span>
                        {!readOnly ? (
                          <input
                            type='range'
                            min='0'
                            max='100'
                            value={goal.progress}
                            onChange={(
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) => {
                              const newGoals = [
                                ...(editableDocumentation.treatmentProgress
                                  ?.goals || []),
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
                            className='mr-2 w-32'
                          />
                        ) : (
                          <div className='bg-gray-200 mr-2 h-2 w-32 rounded-full'>
                            <div
                              className='bg-blue-600 h-full rounded-full'
                              style={{ width: `${goal.progress}%` }}
                            ></div>
                          </div>
                        )}
                        <span className='text-sm font-medium'>
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
                                ...(editableDocumentation.treatmentProgress
                                  ?.goals || []),
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
                            className='border-gray-300 w-full rounded-md border p-1'
                            placeholder='Notes on goal progress'
                          />
                        ) : (
                          <p className='text-gray-700 text-sm'>{goal.notes}</p>
                        )}
                      </div>
                    </div>
                  ),
                )}
                {!readOnly && (
                  <button
                    onClick={() => {
                      const newGoals = [
                        ...(editableDocumentation.treatmentProgress?.goals ||
                          []),
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
                    className='text-blue-600 hover:text-blue-800 text-sm'
                  >
                    + Add Goal
                  </button>
                )}
              </div>

              <div className='mt-4'>
                <h5 className='text-gray-700 mb-2 text-sm font-medium'>
                  Overall Assessment
                </h5>
                {!readOnly ? (
                  <textarea
                    value={
                      editableDocumentation.treatmentProgress
                        ?.overallAssessment || ''
                    }
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                      handleChange('treatmentProgress', {
                        ...editableDocumentation.treatmentProgress,
                        overallAssessment: e.target.value,
                      })
                    }}
                    className='border-gray-300 min-h-[100px] w-full rounded-md border p-2'
                  />
                ) : (
                  <p className='text-gray-700'>
                    {editableDocumentation.treatmentProgress?.overallAssessment}
                  </p>
                )}
              </div>
            </section>

            <section>
              <h4 className='text-md text-gray-800 mb-2 font-medium'>
                Client Strengths
              </h4>
              <ul className='list-disc space-y-1 pl-5'>
                {editableDocumentation.clientStrengths?.map(
                  (strength: string, index: number) => (
                    <li key={`strength-${index}`} className='text-gray-700'>
                      {!readOnly ? (
                        <input
                          type='text'
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
                          className='border-gray-300 w-full rounded-md border p-1'
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
                  className='text-blue-600 hover:text-blue-800 mt-2 text-sm'
                >
                  + Add Strength
                </button>
              )}
            </section>
          </div>
        )}

        {activeTab === 'patterns' && (
          <div className='space-y-4'>
            <h4 className='text-md text-gray-800 mb-2 font-medium'>
              Emotional Patterns Observed
            </h4>
            <div className='space-y-3'>
              {Array.isArray(editableDocumentation.emotionalPatterns) &&
                editableDocumentation.emotionalPatterns.map(
                  (
                    pattern: { pattern: string; significance: string },
                    index: number,
                  ) => (
                    <div
                      key={`pattern-${index}`}
                      className='border-gray-200 rounded-md border p-3'
                    >
                      <div className='mb-2'>
                        <h5 className='text-gray-800 font-medium'>
                          {!readOnly ? (
                            <input
                              type='text'
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
                              className='border-gray-300 w-full rounded-md border p-1'
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
                            className='border-gray-300 w-full rounded-md border p-1'
                          />
                        ) : (
                          <p className='text-gray-700'>
                            {pattern.significance}
                          </p>
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
                className='text-blue-600 hover:text-blue-800 mt-2 text-sm'
              >
                + Add Pattern
              </button>
            )}

            <section className='mt-4'>
              <h4 className='text-md text-gray-800 mb-2 font-medium'>
                Emergent Issues to Address
              </h4>
              <ul className='list-disc space-y-1 pl-5'>
                {editableDocumentation.emergentIssues?.map(
                  (issue: string, index: number) => (
                    <li key={`issue-${index}`} className='text-gray-700'>
                      {!readOnly ? (
                        <input
                          type='text'
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
                          className='border-gray-300 w-full rounded-md border p-1'
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
                  className='text-blue-600 hover:text-blue-800 mt-2 text-sm'
                >
                  + Add Emergent Issue
                </button>
              )}
            </section>
          </div>
        )}

        {activeTab === 'full' && (
          <div className='space-y-6'>
            <section>
              <h4 className='text-gray-800 mb-3 text-lg font-medium'>
                Session Summary
              </h4>
              <p className='text-gray-700 mb-4'>
                {editableDocumentation.summary}
              </p>

              <h5 className='text-md text-gray-800 mb-2 font-medium'>
                Key Insights
              </h5>
              <ul className='mb-4 list-disc space-y-1 pl-5'>
                {Array.isArray(editableDocumentation.keyInsights) &&
                  editableDocumentation.keyInsights.map(
                    (insight: string, index: number) => (
                      <li
                        key={`insight-full-${index}`}
                        className='text-gray-700'
                      >
                        {insight}
                      </li>
                    ),
                  )}
              </ul>
            </section>

            <section>
              <h4 className='text-gray-800 mb-3 text-lg font-medium'>
                Therapeutic Techniques Used
              </h4>
              <div className='mb-4 space-y-3'>
                {Array.isArray(editableDocumentation?.therapeuticTechniques) &&
                  editableDocumentation.therapeuticTechniques.map(
                    (
                      technique: {
                        name: string
                        description: string
                        effectiveness: number
                      },
                      index: number,
                    ) => (
                      <div key={`technique-full-${index}`} className='mb-3'>
                        <h5 className='text-gray-800 font-medium'>
                          {technique.name}{' '}
                          <span className='text-gray-600 text-sm font-normal'>
                            (Effectiveness: {technique.effectiveness}/10)
                          </span>
                        </h5>
                        <p className='text-gray-700'>{technique.description}</p>
                      </div>
                    ),
                  )}
              </div>
            </section>

            <section>
              <h4 className='text-gray-800 mb-3 text-lg font-medium'>
                Emotional Patterns Observed
              </h4>
              <div className='mb-4 space-y-3'>
                {Array.isArray(editableDocumentation?.emotionalPatterns) &&
                  editableDocumentation.emotionalPatterns.map(
                    (
                      pattern: { pattern: string; significance: string },
                      index: number,
                    ) => (
                      <div key={`pattern-full-${index}`} className='mb-3'>
                        <h5 className='text-gray-800 font-medium'>
                          {pattern.pattern}
                        </h5>
                        <p className='text-gray-700'>{pattern.significance}</p>
                      </div>
                    ),
                  )}
              </div>
            </section>

            <section>
              <h4 className='text-gray-800 mb-3 text-lg font-medium'>
                Treatment Progress
              </h4>

              <h5 className='text-md text-gray-700 mb-2 font-medium'>
                Treatment Goals
              </h5>
              {editableDocumentation.treatmentProgress?.goals?.map(
                (
                  goal: {
                    description: string
                    progress: number
                    notes: string
                  },
                  index: number,
                ) => (
                  <div key={`goal-full-${index}`} className='mb-3'>
                    <p className='text-gray-800 font-medium'>
                      {goal.description}
                    </p>
                    <div className='mb-1 mt-1 flex items-center'>
                      <span className='text-gray-600 mr-2 text-sm'>
                        Progress:
                      </span>
                      <div className='bg-gray-200 mr-2 h-2 w-32 rounded-full'>
                        <div
                          className='bg-blue-600 h-full rounded-full'
                          style={{ width: `${goal.progress}%` }}
                        ></div>
                      </div>
                      <span className='text-sm font-medium'>
                        {goal.progress}%
                      </span>
                    </div>
                    <p className='text-gray-700 text-sm'>{goal.notes}</p>
                  </div>
                ),
              )}

              <h5 className='text-md text-gray-700 mb-2 mt-4 font-medium'>
                Overall Assessment
              </h5>
              <p className='text-gray-700 mb-4'>
                {editableDocumentation.treatmentProgress?.overallAssessment}
              </p>
            </section>

            <section>
              <h4 className='text-gray-800 mb-2 text-lg font-medium'>
                Client Strengths
              </h4>
              <ul className='mb-4 list-disc space-y-1 pl-5'>
                {editableDocumentation.clientStrengths?.map(
                  (strength: string, index: number) => (
                    <li
                      key={`strength-full-${index}`}
                      className='text-gray-700'
                    >
                      {strength}
                    </li>
                  ),
                )}
              </ul>
            </section>

            <section>
              <h4 className='text-gray-800 mb-2 text-lg font-medium'>
                Emergent Issues to Address
              </h4>
              <ul className='mb-4 list-disc space-y-1 pl-5'>
                {editableDocumentation.emergentIssues?.map(
                  (issue: string, index: number) => (
                    <li key={`issue-full-${index}`} className='text-gray-700'>
                      {issue}
                    </li>
                  ),
                )}
              </ul>
            </section>

            <section>
              <h4 className='text-gray-800 mb-2 text-lg font-medium'>
                Follow-Up and Planning
              </h4>
              <div className='bg-gray-50 mb-3 rounded-md p-3'>
                <h5 className='text-md text-gray-800 mb-1 font-medium'>
                  Recommended Follow-Up
                </h5>
                <p className='text-gray-700'>
                  {editableDocumentation.recommendedFollowUp}
                </p>
              </div>
              <div className='bg-gray-50 rounded-md p-3'>
                <h5 className='text-md text-gray-800 mb-1 font-medium'>
                  Next Session Plan
                </h5>
                <p className='text-gray-700'>
                  {editableDocumentation.nextSessionPlan}
                </p>
              </div>
            </section>

            {editableDocumentation?.outcomePredictions &&
              editableDocumentation.outcomePredictions.length > 0 && (
                <section className='mt-8'>
                  <h4 className='text-blue-800 mb-3 text-lg font-semibold'>
                    Outcome Predictions
                  </h4>
                  <div className='overflow-x-auto'>
                    <table className='border-gray-200 bg-white min-w-full rounded-lg border'>
                      <thead>
                        <tr className='bg-blue-50'>
                          <th className='text-gray-700 px-4 py-2 text-left text-sm font-medium'>
                            Technique
                          </th>
                          <th className='text-gray-700 px-4 py-2 text-left text-sm font-medium'>
                            Predicted Efficacy
                          </th>
                          <th className='text-gray-700 px-4 py-2 text-left text-sm font-medium'>
                            Confidence
                          </th>
                          <th className='text-gray-700 px-4 py-2 text-left text-sm font-medium'>
                            Rationale
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(
                          editableDocumentation?.outcomePredictions,
                        ) &&
                          editableDocumentation.outcomePredictions.map(
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
                                className='border-gray-100 hover:bg-blue-50 border-t transition-colors'
                              >
                                <td className='text-gray-900 px-4 py-2 font-semibold'>
                                  {pred.technique}
                                </td>
                                <td className='px-4 py-2'>
                                  {(pred.predictedEfficacy * 100).toFixed(1)}%
                                </td>
                                <td className='px-4 py-2'>
                                  {(pred.confidence * 100).toFixed(0)}%
                                </td>
                                <td className='text-gray-700 px-4 py-2'>
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
        <div className='border-gray-200 flex justify-end space-x-3 border-t p-4 pt-4'>
          <button
            onClick={handleSaveChanges}
            className='bg-green-600 text-white hover:bg-green-700 rounded-md px-4 py-2 transition'
            disabled={isLoading}
          >
            Save Changes
          </button>

          <button
            onClick={handleGenerateDocumentation}
            className='bg-blue-600 text-white hover:bg-blue-700 rounded-md px-4 py-2 transition'
            disabled={isGenerating}
          >
            Regenerate
          </button>

          <button
            onClick={() => {
              /* Export functionality could be implemented here */
              alert('Export functionality will be implemented soon!')
            }}
            className='bg-gray-100 text-gray-800 hover:bg-gray-200 rounded-md px-4 py-2 transition'
          >
            Export
          </button>
        </div>
      )}
    </div>
  )
}

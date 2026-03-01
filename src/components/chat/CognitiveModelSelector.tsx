import { useState, useEffect } from 'react'

import type {
  PatientResponseStyleConfig,
  CognitiveModel,
} from '@/lib/ai/types/CognitiveModel'
import { KVStore } from '@/lib/db/KVStore'
import { cn } from '@/lib/utils'

type ModelIdentifier = {
  id: string
  name: string
  presentingIssues: string[]
  diagnosisSummary?: string
}

interface CognitiveModelSelectorProps {
  selectedModelId: string | null
  onSelectModel: (modelId: string) => void
  onStyleConfigChange?: (config: PatientResponseStyleConfig) => void
  className?: string
}

export function CognitiveModelSelector({
  selectedModelId,
  onSelectModel,
  onStyleConfigChange,
  className,
}: CognitiveModelSelectorProps) {
  const [models, setModels] = useState<ModelIdentifier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentModelDetails, setCurrentModelDetails] =
    useState<CognitiveModel | null>(null)

  // Response style configuration
  const [styleConfig, setStyleConfig] = useState<PatientResponseStyleConfig>({
    openness: 5,
    coherence: 7,
    defenseLevel: 5,
    disclosureStyle: 'selective',
    challengeResponses: 'curious',
  })

  // Fetch available patient models
  useEffect(() => {
    const fetchModels = async () => {
      setLoading(true)
      setError(null)

      try {
        const kvStore = new KVStore('cognitive_models_', true)
        const modelList = await kvStore.get<ModelIdentifier[]>(
          'patient_models_list',
        )

        if (modelList && modelList.length > 0) {
          setModels(modelList)

          // Set the first model as selected if none is selected
          if (!selectedModelId && onSelectModel && modelList[0]) {
            onSelectModel(modelList[0].id)
          }

          // Load details for the selected model
          if (selectedModelId) {
            void loadModelDetails(selectedModelId)
          }
        } else {
          // If no models found, set up some example data
          setModels([
            {
              id: 'example-depression',
              name: 'Sarah - Depression',
              presentingIssues: [
                'Depression',
                'Low self-esteem',
                'Work stress',
              ],

              diagnosisSummary: 'Major Depressive Disorder',
            },
            {
              id: 'example-anxiety',
              name: 'Mark - Anxiety',
              presentingIssues: [
                'Generalized anxiety',
                'Panic attacks',
                'Social avoidance',
              ],

              diagnosisSummary: 'Generalized Anxiety Disorder',
            },
            {
              id: 'example-trauma',
              name: 'Elena - Trauma',
              presentingIssues: [
                'PTSD symptoms',
                'Nightmares',
                'Hypervigilance',
              ],

              diagnosisSummary: 'Post-Traumatic Stress Disorder',
            },
          ])

          // Set the first example model as selected if none is selected
          if (!selectedModelId && onSelectModel) {
            onSelectModel('example-depression')
          }
        }
      } catch (err: unknown) {
        console.error('Failed to fetch cognitive models:', err)
        setError('Failed to load patient models. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    void fetchModels()
  }, [selectedModelId, onSelectModel])

  // Load detailed information for the selected model
  const loadModelDetails = async (modelId: string) => {
    if (!modelId) {
      return
    }

    try {
      const kvStore = new KVStore('cognitive_models_', true)
      const modelDetails = await kvStore.get<CognitiveModel>(
        `patient_model_${modelId}`,
      )

      if (modelDetails) {
        setCurrentModelDetails(modelDetails)
      } else if (modelId === 'example-depression') {
        setCurrentModelDetails({
          id: 'example-depression',
          name: 'Sarah',
          demographicInfo: {
            age: 34,
            gender: 'Female',
            occupation: 'Marketing Manager',
            familyStatus: 'Single',
            culturalFactors: [],
          },
          presentingIssues: ['Depression', 'Low self-esteem', 'Work stress'],
          diagnosisInfo: {
            primaryDiagnosis: 'Major Depressive Disorder',
            secondaryDiagnoses: [],
            durationOfSymptoms: '6 months',
            severity: 'moderate',
          },
          coreBeliefs: [
            {
              belief: "I'm not good enough",
              strength: 8,
              evidence: [],
              formationContext: 'Childhood criticism',
              relatedDomains: ['work', 'relationships'],
            },
            {
              belief: "I'm going to fail",
              strength: 7,
              evidence: [],
              formationContext: 'Past work setbacks',
              relatedDomains: ['career', 'future'],
            },
          ],
          distortionPatterns: [],
          behavioralPatterns: [],
          emotionalPatterns: [],
          relationshipPatterns: [],
          formativeExperiences: [],
          therapyHistory: {
            previousApproaches: [],
            helpfulInterventions: [],
            unhelpfulInterventions: [],
            insights: [],
            progressMade: '',
            remainingChallenges: [],
          },
          conversationalStyle: {
            verbosity: 5,
            emotionalExpressiveness: 5,
            resistance: 3,
            insightLevel: 3,
            preferredCommunicationModes: [],
          },
          goalsForTherapy: [],
          therapeuticProgress: {
            insights: [],
            skillsAcquired: [],
            resistanceLevel: 5,
            changeReadiness: 'contemplation',
            sessionProgressLog: [],
            trustLevel: 5,
            rapportScore: 5,
            therapistPerception: 'neutral',
            transferenceState: 'none',
          },
        })
      } else if (modelId === 'example-anxiety') {
        setCurrentModelDetails({
          id: 'example-anxiety',
          name: 'Mark',
          demographicInfo: {
            age: 29,
            gender: 'Male',
            occupation: 'Software Developer',
            familyStatus: 'Married',
            culturalFactors: [],
          },
          presentingIssues: [
            'Generalized anxiety',
            'Panic attacks',
            'Social avoidance',
          ],
          diagnosisInfo: {
            primaryDiagnosis: 'Generalized Anxiety Disorder',
            secondaryDiagnoses: [],
            durationOfSymptoms: '2 years',
            severity: 'severe',
          },
          coreBeliefs: [
            {
              belief: "I'm always in danger",
              strength: 8,
              evidence: [],
              formationContext: 'Childhood trauma',
              relatedDomains: ['safety', 'health'],
            },
            {
              belief: "I can't handle uncertainty",
              strength: 9,
              evidence: [],
              formationContext: 'Unpredictable family environment',
              relatedDomains: ['control', 'future'],
            },
          ],
          distortionPatterns: [],
          behavioralPatterns: [],
          emotionalPatterns: [],
          relationshipPatterns: [],
          formativeExperiences: [],
          therapyHistory: {
            previousApproaches: [],
            helpfulInterventions: [],
            unhelpfulInterventions: [],
            insights: [],
            progressMade: '',
            remainingChallenges: [],
          },
          conversationalStyle: {
            verbosity: 5,
            emotionalExpressiveness: 5,
            resistance: 3,
            insightLevel: 3,
            preferredCommunicationModes: [],
          },
          goalsForTherapy: [],
          therapeuticProgress: {
            insights: [],
            skillsAcquired: [],
            resistanceLevel: 5,
            changeReadiness: 'contemplation',
            sessionProgressLog: [],
            trustLevel: 5,
            rapportScore: 5,
            therapistPerception: 'neutral',
            transferenceState: 'none',
          },
        })
      } else if (modelId === 'example-trauma') {
        setCurrentModelDetails({
          id: 'example-trauma',
          name: 'Elena',
          demographicInfo: {
            age: 42,
            gender: 'Female',
            occupation: 'Teacher',
            familyStatus: 'Divorced',
            culturalFactors: [],
          },
          presentingIssues: ['PTSD symptoms', 'Nightmares', 'Hypervigilance'],
          diagnosisInfo: {
            primaryDiagnosis: 'Post-Traumatic Stress Disorder',
            secondaryDiagnoses: [],
            durationOfSymptoms: '1 year',
            severity: 'moderate',
          },
          coreBeliefs: [
            {
              belief: 'The world is dangerous',
              strength: 9,
              evidence: [],
              formationContext: 'Traumatic incident',
              relatedDomains: ['safety', 'trust'],
            },
            {
              belief: 'I have to be on guard at all times',
              strength: 8,
              evidence: [],
              formationContext: 'Post-trauma hypervigilance',
              relatedDomains: ['safety', 'control'],
            },
          ],
          distortionPatterns: [],
          behavioralPatterns: [],
          emotionalPatterns: [],
          relationshipPatterns: [],
          formativeExperiences: [],
          therapyHistory: {
            previousApproaches: [],
            helpfulInterventions: [],
            unhelpfulInterventions: [],
            insights: [],
            progressMade: '',
            remainingChallenges: [],
          },
          conversationalStyle: {
            verbosity: 5,
            emotionalExpressiveness: 5,
            resistance: 3,
            insightLevel: 3,
            preferredCommunicationModes: [],
          },
          goalsForTherapy: [],
          therapeuticProgress: {
            insights: [],
            skillsAcquired: [],
            resistanceLevel: 5,
            changeReadiness: 'contemplation',
            sessionProgressLog: [],
            trustLevel: 5,
            rapportScore: 5,
            therapistPerception: 'neutral',
            transferenceState: 'none',
          },
        })
      }
    } catch (err: unknown) {
      console.error(`Failed to load model details for ${modelId}:`, err)
    }
  }

  // Handle model selection
  const handleModelSelect = (modelId: string) => {
    onSelectModel(modelId)
    void loadModelDetails(modelId)
  }

  // Handle style config changes
  const handleStyleChange = (
    field: keyof PatientResponseStyleConfig,
    value: string | number,
  ) => {
    const updatedConfig = {
      ...styleConfig,
      [field]: value,
    }
    setStyleConfig(updatedConfig)

    if (onStyleConfigChange) {
      onStyleConfigChange(updatedConfig)
    }
  }

  // Handle disclosure style selection
  const handleDisclosureStyleChange = (
    style: 'guarded' | 'selective' | 'reflective' | 'open',
  ) => {
    handleStyleChange('disclosureStyle', style)
  }

  // Handle challenge response selection
  const handleChallengeResponseChange = (
    response: 'defensive' | 'curious' | 'dismissive' | 'receptive',
  ) => {
    handleStyleChange('challengeResponses', response)
  }

  if (loading) {
    return (
      <div className='flex justify-center p-4'>Loading patient models...</div>
    )
  }

  if (error) {
    return <div className='text-red-500 p-4'>{error}</div>
  }

  return (
    <div
      className={cn(
        'patient-model-selector bg-gray-50 border rounded-lg p-4',
        className,
      )}
    >
      <h3 className='mb-4 text-lg font-medium'>Select Patient Profile</h3>

      <div className='mb-6 grid grid-cols-1 gap-4 md:grid-cols-2'>
        <div>
          <h4 className='mb-2 text-sm font-medium'>Available Profiles</h4>
          <div className='space-y-2'>
            {models.map((model) => (
              <button
                key={model.id}
                className={cn(
                  'w-full text-left p-3 rounded-md border transition-colors',
                  selectedModelId === model.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-100',
                )}
                onClick={() => handleModelSelect(model.id)}
              >
                <div className='font-medium'>{model.name}</div>
                <div className='text-gray-500 text-sm'>
                  {model.presentingIssues.join(', ')}
                </div>
                {model.diagnosisSummary && (
                  <div className='text-gray-500 mt-1 text-xs'>
                    {model.diagnosisSummary}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          {currentModelDetails && (
            <div>
              <h4 className='mb-2 text-sm font-medium'>Patient Details</h4>
              <div className='bg-white border-gray-200 rounded-md border p-3'>
                <div className='mb-3 grid grid-cols-2 gap-2'>
                  <div>
                    <div className='text-gray-500 text-xs'>Name</div>
                    <div>{currentModelDetails.name}</div>
                  </div>
                  <div>
                    <div className='text-gray-500 text-xs'>Age</div>
                    <div>{currentModelDetails.demographicInfo?.age}</div>
                  </div>
                  <div>
                    <div className='text-gray-500 text-xs'>Gender</div>
                    <div>{currentModelDetails.demographicInfo?.gender}</div>
                  </div>
                  <div>
                    <div className='text-gray-500 text-xs'>Occupation</div>
                    <div>{currentModelDetails.demographicInfo?.occupation}</div>
                  </div>
                </div>

                <div className='mb-3'>
                  <div className='text-gray-500 text-xs'>Presenting Issues</div>
                  <div className='mt-1 flex flex-wrap gap-1'>
                    {currentModelDetails.presentingIssues?.map(
                      (issue: string, index: number) => (
                        <span
                          key={`issue-${issue}-${index}`}
                          className='bg-gray-100 text-gray-800 inline-block rounded px-2 py-1 text-xs'
                        >
                          {issue}
                        </span>
                      ),
                    )}
                  </div>
                </div>

                {currentModelDetails.coreBeliefs?.length > 0 && (
                  <div>
                    <div className='text-gray-500 text-xs'>Core Beliefs</div>
                    <ul className='mt-1 text-sm'>
                      {currentModelDetails.coreBeliefs.map(
                        (belief, index: number) => (
                          <li
                            key={`belief-${belief.belief}-${index}`}
                            className='mb-1'
                          >
                            &ldquo;{belief.belief}&rdquo; (Strength:{' '}
                            {belief.strength}/10)
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className='mt-4'>
            <h4 className='mb-2 text-sm font-medium'>
              Response Style Configuration
            </h4>
            <div className='bg-white border-gray-200 rounded-md border p-3'>
              <div className='mb-3'>
                <label
                  htmlFor='openness-slider'
                  className='text-gray-500 mb-1 block text-xs'
                >
                  Openness (1 = Closed, 10 = Very Open)
                </label>
                <input
                  id='openness-slider'
                  type='range'
                  min='1'
                  max='10'
                  value={styleConfig.openness}
                  onChange={(e) =>
                    handleStyleChange('openness', parseInt(e.target.value))
                  }
                  className='w-full'
                  aria-label='Openness level from 1 to 10'
                />

                <div className='text-gray-500 flex justify-between text-xs'>
                  <span>Closed</span>
                  <span>Value: {styleConfig.openness}</span>
                  <span>Open</span>
                </div>
              </div>

              <div className='mb-3'>
                <label
                  htmlFor='coherence-slider'
                  className='text-gray-500 mb-1 block text-xs'
                >
                  Coherence (1 = Disorganized, 10 = Very Organized)
                </label>
                <input
                  id='coherence-slider'
                  type='range'
                  min='1'
                  max='10'
                  value={styleConfig.coherence}
                  onChange={(e) =>
                    handleStyleChange('coherence', parseInt(e.target.value))
                  }
                  className='w-full'
                  aria-label='Coherence level from 1 to 10'
                />

                <div className='text-gray-500 flex justify-between text-xs'>
                  <span>Disorganized</span>
                  <span>Value: {styleConfig.coherence}</span>
                  <span>Organized</span>
                </div>
              </div>

              <div className='mb-3'>
                <label
                  htmlFor='defense-slider'
                  className='text-gray-500 mb-1 block text-xs'
                >
                  Defense Level (1 = Low Defenses, 10 = High Defenses)
                </label>
                <input
                  id='defense-slider'
                  type='range'
                  min='1'
                  max='10'
                  value={styleConfig.defenseLevel}
                  onChange={(e) =>
                    handleStyleChange('defenseLevel', parseInt(e.target.value))
                  }
                  className='w-full'
                  aria-label='Defense level from 1 to 10'
                />

                <div className='text-gray-500 flex justify-between text-xs'>
                  <span>Low</span>
                  <span>Value: {styleConfig.defenseLevel}</span>
                  <span>High</span>
                </div>
              </div>

              <div className='mb-3'>
                <label
                  htmlFor='disclosure-style'
                  className='text-gray-500 mb-1 block text-xs'
                >
                  Disclosure Style
                </label>
                <div className='grid grid-cols-4 gap-1'>
                  {(
                    ['guarded', 'selective', 'reflective', 'open'] as const
                  ).map((style) => (
                    <button
                      key={style}
                      className={cn(
                        'text-xs py-1 px-2 rounded',
                        styleConfig.disclosureStyle === style
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 hover:bg-gray-200',
                      )}
                      onClick={() => handleDisclosureStyleChange(style)}
                    >
                      {style.charAt(0).toUpperCase() + style.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor='challenge-response'
                  className='text-gray-500 mb-1 block text-xs'
                >
                  Response to Challenges
                </label>
                <div className='grid grid-cols-4 gap-1'>
                  {(
                    ['defensive', 'curious', 'dismissive', 'receptive'] as const
                  ).map((response) => (
                    <button
                      key={response}
                      className={cn(
                        'text-xs py-1 px-2 rounded',
                        styleConfig.challengeResponses === response
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 hover:bg-gray-200',
                      )}
                      onClick={() => handleChallengeResponseChange(response)}
                    >
                      {response.charAt(0).toUpperCase() + response.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

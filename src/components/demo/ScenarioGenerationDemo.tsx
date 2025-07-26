import React, { useState } from 'react'
import type {
  ClinicalCase,
  PatientInfo,
  PresentingProblemEvent,
} from '../../lib/types/psychology-pipeline'
import PresentingProblemVisualization from './PresentingProblemVisualization'
import DemographicBalancingDisplay from './DemographicBalancingDisplay'
import ClinicalFormulationDemo from './ClinicalFormulationDemo'

interface ClientProfileFormData {
  patientInfo: PatientInfo
  presentingProblem: string
  presentingProblemDevelopment: PresentingProblemEvent[]
  complexity: 'low' | 'medium' | 'high'
  therapeuticApproach: string[]
  culturalFactors: string[]
}

const ScenarioGenerationDemo: React.FC = () => {
  const [profileData, setProfileData] = useState<ClientProfileFormData>({
    patientInfo: {
      age: 35,
      gender: 'female',
      occupation: 'Marketing Manager',
      background: 'Urban professional with supportive family network',
    },
    presentingProblem: 'Generalized anxiety and work-related stress',
    presentingProblemDevelopment: [
      {
        time: '6 months ago',
        description: 'Started new high-pressure job position',
      },
      {
        time: '3 months ago',
        description: 'Began experiencing sleep difficulties and worry',
      },
      {
        time: '1 month ago',
        description: 'Anxiety symptoms intensified, affecting work performance',
      },
    ],
    complexity: 'medium',
    therapeuticApproach: ['CBT', 'Mindfulness'],
    culturalFactors: [
      'Urban professional culture',
      'Work-life balance expectations',
    ],
  })

  const [generatedProfile, setGeneratedProfile] =
    useState<Partial<ClinicalCase> | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [apiConnectionStatus, setApiConnectionStatus] = useState<
    'connected' | 'disconnected' | 'testing'
  >('disconnected')
  const [generationMetadata, setGenerationMetadata] = useState<{
    processingTime: number
    qualityScore: number
    balanceScore: number
    timestamp: string
  } | null>(null)

  const genderOptions = ['female', 'male', 'non-binary', 'prefer not to say']
  const complexityOptions = [
    {
      value: 'low',
      label: 'Low - Single presenting issue, stable support system',
    },
    { value: 'medium', label: 'Medium - Multiple factors, some comorbidity' },
    {
      value: 'high',
      label: 'High - Complex trauma, multiple diagnoses, crisis risk',
    },
  ]
  const therapeuticApproaches = [
    'CBT',
    'DBT',
    'Psychodynamic',
    'Humanistic',
    'EMDR',
    'Mindfulness',
    'Solution-Focused',
    'Family Systems',
  ]

  const handlePatientInfoChange = (
    field: keyof PatientInfo,
    value: string | number,
  ) => {
    setProfileData((prev) => ({
      ...prev,
      patientInfo: { ...prev.patientInfo, [field]: value },
    }))
  }

  const handlePresentingProblemChange = (value: string) => {
    setProfileData((prev) => ({ ...prev, presentingProblem: value }))
  }

  const handleComplexityChange = (value: 'low' | 'medium' | 'high') => {
    setProfileData((prev) => ({ ...prev, complexity: value }))
  }

  const handleTherapeuticApproachToggle = (approach: string) => {
    setProfileData((prev) => ({
      ...prev,
      therapeuticApproach: prev.therapeuticApproach.includes(approach)
        ? prev.therapeuticApproach.filter((a) => a !== approach)
        : [...prev.therapeuticApproach, approach],
    }))
  }

  const addPresentingProblemEvent = () => {
    setProfileData((prev) => ({
      ...prev,
      presentingProblemDevelopment: [
        ...prev.presentingProblemDevelopment,
        { time: '', description: '' },
      ],
    }))
  }

  const updatePresentingProblemEvent = (
    index: number,
    field: 'time' | 'description',
    value: string,
  ) => {
    setProfileData((prev) => ({
      ...prev,
      presentingProblemDevelopment: prev.presentingProblemDevelopment.map(
        (event, i) => (i === index ? { ...event, [field]: value } : event),
      ),
    }))
  }

  const removePresentingProblemEvent = (index: number) => {
    setProfileData((prev) => ({
      ...prev,
      presentingProblemDevelopment: prev.presentingProblemDevelopment.filter(
        (_, i) => i !== index,
      ),
    }))
  }

  const generateProfile = async () => {
    setIsGenerating(true)
    setApiConnectionStatus('testing')

    try {
      // Use the client scenario generator API
      const { generateClientScenario } = await import(
        '../../lib/api/psychology-pipeline-demo'
      )

      const requestData = {
        patientInfo: profileData.patientInfo,
        presentingProblem: profileData.presentingProblem,
        presentingProblemDevelopment: profileData.presentingProblemDevelopment,
        complexity: profileData.complexity,
        therapeuticApproach: profileData.therapeuticApproach,
        culturalFactors: profileData.culturalFactors,
      }

      const generatedResponse = await generateClientScenario(requestData)

      // Convert API response to ClinicalCase format
      const generated: Partial<ClinicalCase> = {
        caseId: generatedResponse.caseId,
        patientInfo: generatedResponse.patientInfo,
        presentingProblem: generatedResponse.presentingProblem,
        presentingProblemDevelopment:
          generatedResponse.presentingProblemDevelopment,
        clinicalFormulation: generatedResponse.clinicalFormulation,
        treatmentPlan: generatedResponse.treatmentPlan,
      }

      setGeneratedProfile(generated)
      setGenerationMetadata({
        processingTime: generatedResponse.generationMetadata.processingTime,
        qualityScore: generatedResponse.generationMetadata.qualityScore,
        balanceScore: generatedResponse.generationMetadata.balanceScore,
        timestamp: generatedResponse.generationMetadata.timestamp,
      })
      setApiConnectionStatus('connected')

      // Show generation metadata
      console.log(
        'Scenario Generation Metadata:',
        generatedResponse.generationMetadata,
      )
    } catch (error) {
      console.error('Error generating client scenario:', error)
      setApiConnectionStatus('disconnected')

      // Fallback to original mock generation
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const generated: Partial<ClinicalCase> = {
        caseId: `CASE_${Date.now()}`,
        patientInfo: profileData.patientInfo,
        presentingProblem: profileData.presentingProblem,
        presentingProblemDevelopment: profileData.presentingProblemDevelopment,
        clinicalFormulation: {
          provisionalDiagnosis: [
            'Generalized Anxiety Disorder (300.02)',
            'Adjustment Disorder with Anxiety (309.24)',
          ],
          contributingFactors: {
            biological: [
              'Possible genetic predisposition to anxiety',
              'Sleep disruption affecting stress response',
            ],
            psychological: [
              'Perfectionist tendencies',
              'Catastrophic thinking patterns',
              'Low distress tolerance',
            ],
            social: [
              'High-pressure work environment',
              'Limited work-life boundaries',
              'Social comparison pressures',
            ],
          },
          summary:
            'Client presents with work-related anxiety that has escalated over the past 6 months following a job transition. Symptoms include persistent worry, sleep difficulties, and performance anxiety that is beginning to impact professional functioning.',
        },
        treatmentPlan: {
          goals: {
            shortTerm: [
              'Reduce anxiety symptoms by 40% within 8 weeks',
              'Establish healthy sleep hygiene routine',
              'Develop coping strategies for work stress',
            ],
            longTerm: [
              'Maintain stable mood and anxiety levels',
              'Establish sustainable work-life balance',
              'Build resilience for future stressors',
            ],
          },
          interventions: [
            'Cognitive restructuring for catastrophic thinking',
            'Progressive muscle relaxation training',
            'Mindfulness-based stress reduction techniques',
            'Time management and boundary-setting skills',
          ],
          modalities: profileData.therapeuticApproach,
          outcomeMeasures: [
            'GAD-7',
            'Beck Anxiety Inventory',
            'Work and Social Adjustment Scale',
          ],
        },
      }

      setGeneratedProfile(generated)
      setGenerationMetadata({
        processingTime: 2000,
        qualityScore: 75,
        balanceScore: 70,
        timestamp: new Date().toISOString(),
      })
    }

    setIsGenerating(false)
  }

  return (
    <div className="scenario-generation-demo p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Scenario Generation Showcase
            </h2>
            <p className="text-gray-600">
              Create comprehensive client profiles for therapeutic training
              scenarios
            </p>
          </div>

          {/* API Connection Status */}
          <div className="flex flex-col items-end gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                apiConnectionStatus === 'connected'
                  ? 'bg-green-100 text-green-800'
                  : apiConnectionStatus === 'testing'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  apiConnectionStatus === 'connected'
                    ? 'bg-green-500'
                    : apiConnectionStatus === 'testing'
                      ? 'bg-yellow-500 animate-pulse'
                      : 'bg-red-500'
                }`}
              ></div>
              <span>
                {apiConnectionStatus === 'connected'
                  ? 'API Connected'
                  : apiConnectionStatus === 'testing'
                    ? 'Testing Connection'
                    : 'API Disconnected'}
              </span>
            </div>

            {/* Generation Metadata */}
            {generationMetadata && (
              <div className="text-xs text-gray-500 text-right">
                <div>
                  Quality: {generationMetadata.qualityScore.toFixed(1)}%
                </div>
                <div>
                  Balance: {generationMetadata.balanceScore.toFixed(1)}%
                </div>
                <div>Time: {generationMetadata.processingTime}ms</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Form */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">
              Client Profile Creation
            </h3>

            {/* Patient Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-700">Patient Information</h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="patient-age" className="block text-sm font-medium text-gray-700 mb-1">
                    Age
                  </label>
                  <input
                    id="patient-age"
                    type="number"
                    value={profileData.patientInfo.age}
                    onChange={(e) =>
                      handlePatientInfoChange('age', parseInt(e.target.value))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="18"
                    max="100"
                  />
                </div>

                <div>
                  <label htmlFor="patient-gender" className="block text-sm font-medium text-gray-700 mb-1">
                    Gender
                  </label>
                  <select
                    id="patient-gender"
                    value={profileData.patientInfo.gender}
                    onChange={(e) =>
                      handlePatientInfoChange('gender', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {genderOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="patient-occupation" className="block text-sm font-medium text-gray-700 mb-1">
                  Occupation
                </label>
                <input
                  id="patient-occupation"
                  type="text"
                  value={profileData.patientInfo.occupation}
                  onChange={(e) =>
                    handlePatientInfoChange('occupation', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="patient-background" className="block text-sm font-medium text-gray-700 mb-1">
                  Background
                </label>
                <textarea
                  id="patient-background"
                  value={profileData.patientInfo.background}
                  onChange={(e) =>
                    handlePatientInfoChange('background', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            </div>

            {/* Presenting Problem */}
            <div className="space-y-4 mt-6">
              <h4 className="font-medium text-gray-700">Presenting Problem</h4>

              <div>
                <label htmlFor="primary-concern" className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Concern
                </label>
                <textarea
                  id="primary-concern"
                  value={profileData.presentingProblem}
                  onChange={(e) =>
                    handlePresentingProblemChange(e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="problem-timeline" className="block text-sm font-medium text-gray-700">
                    Problem Development Timeline
                  </label>
                  <button
                    onClick={addPresentingProblemEvent}
                    className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                  >
                    Add Event
                  </button>
                </div>

                <div className="space-y-2">
                  {profileData.presentingProblemDevelopment.map(
                    (event, index) => (
                      <div
                        key={`${event.time}-${event.description.slice(0, 20)}`}
                        className="flex gap-2 items-start"
                      >
                        <input
                          type="text"
                          placeholder="Timeline (e.g., 3 months ago)"
                          value={event.time}
                          onChange={(e) =>
                            updatePresentingProblemEvent(
                              index,
                              'time',
                              e.target.value,
                            )
                          }
                          className="w-1/3 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Event description"
                          value={event.description}
                          onChange={(e) =>
                            updatePresentingProblemEvent(
                              index,
                              'description',
                              e.target.value,
                            )
                          }
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <button
                          onClick={() => removePresentingProblemEvent(index)}
                          className="px-2 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>

            {/* Case Complexity */}
            <div className="space-y-4 mt-6">
              <h4 className="font-medium text-gray-700">Case Complexity</h4>
              <div className="space-y-2">
                {complexityOptions.map((option) => (
                  <label key={option.value} className="flex items-center">
                    <input
                      type="radio"
                      name="complexity"
                      value={option.value}
                      checked={profileData.complexity === option.value}
                      onChange={(e) =>
                        handleComplexityChange(
                          e.target.value as 'low' | 'medium' | 'high',
                        )
                      }
                      className="mr-2"
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Therapeutic Approaches */}
            <div className="space-y-4 mt-6">
              <h4 className="font-medium text-gray-700">
                Preferred Therapeutic Approaches
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {therapeuticApproaches.map((approach) => (
                  <label key={approach} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={profileData.therapeuticApproach.includes(
                        approach,
                      )}
                      onChange={() => handleTherapeuticApproachToggle(approach)}
                      className="mr-2"
                    />
                    <span className="text-sm">{approach}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={generateProfile}
              disabled={isGenerating}
              className="w-full mt-6 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating
                ? 'Generating Profile...'
                : 'Generate Comprehensive Profile'}
            </button>
          </div>
        </div>

        {/* Generated Profile Display */}
        <div className="space-y-6">
          {/* Timeline Visualization - Always Visible */}
          <PresentingProblemVisualization
            events={profileData.presentingProblemDevelopment}
            presentingProblem={profileData.presentingProblem}
          />

          {/* Demographic Balancing Display */}
          <DemographicBalancingDisplay
            currentProfile={profileData.patientInfo}
          />

          {/* Clinical Formulation Demo */}
          <ClinicalFormulationDemo
            patientInfo={profileData.patientInfo}
            presentingProblem={profileData.presentingProblem}
            complexity={profileData.complexity}
            therapeuticApproaches={profileData.therapeuticApproach}
            onFormulationGenerated={(formulation, treatmentPlan) => {
              setGeneratedProfile((prev) => ({
                ...prev,
                clinicalFormulation: formulation,
                treatmentPlan: treatmentPlan,
              }))
            }}
          />

          <div className="bg-gray-50 rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">
              Generated Clinical Case
            </h3>

            {!generatedProfile ? (
              <div className="text-center py-8 text-gray-500">
                <p>
                  Configure the client profile and click &quot;Generate Comprehensive
                  Profile&quot; to see the AI-generated clinical case.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Case ID */}
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Case ID</h4>
                  <p className="text-sm bg-white p-2 rounded border">
                    {generatedProfile.caseId}
                  </p>
                </div>

                {/* Patient Summary */}
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">
                    Patient Summary
                  </h4>
                  <div className="bg-white p-3 rounded border text-sm">
                    <p>
                      <strong>Age:</strong> {generatedProfile.patientInfo?.age}
                    </p>
                    <p>
                      <strong>Gender:</strong>{' '}
                      {generatedProfile.patientInfo?.gender}
                    </p>
                    <p>
                      <strong>Occupation:</strong>{' '}
                      {generatedProfile.patientInfo?.occupation}
                    </p>
                    <p>
                      <strong>Background:</strong>{' '}
                      {generatedProfile.patientInfo?.background}
                    </p>
                  </div>
                </div>

                {/* Clinical Formulation */}
                {generatedProfile.clinicalFormulation && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">
                      Clinical Formulation
                    </h4>
                    <div className="bg-white p-3 rounded border text-sm space-y-3">
                      <div>
                        <strong>Provisional Diagnoses:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {generatedProfile.clinicalFormulation.provisionalDiagnosis.map(
                            (diagnosis) => (
                              <li key={diagnosis}>{diagnosis}</li>
                            ),
                          )}
                        </ul>
                      </div>

                      <div>
                        <strong>Contributing Factors:</strong>
                        <div className="mt-1 space-y-1">
                          <div>
                            <em>Biological:</em>{' '}
                            {generatedProfile.clinicalFormulation.contributingFactors.biological.join(
                              ', ',
                            )}
                          </div>
                          <div>
                            <em>Psychological:</em>{' '}
                            {generatedProfile.clinicalFormulation.contributingFactors.psychological.join(
                              ', ',
                            )}
                          </div>
                          <div>
                            <em>Social:</em>{' '}
                            {generatedProfile.clinicalFormulation.contributingFactors.social.join(
                              ', ',
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <strong>Summary:</strong>
                        <p className="mt-1">
                          {generatedProfile.clinicalFormulation.summary}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Treatment Plan */}
                {generatedProfile.treatmentPlan && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">
                      Treatment Plan
                    </h4>
                    <div className="bg-white p-3 rounded border text-sm space-y-3">
                      <div>
                        <strong>Goals:</strong>
                        <div className="mt-1">
                          <div>
                            <em>Short-term:</em>
                          </div>
                          <ul className="list-disc list-inside ml-4">
                            {generatedProfile.treatmentPlan.goals.shortTerm.map(
                              (goal) => (
                                <li key={goal}>{goal}</li>
                              ),
                            )}
                          </ul>
                          <div className="mt-2">
                            <em>Long-term:</em>
                          </div>
                          <ul className="list-disc list-inside ml-4">
                            {generatedProfile.treatmentPlan.goals.longTerm.map(
                              (goal) => (
                                <li key={goal}>{goal}</li>
                              ),
                            )}
                          </ul>
                        </div>
                      </div>

                      <div>
                        <strong>Interventions:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {generatedProfile.treatmentPlan.interventions.map(
                            (intervention) => (
                              <li key={intervention}>{intervention}</li>
                            ),
                          )}
                        </ul>
                      </div>

                      <div>
                        <strong>Modalities:</strong>{' '}
                        {generatedProfile.treatmentPlan.modalities.join(', ')}
                      </div>

                      <div>
                        <strong>Outcome Measures:</strong>{' '}
                        {generatedProfile.treatmentPlan.outcomeMeasures.join(
                          ', ',
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScenarioGenerationDemo

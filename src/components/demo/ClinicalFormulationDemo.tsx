import { useState } from 'react'
import type { FC } from 'react'

interface ClinicalFormulation {
  id: string
  patientId: string
  presentingProblems: string[]
  precipitatingFactors: string[]
  predisposingFactors: string[]
  perpetuatingFactors: string[]
  protectiveFactors: string[]
  hypotheses: {
    primary: string
    alternative: string[]
  }
  treatmentGoals: string[]
  interventionPlan: string[]
  riskAssessment: {
    level: 'low' | 'moderate' | 'high'
    factors: string[]
  }
  prognosis: string
  reviewDate: string
}

interface ClinicalFormulationDemoProps {
  patientData?: {
    presentingProblem: string
    demographics: {
      age: number
      gender: string
      culturalBackground: string[]
    }
    history: string[]
  }
}

const ClinicalFormulationDemo: FC<ClinicalFormulationDemoProps> = ({
  patientData,
}) => {
  const [formulation, setFormulation] = useState<ClinicalFormulation | null>(
    null,
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedApproach, setSelectedApproach] = useState<
    'cbt' | 'psychodynamic' | 'humanistic' | 'systemic'
  >('cbt')

  // Mock formulation data
  const mockFormulation: ClinicalFormulation = {
    id: 'form-001',
    patientId: 'patient-001',
    presentingProblems: [
      'Persistent low mood and loss of interest',
      'Sleep disturbances and fatigue',
      'Difficulty concentrating at work',
      'Social withdrawal from friends and family',
    ],
    precipitatingFactors: [
      'Recent job loss 3 months ago',
      'End of long-term relationship',
      'Financial stress and uncertainty',
    ],
    predisposingFactors: [
      'Family history of depression',
      'Previous episode of depression in late teens',
      'Perfectionist personality traits',
      'Limited emotional regulation skills',
    ],
    perpetuatingFactors: [
      'Negative thinking patterns and rumination',
      'Social isolation and reduced activity',
      'Poor sleep hygiene',
      'Avoidance of challenging situations',
    ],
    protectiveFactors: [
      'Strong family support system',
      'Previous successful therapy experience',
      'Good physical health',
      'Creative hobbies and interests',
      'Stable housing situation',
    ],
    hypotheses: {
      primary:
        'Major Depressive Episode triggered by multiple life stressors, maintained by cognitive patterns and behavioral withdrawal',
      alternative: [
        'Adjustment Disorder with mixed anxiety and depressed mood',
        'Persistent Depressive Disorder with acute exacerbation',
      ],
    },
    treatmentGoals: [
      'Reduce depressive symptoms to manageable levels',
      'Improve sleep quality and energy levels',
      'Develop effective coping strategies for stress',
      'Increase social engagement and activity levels',
      'Enhance emotional regulation skills',
    ],
    interventionPlan: [
      'Cognitive Behavioral Therapy (CBT) - 16-20 sessions',
      'Behavioral activation techniques',
      'Cognitive restructuring for negative thought patterns',
      'Sleep hygiene education',
      'Graded exposure to avoided activities',
      'Mindfulness and relaxation training',
    ],
    riskAssessment: {
      level: 'moderate',
      factors: [
        'History of suicidal ideation',
        'Current hopelessness',
        'Social isolation',
      ],
    },
    prognosis: 'Good with appropriate treatment engagement and support',
    reviewDate: '2024-04-01',
  }

  const generateFormulation = async () => {
    setIsGenerating(true)

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    setFormulation(mockFormulation)
    setIsGenerating(false)
  }

  const approaches = {
    cbt: 'Cognitive Behavioral Therapy',
    psychodynamic: 'Psychodynamic Therapy',
    humanistic: 'Humanistic Therapy',
    systemic: 'Systemic Therapy',
  }

  return (
    <div className='mx-auto w-full max-w-6xl space-y-6 p-6'>
      <div className='mb-8 text-center'>
        <h1 className='text-gray-900 mb-2 text-3xl font-bold'>
          Clinical Formulation Demo
        </h1>
        <p className='text-gray-600'>
          Generate comprehensive clinical formulations using AI-assisted
          analysis
        </p>
      </div>

      {/* Input Section */}
      <div className='bg-white rounded-lg border p-6 shadow-md'>
        <h2 className='text-gray-900 mb-4 text-xl font-semibold'>
          Patient Information
        </h2>

        <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
          <div>
            <h3 className='text-gray-700 mb-2 font-medium'>
              Presenting Problem
            </h3>
            <p className='text-gray-600 bg-gray-50 rounded p-3'>
              {patientData?.presentingProblem ||
                'Patient reports feeling depressed for the past 3 months, with difficulty sleeping, loss of appetite, and decreased motivation following job loss.'}
            </p>
          </div>

          <div>
            <h3 className='text-gray-700 mb-2 font-medium'>Demographics</h3>
            <div className='text-gray-600 bg-gray-50 space-y-1 rounded p-3'>
              <div>Age: {patientData?.demographics?.age || 32}</div>
              <div>Gender: {patientData?.demographics?.gender || 'Female'}</div>
              <div>
                Background:{' '}
                {patientData?.demographics?.culturalBackground?.join(', ') ||
                  'Caucasian, Urban'}
              </div>
            </div>
          </div>
        </div>

        <div className='mt-6'>
          <h3 className='text-gray-700 mb-2 font-medium'>
            Therapeutic Approach
          </h3>
          <select
            value={selectedApproach}
            onChange={(e) =>
              setSelectedApproach(e.target.value as typeof selectedApproach)
            }
            className='border-gray-300 focus:ring-blue-500 focus:border-blue-500 w-full rounded-lg border px-3 py-2 focus:ring-2 md:w-auto'
          >
            {Object.entries(approaches).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className='mt-6'>
          <button
            onClick={generateFormulation}
            disabled={isGenerating}
            className='bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg px-6 py-3 font-semibold transition-colors'
          >
            {isGenerating
              ? 'Generating Formulation...'
              : 'Generate Clinical Formulation'}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isGenerating && (
        <div className='bg-white rounded-lg border p-6 shadow-md'>
          <div className='flex items-center justify-center space-x-2'>
            <div className='border-blue-600 h-6 w-6 animate-spin rounded-full border-b-2'></div>
            <span className='text-gray-600'>
              Analyzing patient data and generating formulation...
            </span>
          </div>
        </div>
      )}

      {/* Results Section */}
      {formulation && !isGenerating && (
        <div className='space-y-6'>
          {/* Four P's Framework */}
          <div className='bg-white rounded-lg border p-6 shadow-md'>
            <h2 className='text-gray-900 mb-6 text-xl font-semibold'>
              Four P&apos;s Formulation
            </h2>

            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
              <div className='bg-red-50 border-red-200 rounded-lg border p-4'>
                <h3 className='text-red-800 mb-3 font-semibold'>
                  Precipitating Factors
                </h3>
                <ul className='text-red-700 space-y-1 text-sm'>
                  {formulation.precipitatingFactors.map((factor, index) => (
                    <li key={`precip-${index}`} className='flex items-start'>
                      <span className='mr-2'>•</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className='bg-orange-50 border-orange-200 rounded-lg border p-4'>
                <h3 className='text-orange-800 mb-3 font-semibold'>
                  Predisposing Factors
                </h3>
                <ul className='text-orange-700 space-y-1 text-sm'>
                  {formulation.predisposingFactors.map((factor, index) => (
                    <li key={`predis-${index}`} className='flex items-start'>
                      <span className='mr-2'>•</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className='bg-yellow-50 border-yellow-200 rounded-lg border p-4'>
                <h3 className='text-yellow-800 mb-3 font-semibold'>
                  Perpetuating Factors
                </h3>
                <ul className='text-yellow-700 space-y-1 text-sm'>
                  {formulation.perpetuatingFactors.map((factor, index) => (
                    <li key={`perp-${index}`} className='flex items-start'>
                      <span className='mr-2'>•</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className='bg-green-50 border-green-200 rounded-lg border p-4'>
                <h3 className='text-green-800 mb-3 font-semibold'>
                  Protective Factors
                </h3>
                <ul className='text-green-700 space-y-1 text-sm'>
                  {formulation.protectiveFactors.map((factor, index) => (
                    <li key={`prot-${index}`} className='flex items-start'>
                      <span className='mr-2'>•</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Hypotheses */}
          <div className='bg-white rounded-lg border p-6 shadow-md'>
            <h2 className='text-gray-900 mb-4 text-xl font-semibold'>
              Clinical Hypotheses
            </h2>

            <div className='space-y-4'>
              <div className='bg-blue-50 border-blue-200 rounded-lg border p-4'>
                <h3 className='text-blue-800 mb-2 font-semibold'>
                  Primary Hypothesis
                </h3>
                <p className='text-blue-700'>
                  {formulation.hypotheses.primary}
                </p>
              </div>

              <div>
                <h3 className='text-gray-800 mb-2 font-semibold'>
                  Alternative Hypotheses
                </h3>
                <ul className='space-y-1'>
                  {formulation.hypotheses.alternative.map(
                    (hypothesis, index) => (
                      <li
                        key={`alt-${index}`}
                        className='text-gray-600 flex items-start'
                      >
                        <span className='text-gray-400 mr-2'>•</span>
                        <span>{hypothesis}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Treatment Plan */}
          <div className='bg-white rounded-lg border p-6 shadow-md'>
            <h2 className='text-gray-900 mb-6 text-xl font-semibold'>
              Treatment Plan
            </h2>

            <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
              <div>
                <h3 className='text-gray-800 mb-3 font-semibold'>
                  Treatment Goals
                </h3>
                <ul className='space-y-2'>
                  {formulation.treatmentGoals.map((goal, index) => (
                    <li
                      key={`goal-${index}`}
                      className='text-gray-600 flex items-start'
                    >
                      <span className='text-green-500 mr-2 font-bold'>✓</span>
                      <span>{goal}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className='text-gray-800 mb-3 font-semibold'>
                  Intervention Plan
                </h3>
                <ul className='space-y-2'>
                  {formulation.interventionPlan.map((intervention, index) => (
                    <li
                      key={`intervention-${index}`}
                      className='text-gray-600 flex items-start'
                    >
                      <span className='text-blue-500 mr-2'>→</span>
                      <span>{intervention}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Risk Assessment */}
          <div className='bg-white rounded-lg border p-6 shadow-md'>
            <h2 className='text-gray-900 mb-4 text-xl font-semibold'>
              Risk Assessment
            </h2>

            <div className='mb-4 flex items-center space-x-4'>
              <span className='text-gray-700'>Risk Level:</span>
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  formulation.riskAssessment.level === 'high'
                    ? 'bg-red-100 text-red-800'
                    : formulation.riskAssessment.level === 'moderate'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                }`}
              >
                {formulation.riskAssessment.level.charAt(0).toUpperCase() +
                  formulation.riskAssessment.level.slice(1)}
              </span>
            </div>

            <div>
              <h3 className='text-gray-700 mb-2 font-medium'>Risk Factors:</h3>
              <ul className='space-y-1'>
                {formulation.riskAssessment.factors.map((factor, index) => (
                  <li
                    key={`risk-${index}`}
                    className='text-gray-600 flex items-start'
                  >
                    <span className='text-orange-500 mr-2'>⚠</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Prognosis */}
          <div className='bg-white rounded-lg border p-6 shadow-md'>
            <h2 className='text-gray-900 mb-4 text-xl font-semibold'>
              Prognosis & Review
            </h2>

            <div className='space-y-4'>
              <div>
                <h3 className='text-gray-700 mb-2 font-medium'>Prognosis:</h3>
                <p className='text-gray-600 bg-gray-50 rounded p-3'>
                  {formulation.prognosis}
                </p>
              </div>

              <div>
                <h3 className='text-gray-700 mb-2 font-medium'>
                  Next Review Date:
                </h3>
                <p className='text-gray-600'>
                  {new Date(formulation.reviewDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClinicalFormulationDemo

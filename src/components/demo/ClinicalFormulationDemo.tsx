import React, { useState } from 'react'

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
  patientData
}) => {
  const [formulation, setFormulation] = useState<ClinicalFormulation | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedApproach, setSelectedApproach] = useState<'cbt' | 'psychodynamic' | 'humanistic' | 'systemic'>('cbt')

  // Mock formulation data
  const mockFormulation: ClinicalFormulation = {
    id: 'form-001',
    patientId: 'patient-001',
    presentingProblems: [
      'Persistent low mood and loss of interest',
      'Sleep disturbances and fatigue',
      'Difficulty concentrating at work',
      'Social withdrawal from friends and family'
    ],
    precipitatingFactors: [
      'Recent job loss 3 months ago',
      'End of long-term relationship',
      'Financial stress and uncertainty'
    ],
    predisposingFactors: [
      'Family history of depression',
      'Previous episode of depression in late teens',
      'Perfectionist personality traits',
      'Limited emotional regulation skills'
    ],
    perpetuatingFactors: [
      'Negative thinking patterns and rumination',
      'Social isolation and reduced activity',
      'Poor sleep hygiene',
      'Avoidance of challenging situations'
    ],
    protectiveFactors: [
      'Strong family support system',
      'Previous successful therapy experience',
      'Good physical health',
      'Creative hobbies and interests',
      'Stable housing situation'
    ],
    hypotheses: {
      primary: 'Major Depressive Episode triggered by multiple life stressors, maintained by cognitive patterns and behavioral withdrawal',
      alternative: [
        'Adjustment Disorder with mixed anxiety and depressed mood',
        'Persistent Depressive Disorder with acute exacerbation'
      ]
    },
    treatmentGoals: [
      'Reduce depressive symptoms to manageable levels',
      'Improve sleep quality and energy levels',
      'Develop effective coping strategies for stress',
      'Increase social engagement and activity levels',
      'Enhance emotional regulation skills'
    ],
    interventionPlan: [
      'Cognitive Behavioral Therapy (CBT) - 16-20 sessions',
      'Behavioral activation techniques',
      'Cognitive restructuring for negative thought patterns',
      'Sleep hygiene education',
      'Graded exposure to avoided activities',
      'Mindfulness and relaxation training'
    ],
    riskAssessment: {
      level: 'moderate',
      factors: [
        'History of suicidal ideation',
        'Current hopelessness',
        'Social isolation'
      ]
    },
    prognosis: 'Good with appropriate treatment engagement and support',
    reviewDate: '2024-04-01'
  }

  const generateFormulation = async () => {
    setIsGenerating(true)
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    setFormulation(mockFormulation)
    setIsGenerating(false)
  }

  const approaches = {
    cbt: 'Cognitive Behavioral Therapy',
    psychodynamic: 'Psychodynamic Therapy',
    humanistic: 'Humanistic Therapy',
    systemic: 'Systemic Therapy'
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Clinical Formulation Demo</h1>
        <p className="text-gray-600">
          Generate comprehensive clinical formulations using AI-assisted analysis
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-lg shadow-md p-6 border">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Patient Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-700 mb-2">Presenting Problem</h3>
            <p className="text-gray-600 bg-gray-50 p-3 rounded">
              {patientData?.presentingProblem || 'Patient reports feeling depressed for the past 3 months, with difficulty sleeping, loss of appetite, and decreased motivation following job loss.'}
            </p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-700 mb-2">Demographics</h3>
            <div className="text-gray-600 bg-gray-50 p-3 rounded space-y-1">
              <div>Age: {patientData?.demographics?.age || 32}</div>
              <div>Gender: {patientData?.demographics?.gender || 'Female'}</div>
              <div>Background: {patientData?.demographics?.culturalBackground?.join(', ') || 'Caucasian, Urban'}</div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="font-medium text-gray-700 mb-2">Therapeutic Approach</h3>
          <select
            value={selectedApproach}
            onChange={(e) => setSelectedApproach(e.target.value as typeof selectedApproach)}
            className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {Object.entries(approaches).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="mt-6">
          <button
            onClick={generateFormulation}
            disabled={isGenerating}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            {isGenerating ? 'Generating Formulation...' : 'Generate Clinical Formulation'}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isGenerating && (
        <div className="bg-white rounded-lg shadow-md p-6 border">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-600">Analyzing patient data and generating formulation...</span>
          </div>
        </div>
      )}

      {/* Results Section */}
      {formulation && !isGenerating && (
        <div className="space-y-6">
          {/* Four P's Framework */}
          <div className="bg-white rounded-lg shadow-md p-6 border">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Four P&apos;s Formulation</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <h3 className="font-semibold text-red-800 mb-3">Precipitating Factors</h3>
                <ul className="space-y-1 text-sm text-red-700">
                  {formulation.precipitatingFactors.map((factor, index) => (
                    <li key={`precip-${index}`} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <h3 className="font-semibold text-orange-800 mb-3">Predisposing Factors</h3>
                <ul className="space-y-1 text-sm text-orange-700">
                  {formulation.predisposingFactors.map((factor, index) => (
                    <li key={`predis-${index}`} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <h3 className="font-semibold text-yellow-800 mb-3">Perpetuating Factors</h3>
                <ul className="space-y-1 text-sm text-yellow-700">
                  {formulation.perpetuatingFactors.map((factor, index) => (
                    <li key={`perp-${index}`} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h3 className="font-semibold text-green-800 mb-3">Protective Factors</h3>
                <ul className="space-y-1 text-sm text-green-700">
                  {formulation.protectiveFactors.map((factor, index) => (
                    <li key={`prot-${index}`} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Hypotheses */}
          <div className="bg-white rounded-lg shadow-md p-6 border">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Clinical Hypotheses</h2>
            
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-800 mb-2">Primary Hypothesis</h3>
                <p className="text-blue-700">{formulation.hypotheses.primary}</p>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Alternative Hypotheses</h3>
                <ul className="space-y-1">
                  {formulation.hypotheses.alternative.map((hypothesis, index) => (
                    <li key={`alt-${index}`} className="text-gray-600 flex items-start">
                      <span className="mr-2 text-gray-400">•</span>
                      <span>{hypothesis}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Treatment Plan */}
          <div className="bg-white rounded-lg shadow-md p-6 border">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Treatment Plan</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Treatment Goals</h3>
                <ul className="space-y-2">
                  {formulation.treatmentGoals.map((goal, index) => (
                    <li key={`goal-${index}`} className="flex items-start text-gray-600">
                      <span className="mr-2 text-green-500 font-bold">✓</span>
                      <span>{goal}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Intervention Plan</h3>
                <ul className="space-y-2">
                  {formulation.interventionPlan.map((intervention, index) => (
                    <li key={`intervention-${index}`} className="flex items-start text-gray-600">
                      <span className="mr-2 text-blue-500">→</span>
                      <span>{intervention}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="bg-white rounded-lg shadow-md p-6 border">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Risk Assessment</h2>
            
            <div className="flex items-center space-x-4 mb-4">
              <span className="text-gray-700">Risk Level:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                formulation.riskAssessment.level === 'high' ? 'bg-red-100 text-red-800' :
                formulation.riskAssessment.level === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {formulation.riskAssessment.level.charAt(0).toUpperCase() + formulation.riskAssessment.level.slice(1)}
              </span>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Risk Factors:</h3>
              <ul className="space-y-1">
                {formulation.riskAssessment.factors.map((factor, index) => (
                  <li key={`risk-${index}`} className="text-gray-600 flex items-start">
                    <span className="mr-2 text-orange-500">⚠</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Prognosis */}
          <div className="bg-white rounded-lg shadow-md p-6 border">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Prognosis & Review</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Prognosis:</h3>
                <p className="text-gray-600 bg-gray-50 p-3 rounded">{formulation.prognosis}</p>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Next Review Date:</h3>
                <p className="text-gray-600">{new Date(formulation.reviewDate).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClinicalFormulationDemo

import { useState } from 'react'

interface ScenarioType {
  id: string
  label: string
  icon: string
}

interface GeneratedScenario {
  client: {
    name: string
    age: string
    occupation: string
    presenting: string
  }
  background: string
  symptoms: string[]
  formulation: string
  treatment: string[]
}

export default function ScenarioGenerationDemo() {
  const [selectedType, setSelectedType] = useState('anxiety')
  const [isGenerating, setIsGenerating] = useState(false)
  const [scenario, setScenario] = useState<GeneratedScenario | null>(null)

  const scenarioTypes = [
    { id: 'anxiety', label: 'Anxiety Disorder', icon: '😰' },
    { id: 'depression', label: 'Depression', icon: '😔' },
    { id: 'trauma', label: 'Trauma/PTSD', icon: '💔' },
    { id: 'personality', label: 'Personality Disorder', icon: '🎭' }
  ]

  const generateScenario = async () => {
    setIsGenerating(true)
    
    // Simulate generation delay
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    const scenarios = {
      anxiety: {
        client: {
          name: 'Sarah Martinez',
          age: 28,
          occupation: 'Marketing Manager',
          presenting: 'Generalized anxiety with panic attacks'
        },
        background: 'Recent promotion at work has increased responsibilities and stress. History of perfectionism and people-pleasing behaviors.',
        symptoms: [
          'Persistent worry about work performance',
          'Physical symptoms: racing heart, sweating',
          'Avoidance of social situations',
          'Sleep disturbances'
        ],
        formulation: 'GAD with panic disorder, likely triggered by increased work stress and perfectionist tendencies',
        treatment: [
          'CBT focusing on cognitive restructuring',
          'Exposure therapy for panic responses',
          'Stress management techniques',
          'Mindfulness-based interventions'
        ]
      },
      depression: {
        client: {
          name: 'Michael Chen',
          age: 35,
          occupation: 'Software Developer',
          presenting: 'Major depressive episode'
        },
        background: 'Recent divorce and isolation from social support. History of mild depression in college.',
        symptoms: [
          'Persistent low mood for 3+ months',
          'Loss of interest in activities',
          'Fatigue and low energy',
          'Feelings of worthlessness'
        ],
        formulation: 'Major Depressive Disorder, single episode, moderate severity, precipitated by major life changes',
        treatment: [
          'Cognitive Behavioral Therapy',
          'Behavioral activation techniques',
          'Social support rebuilding',
          'Consider medication referral'
        ]
      }
    }

    setScenario(scenarios[selectedType as keyof typeof scenarios] || scenarios.anxiety)
    setIsGenerating(false)
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-6">
      <div className="space-y-6">
        {/* Scenario Type Selection */}
        <div>
          <label htmlFor="scenario-type" className="block text-sm font-medium text-slate-200 mb-3">
            Select Scenario Type
          </label>
          <div id="scenario-type" className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {scenarioTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`p-4 rounded-lg border transition-all ${
                  selectedType === type.id
                    ? 'bg-blue-600/20 border-blue-400 text-blue-200'
                    : 'bg-slate-800/50 border-slate-600 text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                <div className="text-2xl mb-2">{type.icon}</div>
                <div className="text-sm font-medium">{type.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <div className="text-center">
          <button
            onClick={generateScenario}
            disabled={isGenerating}
            className="px-8 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isGenerating ? 'Generating Scenario...' : 'Generate Clinical Scenario'}
          </button>
        </div>

        {/* Generated Scenario */}
        {scenario && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Client Profile */}
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-600/50">
              <h3 className="text-lg font-semibold text-white mb-4">Client Profile</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-orange-400 font-medium">Name & Demographics</div>
                  <div className="text-white">{scenario.client.name}, {scenario.client.age}</div>
                  <div className="text-slate-300 text-sm">{scenario.client.occupation}</div>
                </div>
                <div>
                  <div className="text-orange-400 font-medium">Presenting Concern</div>
                  <div className="text-white">{scenario.client.presenting}</div>
                </div>
                <div>
                  <div className="text-orange-400 font-medium">Background</div>
                  <div className="text-slate-300 text-sm">{scenario.background}</div>
                </div>
              </div>
            </div>

            {/* Clinical Information */}
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-600/50">
              <h3 className="text-lg font-semibold text-white mb-4">Clinical Presentation</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-green-400 font-medium mb-2">Key Symptoms</div>
                  <ul className="space-y-1">
                    {scenario.symptoms.map((symptom: string) => (
                      <li key={symptom} className="text-slate-300 text-sm flex items-start gap-2">
                        <span className="text-green-400 text-xs mt-1">•</span>
                        {symptom}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-blue-400 font-medium">Clinical Formulation</div>
                  <div className="text-slate-300 text-sm">{scenario.formulation}</div>
                </div>
              </div>
            </div>

            {/* Treatment Plan */}
            <div className="lg:col-span-2 bg-slate-800/50 rounded-lg p-6 border border-slate-600/50">
              <h3 className="text-lg font-semibold text-white mb-4">Suggested Treatment Approach</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scenario.treatment.map((treatment: string, index: number) => (
                  <div key={`treatment-${index}-${treatment.slice(0, 20)}`} className="flex items-start gap-3 p-3 bg-slate-700/30 rounded-lg">
                    <span className="text-cyan-400 font-bold text-sm">{index + 1}</span>
                    <span className="text-slate-300 text-sm">{treatment}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {isGenerating && (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-3 text-slate-300">
              <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
              Generating comprehensive clinical scenario...
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
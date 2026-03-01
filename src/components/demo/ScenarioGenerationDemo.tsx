import { useState } from 'react'

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
    { id: 'personality', label: 'Personality Disorder', icon: '🎭' },
  ]

  const generateScenario = async () => {
    setIsGenerating(true)

    // Simulate generation delay
    await new Promise((resolve) => setTimeout(resolve, 3000))

    const scenarios = {
      anxiety: {
        client: {
          name: 'Sarah Martinez',
          age: '28',
          occupation: 'Marketing Manager',
          presenting: 'Generalized anxiety with panic attacks',
        },
        background:
          'Recent promotion at work has increased responsibilities and stress. History of perfectionism and people-pleasing behaviors.',
        symptoms: [
          'Persistent worry about work performance',
          'Physical symptoms: racing heart, sweating',
          'Avoidance of social situations',
          'Sleep disturbances',
        ],
        formulation:
          'GAD with panic disorder, likely triggered by increased work stress and perfectionist tendencies',
        treatment: [
          'CBT focusing on cognitive restructuring',
          'Exposure therapy for panic responses',
          'Stress management techniques',
          'Mindfulness-based interventions',
        ],
      },
      depression: {
        client: {
          name: 'Michael Chen',
          age: '35',
          occupation: 'Software Developer',
          presenting: 'Major depressive episode',
        },
        background:
          'Recent divorce and isolation from social support. History of mild depression in college.',
        symptoms: [
          'Persistent low mood for 3+ months',
          'Loss of interest in activities',
          'Fatigue and low energy',
          'Feelings of worthlessness',
        ],
        formulation:
          'Major Depressive Disorder, single episode, moderate severity, precipitated by major life changes',
        treatment: [
          'Cognitive Behavioral Therapy',
          'Behavioral activation techniques',
          'Social support rebuilding',
          'Consider medication referral',
        ],
      },
    }

    setScenario(
      scenarios[selectedType as keyof typeof scenarios] || scenarios.anxiety,
    )
    setIsGenerating(false)
  }

  return (
    <div className='mx-auto w-full max-w-5xl p-6'>
      <div className='space-y-6'>
        {/* Scenario Type Selection */}
        <div>
          <label
            htmlFor='scenario-type'
            className='text-slate-200 mb-3 block text-sm font-medium'
          >
            Select Scenario Type
          </label>
          <div
            id='scenario-type'
            className='grid grid-cols-2 gap-3 md:grid-cols-4'
          >
            {scenarioTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`rounded-lg border p-4 transition-all ${
                  selectedType === type.id
                    ? 'bg-blue-600/20 border-blue-400 text-blue-200'
                    : 'bg-slate-800/50 border-slate-600 text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                <div className='mb-2 text-2xl'>{type.icon}</div>
                <div className='text-sm font-medium'>{type.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <div className='text-center'>
          <button
            onClick={generateScenario}
            disabled={isGenerating}
            className='bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 text-white rounded-lg px-8 py-3 font-medium transition-colors disabled:cursor-not-allowed'
          >
            {isGenerating
              ? 'Generating Scenario...'
              : 'Generate Clinical Scenario'}
          </button>
        </div>

        {/* Generated Scenario */}
        {scenario && (
          <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
            {/* Client Profile */}
            <div className='bg-slate-800/50 border-slate-600/50 rounded-lg border p-6'>
              <h3 className='text-white mb-4 text-lg font-semibold'>
                Client Profile
              </h3>
              <div className='space-y-3'>
                <div>
                  <div className='text-orange-400 font-medium'>
                    Name & Demographics
                  </div>
                  <div className='text-white'>
                    {scenario.client.name}, {scenario.client.age}
                  </div>
                  <div className='text-slate-300 text-sm'>
                    {scenario.client.occupation}
                  </div>
                </div>
                <div>
                  <div className='text-orange-400 font-medium'>
                    Presenting Concern
                  </div>
                  <div className='text-white'>{scenario.client.presenting}</div>
                </div>
                <div>
                  <div className='text-orange-400 font-medium'>Background</div>
                  <div className='text-slate-300 text-sm'>
                    {scenario.background}
                  </div>
                </div>
              </div>
            </div>

            {/* Clinical Information */}
            <div className='bg-slate-800/50 border-slate-600/50 rounded-lg border p-6'>
              <h3 className='text-white mb-4 text-lg font-semibold'>
                Clinical Presentation
              </h3>
              <div className='space-y-3'>
                <div>
                  <div className='text-green-400 mb-2 font-medium'>
                    Key Symptoms
                  </div>
                  <ul className='space-y-1'>
                    {scenario.symptoms.map((symptom: string) => (
                      <li
                        key={symptom}
                        className='text-slate-300 flex items-start gap-2 text-sm'
                      >
                        <span className='text-green-400 mt-1 text-xs'>•</span>
                        {symptom}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className='text-blue-400 font-medium'>
                    Clinical Formulation
                  </div>
                  <div className='text-slate-300 text-sm'>
                    {scenario.formulation}
                  </div>
                </div>
              </div>
            </div>

            {/* Treatment Plan */}
            <div className='bg-slate-800/50 border-slate-600/50 rounded-lg border p-6 lg:col-span-2'>
              <h3 className='text-white mb-4 text-lg font-semibold'>
                Suggested Treatment Approach
              </h3>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                {scenario.treatment.map((treatment: string, index: number) => (
                  <div
                    key={`treatment-${index}-${treatment.slice(0, 20)}`}
                    className='bg-slate-700/30 flex items-start gap-3 rounded-lg p-3'
                  >
                    <span className='text-cyan-400 text-sm font-bold'>
                      {index + 1}
                    </span>
                    <span className='text-slate-300 text-sm'>{treatment}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {isGenerating && (
          <div className='py-8 text-center'>
            <div className='text-slate-300 inline-flex items-center gap-3'>
              <div className='border-orange-400 border-t-transparent h-6 w-6 animate-spin rounded-full border-2'></div>
              Generating comprehensive clinical scenario...
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

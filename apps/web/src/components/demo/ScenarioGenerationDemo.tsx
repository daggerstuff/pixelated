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
    <div className="mx-auto w-full max-w-5xl p-6">
      <div className="space-y-6">
        {/* Scenario Type Selection */}
        <div>
          <label
            htmlFor="scenario-type"
            className="mb-3 block text-sm font-medium text-foreground"
          >
            Select Scenario Type
          </label>
          <div
            id="scenario-type"
            className="grid grid-cols-2 gap-3 md:grid-cols-4"
          >
            {scenarioTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`rounded-none border p-4 transition-all ${
                  selectedType === type.id
                    ? 'border-ring bg-secondary font-medium text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-secondary'
                }`}
              >
                <div className="mb-2 text-2xl">{type.icon}</div>
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
            className="hover:bg-primary/90 rounded-none bg-primary px-8 py-3 font-medium text-primary-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-35"
          >
            {isGenerating
              ? 'Generating Scenario...'
              : 'Generate Clinical Scenario'}
          </button>
        </div>

        {/* Generated Scenario */}
        {scenario && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Client Profile */}
            <div className="rounded-none border border-border bg-card p-6">
              <h3 className="mb-4 text-lg font-semibold text-foreground">
                Client Profile
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="font-medium text-foreground">
                    Name & Demographics
                  </div>
                  <div className="text-foreground">
                    {scenario.client.name}, {scenario.client.age}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {scenario.client.occupation}
                  </div>
                </div>
                <div>
                  <div className="font-medium text-foreground">
                    Presenting Concern
                  </div>
                  <div className="text-foreground">
                    {scenario.client.presenting}
                  </div>
                </div>
                <div>
                  <div className="font-medium text-foreground">Background</div>
                  <div className="text-sm text-muted-foreground">
                    {scenario.background}
                  </div>
                </div>
              </div>
            </div>

            {/* Clinical Information */}
            <div className="rounded-none border border-border bg-card p-6">
              <h3 className="mb-4 text-lg font-semibold text-foreground">
                Clinical Presentation
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="mb-2 font-medium text-foreground">
                    Key Symptoms
                  </div>
                  <ul className="space-y-1">
                    {scenario.symptoms.map((symptom: string) => (
                      <li
                        key={symptom}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <span className="mt-1 text-xs text-muted-foreground">
                          •
                        </span>
                        {symptom}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-medium text-foreground">
                    Clinical Formulation
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {scenario.formulation}
                  </div>
                </div>
              </div>
            </div>

            {/* Treatment Plan */}
            <div className="rounded-none border border-border bg-card p-6 lg:col-span-2">
              <h3 className="mb-4 text-lg font-semibold text-foreground">
                Suggested Treatment Approach
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {scenario.treatment.map((treatment: string, index: number) => (
                  <div
                    key={`treatment-${index}-${treatment.slice(0, 20)}`}
                    className="flex items-start gap-3 rounded-none bg-secondary p-3"
                  >
                    <span className="text-sm font-bold text-foreground">
                      {index + 1}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {treatment}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {isGenerating && (
          <div className="py-8 text-center">
            <div className="inline-flex items-center gap-3 text-muted-foreground">
              <div className="border-t-transparent h-6 w-6 animate-spin rounded-full border-2 border-ring"></div>
              Generating comprehensive clinical scenario...
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

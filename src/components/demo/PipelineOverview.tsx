import { useState } from 'react'

export default function PipelineOverview() {
  const [activeStep, setActiveStep] = useState(0)

  const steps = [
    {
      title: 'Data Ingestion',
      description: 'Process clinical content and psychological resources',
      icon: '📥',
      details: 'Handles text, PDFs, research papers, and clinical notes',
    },
    {
      title: 'Entity Extraction',
      description:
        'Identify mental health conditions, treatments, and risk factors',
      icon: '🔍',
      details: 'NLP-powered recognition of clinical entities and concepts',
    },
    {
      title: 'Analysis Engine',
      description: 'Apply therapeutic frameworks and diagnostic criteria',
      icon: '🧠',
      details: 'AI-powered analysis using evidence-based methodologies',
    },
    {
      title: 'Scenario Generation',
      description: 'Create training scenarios and treatment recommendations',
      icon: '📋',
      details: 'Generate realistic client cases and therapeutic interventions',
    },
  ]

  return (
    <div className='mx-auto w-full max-w-4xl p-6'>
      <div className='flex flex-col gap-6 md:flex-row'>
        {/* Pipeline Steps */}
        <div className='flex-1'>
          <div className='mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
            {steps.map((step, index) => (
              <button
                key={step.title}
                type='button'
                className={`cursor-pointer rounded-lg p-4 text-left transition-all ${
                  activeStep === index
                    ? 'bg-blue-600/20 border-blue-400 border-2'
                    : 'bg-slate-700/50 border-slate-600/50 hover:bg-slate-600/50 border'
                }`}
                onClick={() => setActiveStep(index)}
                aria-pressed={activeStep === index}
              >
                <div className='mb-2 text-2xl'>{step.icon}</div>
                <h3 className='text-white mb-1 text-sm font-semibold'>
                  {step.title}
                </h3>
                <p className='text-slate-300 text-xs'>{step.description}</p>
              </button>
            ))}
          </div>

          {/* Active Step Details */}
          <div className='bg-slate-800/50 border-slate-600/50 rounded-lg border p-6'>
            <div className='mb-4 flex items-center gap-3'>
              <span className='text-3xl'>{steps[activeStep]?.icon}</span>
              <div>
                <h3 className='text-white text-xl font-semibold'>
                  {steps[activeStep]?.title}
                </h3>
                <p className='text-slate-300'>
                  {steps[activeStep]?.description}
                </p>
              </div>
            </div>
            <p className='text-slate-400'>{steps[activeStep]?.details}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

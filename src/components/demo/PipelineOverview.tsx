import { useState } from 'react'

export default function PipelineOverview() {
  const [activeStep, setActiveStep] = useState(0)

  const steps = [
    {
      title: 'Data Ingestion',
      description: 'Process clinical content and psychological resources',
      icon: '📥',
      details: 'Handles text, PDFs, research papers, and clinical notes'
    },
    {
      title: 'Entity Extraction',
      description: 'Identify mental health conditions, treatments, and risk factors',
      icon: '🔍',
      details: 'NLP-powered recognition of clinical entities and concepts'
    },
    {
      title: 'Analysis Engine',
      description: 'Apply therapeutic frameworks and diagnostic criteria',
      icon: '🧠',
      details: 'AI-powered analysis using evidence-based methodologies'
    },
    {
      title: 'Scenario Generation',
      description: 'Create training scenarios and treatment recommendations',
      icon: '📋',
      details: 'Generate realistic client cases and therapeutic interventions'
    }
  ]

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Pipeline Steps */}
        <div className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg cursor-pointer transition-all ${
                  activeStep === index
                    ? 'bg-blue-600/20 border-2 border-blue-400'
                    : 'bg-slate-700/50 border border-slate-600/50 hover:bg-slate-600/50'
                }`}
                onClick={() => setActiveStep(index)}
              >
                <div className="text-2xl mb-2">{step.icon}</div>
                <h3 className="font-semibold text-white text-sm mb-1">{step.title}</h3>
                <p className="text-xs text-slate-300">{step.description}</p>
              </div>
            ))}
          </div>

          {/* Active Step Details */}
          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-600/50">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{steps[activeStep].icon}</span>
              <div>
                <h3 className="text-xl font-semibold text-white">{steps[activeStep].title}</h3>
                <p className="text-slate-300">{steps[activeStep].description}</p>
              </div>
            </div>
            <p className="text-slate-400">{steps[activeStep].details}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
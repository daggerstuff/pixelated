import { useState } from 'react'

export default function KnowledgeParsingDemo() {
  const [inputText, setInputText] = useState('Patient presents with symptoms of anxiety and depression following recent job loss. Reports difficulty sleeping and decreased appetite.')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<any>(null)

  const analyze = async () => {
    setIsAnalyzing(true)
    
    // Simulate analysis delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    setResults({
      entities: [
        { text: 'anxiety', type: 'Mental Health Condition', confidence: 0.95 },
        { text: 'depression', type: 'Mental Health Condition', confidence: 0.92 },
        { text: 'job loss', type: 'Life Event', confidence: 0.88 },
        { text: 'sleeping difficulty', type: 'Symptom', confidence: 0.91 },
        { text: 'decreased appetite', type: 'Symptom', confidence: 0.89 }
      ],
      concepts: [
        { concept: 'Adjustment Disorder', relevance: 0.87 },
        { concept: 'Major Depressive Episode', relevance: 0.82 },
        { concept: 'Generalized Anxiety', relevance: 0.79 }
      ],
      riskFactors: [
        { factor: 'Recent major life change', severity: 'Moderate' },
        { factor: 'Sleep disturbance', severity: 'Moderate' },
        { factor: 'Appetite changes', severity: 'Low' }
      ]
    })
    
    setIsAnalyzing(false)
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="space-y-6">
        {/* Input Section */}
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-2">
            Clinical Text to Analyze
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full h-32 p-4 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            placeholder="Enter clinical notes, therapy session transcript, or patient description..."
          />
          <button
            onClick={analyze}
            disabled={isAnalyzing || !inputText.trim()}
            className="mt-3 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Clinical Content'}
          </button>
        </div>

        {/* Results Section */}
        {results && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Entities */}
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-600/50">
              <h3 className="text-lg font-semibold text-white mb-4">Extracted Entities</h3>
              <div className="space-y-3">
                {results.entities.map((entity: any, index: number) => (
                  <div key={index} className="flex justify-between items-center">
                    <div>
                      <div className="text-white font-medium">{entity.text}</div>
                      <div className="text-xs text-slate-400">{entity.type}</div>
                    </div>
                    <div className="text-green-400 font-mono text-sm">
                      {(entity.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Concepts */}
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-600/50">
              <h3 className="text-lg font-semibold text-white mb-4">Clinical Concepts</h3>
              <div className="space-y-3">
                {results.concepts.map((concept: any, index: number) => (
                  <div key={index} className="flex justify-between items-center">
                    <div className="text-white">{concept.concept}</div>
                    <div className="text-orange-400 font-mono text-sm">
                      {(concept.relevance * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Factors */}
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-600/50">
              <h3 className="text-lg font-semibold text-white mb-4">Risk Assessment</h3>
              <div className="space-y-3">
                {results.riskFactors.map((risk: any, index: number) => (
                  <div key={index}>
                    <div className="text-white font-medium">{risk.factor}</div>
                    <div className={`text-xs ${
                      risk.severity === 'High' ? 'text-red-400' :
                      risk.severity === 'Moderate' ? 'text-yellow-400' :
                      'text-green-400'
                    }`}>
                      {risk.severity} Risk
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {isAnalyzing && (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-3 text-slate-300">
              <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              Analyzing clinical content...
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
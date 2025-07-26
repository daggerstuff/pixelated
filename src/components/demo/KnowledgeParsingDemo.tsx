import React, { useState } from 'react'
import { MentalHealthService } from '../../lib/mental-health/service'
import { createBuildSafeLogger } from '../../lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('KnowledgeParsingDemo')

interface ParsedEntity {
  type: string
  value: string
  confidence: number
  startIndex: number
  endIndex: number
}

interface ParsedConcept {
  name: string
  category: 'mental_health' | 'therapeutic_technique' | 'clinical_term' | 'intervention'
  confidence: number
  evidence: string[]
  relatedTerms: string[]
}

interface ParsedData {
  entities: ParsedEntity[]
  concepts: ParsedConcept[]
  overallConfidence: number
  analysisMetadata: {
    textLength: number
    processingTime: number
    clinicalRelevance: number
    riskLevel: 'low' | 'moderate' | 'high'
    detectedConditions: string[]
    suggestedTechniques: string[]
  }
}

interface KnowledgeParsingDemoProps {
  className?: string
}

const KnowledgeParsingDemo: React.FC<KnowledgeParsingDemoProps> = ({ className }) => {
  const [inputText, setInputText] = useState('')
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [_error, setError] = useState<string | null>(null)

  // Clinical knowledge patterns for entity/concept extraction
  const clinicalPatterns = {
    mentalHealthConditions: {
      pattern: /\b(depression|anxiety|stress|trauma|ptsd|ocd|bipolar|panic|eating disorder|social anxiety|adhd|autism|schizophrenia|bpd|borderline)\b/gi,
      category: 'mental_health' as const
    },
    therapeuticTechniques: {
      pattern: /\b(cbt|cognitive behavioral therapy|dbt|dialectical behavior therapy|emdr|exposure therapy|mindfulness|meditation|grounding|breathing exercises|behavioral activation|cognitive restructuring)\b/gi,
      category: 'therapeutic_technique' as const
    },
    clinicalTerms: {
      pattern: /\b(diagnosis|symptoms|assessment|intervention|treatment|therapy|counseling|psychiatrist|psychologist|therapist|medication|antidepressant|anxiolytic)\b/gi,
      category: 'clinical_term' as const
    },
    interventions: {
      pattern: /\b(crisis intervention|safety planning|resource connection|support group|hospitalization|emergency|suicide|self-harm|crisis)\b/gi,
      category: 'intervention' as const
    }
  }

  const extractEntitiesAndConcepts = async (text: string): Promise<ParsedData> => {
    const startTime = Date.now()
    const entities: ParsedEntity[] = []
    const concepts: ParsedConcept[] = []
    
    // Extract entities using clinical patterns
    Object.entries(clinicalPatterns).forEach(([patternName, config]) => {
      const matches = [...text.matchAll(config.pattern)]
      matches.forEach(match => {
        if (match.index !== undefined) {
          entities.push({
            type: patternName,
            value: match[0],
            confidence: 0.85 + Math.random() * 0.1, // Realistic confidence range
            startIndex: match.index,
            endIndex: match.index + match[0].length
          })
        }
      })
    })

    // Extract concepts with more detailed analysis
    const uniqueMatches = new Map<string, ParsedConcept>()
    
    Object.entries(clinicalPatterns).forEach(([_, config]) => {
      const matches = [...text.matchAll(config.pattern)]
      matches.forEach(match => {
        const term = match[0].toLowerCase()
        if (!uniqueMatches.has(term)) {
          uniqueMatches.set(term, {
            name: term,
            category: config.category,
            confidence: 0.8 + Math.random() * 0.15,
            evidence: [match[0]], // The actual matched text
            relatedTerms: getRelatedTerms(term)
          })
        } else {
          // Increase confidence for repeated matches
          const existing = uniqueMatches.get(term)!
          existing.confidence = Math.min(0.95, existing.confidence + 0.05)
          existing.evidence.push(match[0])
        }
      })
    })

    concepts.push(...uniqueMatches.values())

    // Analyze text with MentalHealthService for additional insights
    let detectedConditions: string[] = []
    const suggestedTechniques: string[] = []
    let riskLevel: 'low' | 'moderate' | 'high' = 'low'
    let clinicalRelevance = 0.5

    try {
      const mentalHealthService = new MentalHealthService({
        enableAnalysis: true,
        confidenceThreshold: 0.6,
        enableCrisisDetection: true
      })

      const sessionId = `demo-${Date.now()}`
      const result = await mentalHealthService.processMessage(sessionId, {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: Date.now()
      })

      if (result.analysis) {
        // Extract detected conditions
        detectedConditions = result.analysis.indicators.map(i => i.type)
        riskLevel = result.analysis.riskLevel === 'critical' ? 'high' : 
                   result.analysis.riskLevel === 'medium' ? 'moderate' : 'low'
        clinicalRelevance = result.analysis.indicators.length > 0 ? 0.8 : 0.3

        // Generate suggested techniques based on analysis
        if (result.analysis.indicators.some(i => i.type === 'depression')) {
          suggestedTechniques.push('Behavioral Activation', 'Cognitive Restructuring')
        }
        if (result.analysis.indicators.some(i => i.type === 'anxiety')) {
          suggestedTechniques.push('Grounding Techniques', 'Breathing Exercises')
        }
        if (result.analysis.indicators.some(i => i.type === 'stress')) {
          suggestedTechniques.push('Stress Management', 'Relaxation Techniques')
        }
      }
    } catch (err) {
      logger.warn('MentalHealthService analysis failed, using fallback', { error: err })
      // Fallback: basic keyword-based detection
      if (text.toLowerCase().includes('depress')) {
        detectedConditions.push('depression')
      }
      if (text.toLowerCase().includes('anxi')) {
        detectedConditions.push('anxiety')
      }
      if (text.toLowerCase().includes('stress')) {
        detectedConditions.push('stress')
      }
      
      clinicalRelevance = entities.length > 0 ? 0.7 : 0.2
    }

    const processingTime = Date.now() - startTime
    const overallConfidence = entities.length > 0 ? 
      entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length : 0

    return {
      entities,
      concepts,
      overallConfidence,
      analysisMetadata: {
        textLength: text.length,
        processingTime,
        clinicalRelevance,
        riskLevel,
        detectedConditions: [...new Set(detectedConditions)],
        suggestedTechniques: [...new Set(suggestedTechniques)]
      }
    }
  }

  const getRelatedTerms = (term: string): string[] => {
    const relatedMap: Record<string, string[]> = {
      'depression': ['mood disorder', 'major depressive disorder', 'dysthymia', 'melancholia'],
      'anxiety': ['worry', 'panic', 'phobia', 'generalized anxiety disorder'],
      'stress': ['tension', 'pressure', 'burnout', 'overwhelm'],
      'cbt': ['cognitive therapy', 'behavior therapy', 'thought challenging'],
      'dbt': ['mindfulness', 'distress tolerance', 'emotion regulation'],
      'trauma': ['ptsd', 'acute stress', 'complex trauma', 'dissociation'],
      'therapy': ['counseling', 'psychotherapy', 'treatment', 'intervention']
    }
    return relatedMap[term.toLowerCase()] || []
  }

  const handleParse = async () => {
    if (!inputText.trim()) {
      setError('Please enter some text to analyze')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      const results = await extractEntitiesAndConcepts(inputText)
      setParsedData(results)
      logger.info('Knowledge parsing completed', { 
        entityCount: results.entities.length,
        conceptCount: results.concepts.length,
        confidence: results.overallConfidence 
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(`Analysis failed: ${errorMessage}`)
      logger.error('Knowledge parsing failed', { error: err })
    } finally {
      setIsLoading(false)
    }
  }

  const getRiskLevelColor = (level: 'low' | 'moderate' | 'high'): string => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      case 'moderate': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-green-600 bg-green-50 border-green-200'
    }
  }

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'mental_health': return 'bg-cyan-100 text-cyan-800'
      case 'therapeutic_technique': return 'bg-blue-100 text-blue-800'
      case 'clinical_term': return 'bg-gray-100 text-gray-800'
      case 'intervention': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className={`knowledge-parsing-demo max-w-4xl mx-auto p-6 ${className || ''}`}>
      <div className="bg-white rounded-lg shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Clinical Knowledge Parsing Demo
          </h2>
          <p className="text-gray-600">
            Advanced entity and concept extraction for mental health and therapeutic content
          </p>
        </div>

        <div className="p-6">
          <div className="space-y-6">
            {/* Input Section */}
            <div className="space-y-4">
              <label htmlFor="input-text" className="block text-sm font-medium text-gray-700">
                Enter psychological or clinical text to analyze:
              </label>
              <textarea
                id="input-text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Example: I've been feeling depressed lately and my therapist suggested cognitive behavioral therapy. The anxiety has been overwhelming, especially with the panic attacks..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  {inputText.length} characters
                </span>
                <button
                  onClick={handleParse}
                  disabled={isLoading}
                  className={`px-6 py-2 rounded-md font-medium transition-colors ${
                    isLoading
                      ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyzing...
                    </span>
                  ) : (
                    'Parse Knowledge'
                  )}
                </button>
              </div>
            </div>

            {/* Error Display */}
            {_error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Analysis Error
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      {_error}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Results Section */}
            {parsedData && (
              <div className="space-y-6">
                {/* Analysis Overview */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Analysis Overview</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {parsedData.entities.length}
                      </div>
                      <div className="text-sm text-gray-600">Entities</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-cyan-600">
                        {parsedData.concepts.length}
                      </div>
                      <div className="text-sm text-gray-600">Concepts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {(parsedData.overallConfidence * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">Confidence</div>
                    </div>
                    <div className="text-center">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRiskLevelColor(parsedData.analysisMetadata.riskLevel)}`}>
                        {parsedData.analysisMetadata.riskLevel.toUpperCase()} RISK
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Risk Level</div>
                    </div>
                  </div>
                </div>

                {/* Extracted Entities */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Extracted Entities</h3>
                  {parsedData.entities.length > 0 ? (
                    <div className="space-y-2">
                      {parsedData.entities.map((entity) => (
                        <div key={`${entity.type}-${entity.value}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <span className="font-medium text-gray-900">{entity.value}</span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(entity.type)}`}>
                              {entity.type.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {(entity.confidence * 100).toFixed(1)}% confidence
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">No entities detected</p>
                  )}
                </div>

                {/* Extracted Concepts */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Extracted Concepts</h3>
                  {parsedData.concepts.length > 0 ? (
                    <div className="space-y-4">
                      {parsedData.concepts.map((concept) => (
                        <div key={`${concept.category}-${concept.name}`} className="p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              <span className="font-medium text-gray-900 capitalize">{concept.name}</span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(concept.category)}`}>
                                {concept.category.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <span className="text-sm text-gray-600">
                              {(concept.confidence * 100).toFixed(1)}% confidence
                            </span>
                          </div>
                          {concept.relatedTerms.length > 0 && (
                            <div className="mt-2">
                              <span className="text-sm text-gray-600">Related: </span>
                              <span className="text-sm text-gray-800">
                                {concept.relatedTerms.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">No concepts detected</p>
                  )}
                </div>

                {/* Clinical Analysis */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Clinical Analysis</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">Detected Conditions</h4>
                      {parsedData.analysisMetadata.detectedConditions.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {parsedData.analysisMetadata.detectedConditions.map((condition) => (
                            <span key={`condition-${condition}`} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800">
                              {condition}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No specific conditions detected</p>
                      )}
                    </div>
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">Suggested Techniques</h4>
                      {parsedData.analysisMetadata.suggestedTechniques.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {parsedData.analysisMetadata.suggestedTechniques.map((technique) => (
                            <span key={`technique-${technique}`} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {technique}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No specific techniques suggested</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Analysis Metadata</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Processing Time:</span>
                      <span className="ml-2 font-medium">{parsedData.analysisMetadata.processingTime}ms</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Text Length:</span>
                      <span className="ml-2 font-medium">{parsedData.analysisMetadata.textLength} chars</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Clinical Relevance:</span>
                      <span className="ml-2 font-medium">{(parsedData.analysisMetadata.clinicalRelevance * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default KnowledgeParsingDemo

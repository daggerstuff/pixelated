import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Loader2, 
  Brain, 
  FileText, 
  Tag, 
  TrendingUp, 
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Download,
  Share2,
  History
} from 'lucide-react'
import { apiClient } from '@/lib/api-client'

interface Entity {
  text: string
  type: string
  confidence: number
}

interface Concept {
  concept: string
  relevance: number
}

interface RiskFactor {
  factor: string
  severity: 'High' | 'Moderate' | 'Low'
}

interface AnalysisResults {
  entities: Entity[]
  concepts: Concept[]
  riskFactors: RiskFactor[]
  metadata?: {
    processingTime: number
    wordCount: number
    sentenceCount: number
    complexity: number
    readabilityScore: number
  }
}

interface AnalysisHistory {
  id: string
  text: string
  result: AnalysisResults
  timestamp: number
  processingTime: number
}

export default function KnowledgeParsingDemo() {
  const [inputText, setInputText] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<AnalysisResults | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistory[]>([])
  const [processingTime, setProcessingTime] = useState<number | null>(null)
  const [isRealTimeMode, setIsRealTimeMode] = useState(false)
  const [confidence, setConfidence] = useState<number>(0)
  const realTimeTimeout = useRef<NodeJS.Timeout | null>(null)

  // Real-time analysis with debouncing
  useEffect(() => {
    if (isRealTimeMode && inputText.trim().length > 10) {
      if (realTimeTimeout.current) {
        clearTimeout(realTimeTimeout.current)
      }
      realTimeTimeout.current = setTimeout(() => {
        analyze()
      }, 1500)
    }
    return () => {
      if (realTimeTimeout.current) {
        clearTimeout(realTimeTimeout.current)
      }
    }
  }, [inputText, isRealTimeMode])

  // Load analysis history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('knowledgeParsingHistory')
    if (savedHistory) {
      setAnalysisHistory(JSON.parse(savedHistory))
    }
  }, [])

  // Save to history
  const saveToHistory = (text: string, result: AnalysisResults, processingTime: number) => {
    const historyItem: AnalysisHistory = {
      id: Date.now().toString(),
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      result,
      timestamp: Date.now(),
      processingTime
    }
    const newHistory = [historyItem, ...analysisHistory.slice(0, 9)] // Keep last 10
    setAnalysisHistory(newHistory)
    localStorage.setItem('knowledgeParsingHistory', JSON.stringify(newHistory))
  }

  const analyze = async () => {
    if (!inputText.trim()) {
      setError('Please enter some text to analyze')
      return
    }

    setIsAnalyzing(true)
    setResults(null)
    setError(null)
    setProcessingTime(null)
    const startTime = Date.now()

    try {
      // Use the enhanced API client with retry logic
      const response = await apiClient.post('/api/psychology/parse', {
        content: inputText,
        options: {
          extractEntities: true,
          analyzeConcepts: true,
          assessRisk: true,
          identifyFrameworks: true,
          includeConfidence: true,
          includeSuggestions: true,
          includeMetadata: true
        }
      })

      const endTime = Date.now()
      const requestTime = endTime - startTime
      setProcessingTime(requestTime)

      // Enhanced result processing with metadata
      const enhancedResults: AnalysisResults = {
        ...response,
        metadata: {
          processingTime: requestTime,
          wordCount: inputText.split(/\s+/).length,
          sentenceCount: inputText.split(/[.!?]+/).length - 1,
          complexity: Math.min(100, inputText.split(/\s+/).length / 10 * 15),
          readabilityScore: Math.max(0, 100 - inputText.split(/\s+/).length / 20 * 10)
        }
      }

      setResults(enhancedResults)
      
      // Calculate overall confidence
      const avgConfidence = enhancedResults.entities.reduce((acc, entity) => acc + entity.confidence, 0) / enhancedResults.entities.length || 0
      setConfidence(avgConfidence * 100)

      // Save to history
      saveToHistory(inputText, enhancedResults, requestTime)

    } catch (err) {
      console.error('Analysis failed:', err)
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const apiResults = await response.json()

      // Transform API response to match our demo interface
      const transformedResults: AnalysisResults = {
        entities: apiResults.entities.map((entity: any) => ({
          text: entity.text,
          type: entity.type,
          confidence: entity.confidence
        })),
        concepts: apiResults.concepts.map((concept: any) => ({
          concept: concept.name,
          relevance: concept.relevance
        })),
        riskFactors: apiResults.riskFactors.map((risk: any) => ({
          factor: risk.factor,
          severity: risk.severity
        }))
      }

      // Simulate processing time for smooth UX
      setTimeout(() => {
        setResults(transformedResults)
        setIsAnalyzing(false)
      }, 1000)

    } catch (error) {
      console.error('Analysis failed:', error)
      
      // Fallback to demo data on API failure
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
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="space-y-6">
        {/* Input Section */}
        <div>
          <label htmlFor="clinical-text" className="block text-sm font-medium text-slate-200 mb-2">
            Clinical Text to Analyze
          </label>
          <textarea
            id="clinical-text"
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
                {results.entities.map((entity: Entity) => (
                  <div key={`${entity.text}-${entity.type}`} className="flex justify-between items-center">
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
                {results.concepts.map((concept: Concept) => (
                  <div key={concept.concept} className="flex justify-between items-center">
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
                {results.riskFactors.map((risk: RiskFactor) => (
                  <div key={risk.factor}>
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
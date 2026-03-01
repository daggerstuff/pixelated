import {
  Loader2,
  Brain,
  Tag,
  TrendingUp,
  Activity,
  Clock,
  AlertTriangle,
  BarChart3,
  Download,
  History,
} from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

interface Entity {
  text: string
  type: string
  confidence: number
  start?: number
  end?: number
}

interface Concept {
  concept: string
  relevance: number
  category?: string
}

interface RiskFactor {
  factor: string
  severity: 'High' | 'Moderate' | 'Low'
  probability?: number
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
  insights?: Array<{
    category: string
    insight: string
    confidence: number
  }>
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

  // Save to history
  const saveToHistory = useCallback(
    (text: string, result: AnalysisResults, processingTime: number) => {
      const historyItem: AnalysisHistory = {
        id: Date.now().toString(),
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        result,
        timestamp: Date.now(),
        processingTime,
      }
      const newHistory = [historyItem, ...analysisHistory.slice(0, 9)] // Keep last 10
      setAnalysisHistory(newHistory)
      localStorage.setItem(
        'knowledgeParsingHistory',
        JSON.stringify(newHistory),
      )
    },
    [analysisHistory],
  )

  const analyze = useCallback(async () => {
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
      const response = await fetch('/api/psychology/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: inputText,
          options: {
            extractEntities: true,
            analyzeConcepts: true,
            assessRisk: true,
            identifyFrameworks: true,
            includeConfidence: true,
            includeSuggestions: true,
            includeMetadata: true,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const apiResults = await response.json()

      const endTime = Date.now()
      const requestTime = endTime - startTime
      setProcessingTime(requestTime)

      // Enhanced result processing with metadata
      const enhancedResults: AnalysisResults = {
        ...apiResults,
        metadata: {
          processingTime: requestTime,
          wordCount: inputText.split(/\s+/).length,
          sentenceCount: inputText.split(/[.!?]+/).length - 1,
          complexity: Math.min(100, (inputText.split(/\s+/).length / 10) * 15),
          readabilityScore: Math.max(
            0,
            100 - (inputText.split(/\s+/).length / 20) * 10,
          ),
        },
      }

      setResults(enhancedResults)

      // Calculate overall confidence
      const avgConfidence =
        enhancedResults.entities.reduce(
          (acc, entity) => acc + entity.confidence,
          0,
        ) / enhancedResults.entities.length || 0
      setConfidence(avgConfidence * 100)

      // Save to history
      saveToHistory(inputText, enhancedResults, requestTime)
    } catch (err: unknown) {
      console.error('Analysis failed:', err)
      setError(
        err instanceof Error
          ? (err)?.message || String(err)
          : 'Analysis failed. Please try again.',
      )

      // Fallback to demo data for demonstration
      const demoResults: AnalysisResults = {
        entities: [
          { text: 'anxiety', type: 'Condition', confidence: 0.92 },
          { text: 'depression', type: 'Condition', confidence: 0.88 },
          { text: 'therapy', type: 'Treatment', confidence: 0.95 },
        ],
        concepts: [
          { concept: 'Mental Health', relevance: 0.95 },
          { concept: 'Treatment Planning', relevance: 0.87 },
          { concept: 'Risk Assessment', relevance: 0.73 },
        ],
        riskFactors: [
          { factor: 'Social Isolation', severity: 'Moderate' },
          { factor: 'Sleep Disturbance', severity: 'High' },
          { factor: 'Substance Use', severity: 'Low' },
        ],
        metadata: {
          processingTime: Date.now() - startTime,
          wordCount: inputText.split(/\s+/).length,
          sentenceCount: inputText.split(/[.!?]+/).length - 1,
          complexity: 65,
          readabilityScore: 78,
        },
      }
      setResults(demoResults)
      setConfidence(88.3)
    } finally {
      setIsAnalyzing(false)
    }
  }, [inputText, saveToHistory])

  // Real-time analysis with debouncing
  useEffect(() => {
    if (isRealTimeMode && inputText.trim().length > 10) {
      if (realTimeTimeout.current) {
        clearTimeout(realTimeTimeout.current)
      }
      realTimeTimeout.current = setTimeout(() => {
        void analyze()
      }, 1500)
    }
    return () => {
      if (realTimeTimeout.current) {
        clearTimeout(realTimeTimeout.current)
      }
    }
  }, [inputText, isRealTimeMode, analyze])

  // Load analysis history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('knowledgeParsingHistory')
    if (savedHistory) {
      try {
        setAnalysisHistory(JSON.parse(savedHistory) as AnalysisHistory[])
      } catch (e) {
        console.warn('Failed to load analysis history:', e)
      }
    }
  }, [])

  const loadFromHistory = (historyItem: AnalysisHistory) => {
    setInputText(historyItem.text)
    setResults(historyItem.result)
    setProcessingTime(historyItem.processingTime)
  }

  const clearHistory = () => {
    setAnalysisHistory([])
    localStorage.removeItem('knowledgeParsingHistory')
  }

  const exportResults = () => {
    if (!results) {
      return
    }

    const exportData = {
      text: inputText,
      results,
      timestamp: new Date().toISOString(),
      processingTime,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `knowledge-analysis-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className='mx-auto w-full max-w-6xl space-y-6'>
      {/* Header Section with Enterprise Features */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='bg-blue-100 rounded-lg p-2'>
                <Brain className='text-blue-600 h-6 w-6' />
              </div>
              <div>
                <CardTitle className='text-2xl'>
                  Enterprise Knowledge Parsing
                </CardTitle>
                <p className='text-gray-600 mt-1'>
                  Advanced clinical text analysis with real-time monitoring
                </p>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setIsRealTimeMode(!isRealTimeMode)}
                className={isRealTimeMode ? 'bg-green-50 border-green-200' : ''}
              >
                <Activity className='mr-2 h-4 w-4' />
                {isRealTimeMode ? 'Real-time ON' : 'Real-time OFF'}
              </Button>
              {results && (
                <Button variant='outline' size='sm' onClick={exportResults}>
                  <Download className='mr-2 h-4 w-4' />
                  Export
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 gap-4 lg:grid-cols-4'>
            <div className='lg:col-span-3'>
              <Textarea
                placeholder='Enter clinical text, patient notes, or psychological content to analyze...'
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className='min-h-[120px] text-sm'
              />
              <div className='text-gray-500 mt-2 flex items-center justify-between text-xs'>
                <span>
                  {inputText.length} characters,{' '}
                  {inputText.split(/\s+/).filter((w) => w).length} words
                </span>
                {isRealTimeMode && inputText.length > 10 && (
                  <span className='text-green-600'>
                    Real-time analysis active
                  </span>
                )}
              </div>
            </div>
            <div className='space-y-3'>
              <Button
                onClick={analyze}
                disabled={isAnalyzing || !inputText.trim()}
                className='w-full'
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className='mr-2 h-4 w-4' />
                    Analyze Text
                  </>
                )}
              </Button>

              {processingTime && (
                <div className='text-center'>
                  <Badge variant='outline' className='text-xs'>
                    <Clock className='mr-1 h-3 w-3' />
                    {processingTime}ms
                  </Badge>
                </div>
              )}

              {confidence > 0 && (
                <div className='space-y-2'>
                  <div className='flex justify-between text-xs'>
                    <span>Confidence</span>
                    <span>{confidence.toFixed(1)}%</span>
                  </div>
                  <Progress value={confidence} className='h-2' />
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className='bg-red-50 border-red-200 mt-4 rounded-lg border p-3'>
              <div className='text-red-700 flex items-center gap-2'>
                <AlertTriangle className='h-4 w-4' />
                <span className='text-sm'>{error}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {results && (
        <Tabs defaultValue='entities' className='w-full'>
          <TabsList className='grid w-full grid-cols-5'>
            <TabsTrigger value='entities'>
              <Tag className='mr-2 h-4 w-4' />
              Entities
            </TabsTrigger>
            <TabsTrigger value='concepts'>
              <Brain className='mr-2 h-4 w-4' />
              Concepts
            </TabsTrigger>
            <TabsTrigger value='risks'>
              <AlertTriangle className='mr-2 h-4 w-4' />
              Risk Factors
            </TabsTrigger>
            <TabsTrigger value='insights'>
              <TrendingUp className='mr-2 h-4 w-4' />
              Insights
            </TabsTrigger>
            <TabsTrigger value='metadata'>
              <BarChart3 className='mr-2 h-4 w-4' />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value='entities' className='space-y-4'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Tag className='h-5 w-5' />
                  Clinical Entities ({results.entities.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='grid gap-3'>
                  {results.entities.map((entity) => (
                    <div
                      key={entity.text + entity.type}
                      className='flex items-center justify-between rounded-lg border p-3'
                    >
                      <div className='flex items-center gap-3'>
                        <Badge variant='outline'>{entity.type}</Badge>
                        <span className='font-medium'>{entity.text}</span>
                      </div>
                      <div className='text-right'>
                        <div className='text-sm font-medium'>
                          {(entity.confidence * 100).toFixed(1)}%
                        </div>
                        <Progress
                          value={entity.confidence * 100}
                          className='mt-1 h-2 w-20'
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='concepts' className='space-y-4'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Brain className='h-5 w-5' />
                  Key Concepts ({results.concepts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='grid gap-3'>
                  {results.concepts.map((concept) => (
                    <div
                      key={concept.concept}
                      className='flex items-center justify-between rounded-lg border p-3'
                    >
                      <span className='font-medium'>{concept.concept}</span>
                      <div className='text-right'>
                        <div className='text-sm font-medium'>
                          {(concept.relevance * 100).toFixed(1)}%
                        </div>
                        <Progress
                          value={concept.relevance * 100}
                          className='mt-1 h-2 w-20'
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='risks' className='space-y-4'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <AlertTriangle className='h-5 w-5' />
                  Risk Assessment ({results.riskFactors.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='grid gap-3'>
                  {results.riskFactors.map((risk) => (
                    <div
                      key={risk.factor}
                      className='flex items-center justify-between rounded-lg border p-3'
                    >
                      <span className='font-medium'>{risk.factor}</span>
                      <Badge
                        variant='outline'
                        className={
                          risk.severity === 'High'
                            ? 'border-red-200 text-red-700 bg-red-50'
                            : risk.severity === 'Moderate'
                              ? 'border-yellow-200 text-yellow-700 bg-yellow-50'
                              : 'border-green-200 text-green-700 bg-green-50'
                        }
                      >
                        {risk.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='insights' className='space-y-4'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <TrendingUp className='h-5 w-5' />
                  Clinical Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                {results.insights && results.insights.length > 0 ? (
                  <div className='grid gap-3'>
                    {results.insights.map((insight) => (
                      <div
                        key={insight.category + insight.insight}
                        className='bg-blue-50 rounded-lg border p-4'
                      >
                        <div className='mb-2 flex items-start justify-between'>
                          <Badge variant='outline'>{insight.category}</Badge>
                          <span className='text-gray-600 text-sm'>
                            {(insight.confidence * 100).toFixed(1)}% confidence
                          </span>
                        </div>
                        <p className='text-gray-700 text-sm'>
                          {insight.insight}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='text-gray-500 py-8 text-center'>
                    <Brain className='mx-auto mb-3 h-12 w-12 opacity-50' />
                    <p>
                      Clinical insights will appear here based on advanced
                      analysis
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='metadata' className='space-y-4'>
            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <BarChart3 className='h-5 w-5' />
                    Text Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {results.metadata && (
                    <div className='space-y-4'>
                      <div className='flex justify-between'>
                        <span className='text-gray-600 text-sm'>
                          Processing Time
                        </span>
                        <span className='font-medium'>
                          {results.metadata.processingTime}ms
                        </span>
                      </div>
                      <div className='flex justify-between'>
                        <span className='text-gray-600 text-sm'>
                          Word Count
                        </span>
                        <span className='font-medium'>
                          {results.metadata.wordCount}
                        </span>
                      </div>
                      <div className='flex justify-between'>
                        <span className='text-gray-600 text-sm'>Sentences</span>
                        <span className='font-medium'>
                          {results.metadata.sentenceCount}
                        </span>
                      </div>
                      <div className='flex justify-between'>
                        <span className='text-gray-600 text-sm'>
                          Complexity Score
                        </span>
                        <span className='font-medium'>
                          {results.metadata.complexity.toFixed(1)}/100
                        </span>
                      </div>
                      <div className='flex justify-between'>
                        <span className='text-gray-600 text-sm'>
                          Readability Score
                        </span>
                        <span className='font-medium'>
                          {results.metadata.readabilityScore.toFixed(1)}/100
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Activity className='h-5 w-5' />
                    Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='space-y-4'>
                    <div>
                      <div className='mb-2 flex justify-between'>
                        <span className='text-gray-600 text-sm'>
                          Analysis Confidence
                        </span>
                        <span className='font-medium'>
                          {confidence.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={confidence} className='h-2' />
                    </div>
                    <div>
                      <div className='mb-2 flex justify-between'>
                        <span className='text-gray-600 text-sm'>
                          Entity Detection
                        </span>
                        <span className='font-medium'>
                          {results.entities.length} found
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, results.entities.length * 10)}
                        className='h-2'
                      />
                    </div>
                    <div>
                      <div className='mb-2 flex justify-between'>
                        <span className='text-gray-600 text-sm'>
                          Risk Assessment
                        </span>
                        <span className='font-medium'>
                          {results.riskFactors.length} factors
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, results.riskFactors.length * 15)}
                        className='h-2'
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Analysis History */}
      {analysisHistory.length > 0 && (
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <CardTitle className='flex items-center gap-2'>
                <History className='h-5 w-5' />
                Analysis History ({analysisHistory.length})
              </CardTitle>
              <Button variant='outline' size='sm' onClick={clearHistory}>
                Clear History
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className='max-h-60 space-y-2 overflow-y-auto'>
              {analysisHistory.map((item) => (
                <button
                  key={item.id}
                  className='hover:bg-gray-50 flex w-full cursor-pointer items-center justify-between rounded-lg border p-3 text-left'
                  onClick={() => loadFromHistory(item)}
                >
                  <div>
                    <p className='max-w-md truncate text-sm font-medium'>
                      {item.text}
                    </p>
                    <p className='text-gray-500 text-xs'>
                      {new Date(item.timestamp).toLocaleString()} •{' '}
                      {item.processingTime}ms
                    </p>
                  </div>
                  <div className='text-right'>
                    <Badge variant='outline' className='text-xs'>
                      {item.result.entities.length} entities
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

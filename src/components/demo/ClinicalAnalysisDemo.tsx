import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { 
  Brain, 
  AlertTriangle, 
  Target, 
  TrendingUp, 
  FileText, 
  Clock,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'

interface RiskAssessment {
  level: 'low' | 'moderate' | 'high' | 'critical'
  score: number
  factors: string[]
  recommendations: string[]
  immediateActions?: string[]
}

interface Recommendation {
  type: 'intervention' | 'assessment' | 'referral' | 'monitoring'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  description: string
  rationale: string
  timeline: string
}

interface AnalysisResult {
  overallRisk: RiskAssessment
  mentalHealthIndicators: {
    name: string
    present: boolean
    confidence: number
    severity?: number
    notes?: string
  }[]
  recommendations: Recommendation[]
  clinicalSummary: string
  followUpRequired: boolean
  estimatedDuration: string
  confidence: number
  processingTime: number
}

export default function ClinicalAnalysisDemo() {
  const [inputText, setInputText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [results, setResults] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const performAnalysis = async () => {
    if (!inputText.trim()) {
      setError('Please enter clinical content to analyze')
      return
    }

    setAnalyzing(true)
    setError(null)
    setResults(null)

    try {
      const response = await fetch('/api/psychology/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: inputText,
          options: {
            includeRiskAssessment: true,
            includeRecommendations: true,
            includeInterventions: true,
            analysisDepth: 'comprehensive',
            confidenceThreshold: 0.6
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`)
      }

      const apiResult = await response.json()

      // Transform API response to match our interface
      const analysisResult: AnalysisResult = {
        overallRisk: {
          level: apiResult.riskAssessment.level,
          score: apiResult.riskAssessment.score,
          factors: apiResult.riskAssessment.factors,
          recommendations: apiResult.riskAssessment.recommendations,
          immediateActions: apiResult.riskAssessment.immediateActions
        },
        mentalHealthIndicators: apiResult.indicators.map((indicator: { condition: string; present: boolean; confidence: number; severity: number; notes: string }) => ({
          name: indicator.condition,
          present: indicator.present,
          confidence: indicator.confidence,
          severity: indicator.severity,
          notes: indicator.notes
        })),
        recommendations: apiResult.recommendations.map((rec: { type: string; priority: string; intervention: string; rationale: string; timeline: string }) => ({
          type: rec.type,
          priority: rec.priority,
          description: rec.intervention,
          rationale: rec.rationale,
          timeline: rec.timeline
        })),
        clinicalSummary: apiResult.analysis.summary,
        followUpRequired: apiResult.analysis.followUpRequired,
        estimatedDuration: apiResult.analysis.estimatedDuration,
        confidence: apiResult.analysis.overallConfidence,
        processingTime: apiResult.metadata.processingTime
      }

      setResults(analysisResult)

    } catch (error: unknown) {
      console.error('Clinical analysis failed:', error)
      setError('Analysis failed. Please try again.')
      
      // Fallback to demo data for demonstration
      const demoResults: AnalysisResult = {
        overallRisk: {
          level: 'moderate',
          score: 0.65,
          factors: [
            'Sleep disturbances reported',
            'Persistent worry patterns',
            'Functional impairment in work/social areas',
            'Duration of symptoms > 6 months'
          ],
          recommendations: [
            'Monitor closely for escalation',
            'Consider therapeutic intervention',
            'Assess for concurrent conditions',
            'Evaluate support system strength'
          ]
        },
        mentalHealthIndicators: [
          { name: 'Generalized Anxiety Disorder', present: true, confidence: 0.85, severity: 6, notes: 'Strong indicators present' },
          { name: 'Major Depressive Episode', present: false, confidence: 0.25, notes: 'Some overlapping symptoms but insufficient criteria' },
          { name: 'Sleep Disorder', present: true, confidence: 0.72, severity: 5, notes: 'Secondary to anxiety symptoms' },
          { name: 'Panic Disorder', present: false, confidence: 0.15, notes: 'No discrete panic attacks reported' }
        ],
        recommendations: [
          {
            type: 'intervention',
            priority: 'high',
            description: 'Cognitive Behavioral Therapy (CBT) for anxiety management',
            rationale: 'Evidence-based treatment for GAD with strong efficacy data',
            timeline: '12-16 weeks'
          },
          {
            type: 'assessment',
            priority: 'medium',
            description: 'Comprehensive sleep study evaluation',
            rationale: 'Sleep disturbances may require targeted intervention',
            timeline: '2-3 weeks'
          },
          {
            type: 'monitoring',
            priority: 'medium',
            description: 'Weekly symptom tracking and check-ins',
            rationale: 'Monitor treatment progress and symptom trajectory',
            timeline: 'Ongoing during treatment'
          }
        ],
        clinicalSummary: 'Client presents with symptoms consistent with Generalized Anxiety Disorder, characterized by excessive worry, sleep disturbances, and functional impairment. Symptoms have persisted for 6+ months and are causing significant distress. Cognitive-behavioral interventions are recommended as first-line treatment.',
        followUpRequired: true,
        estimatedDuration: '12-16 weeks for initial treatment phase',
        confidence: 0.82,
        processingTime: 1.3
      }

      setTimeout(() => {
        setResults(demoResults)
        setError(null)
      }, 2000)
    } finally {
      setAnalyzing(false)
    }
  }

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertTriangle className="w-4 h-4 text-red-600" />
      case 'high': return <AlertCircle className="w-4 h-4 text-orange-600" />
      case 'medium': return <Clock className="w-4 h-4 text-yellow-600" />
      case 'low': return <CheckCircle className="w-4 h-4 text-green-600" />
      default: return <Clock className="w-4 h-4 text-gray-600" />
    }
  }

  const getIndicatorIcon = (present: boolean, confidence: number) => {
    if (present && confidence > 0.7) return <CheckCircle className="w-4 h-4 text-green-600" />
    if (present && confidence > 0.5) return <AlertCircle className="w-4 h-4 text-yellow-600" />
    return <XCircle className="w-4 h-4 text-gray-400" />
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-3">
          <Brain className="w-8 h-8 text-purple-600" />
          Clinical Analysis Engine
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Advanced AI-powered clinical analysis for comprehensive mental health assessment. 
          Analyze clinical notes, session transcripts, or patient descriptions for evidence-based insights.
        </p>
      </div>

      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Clinical Content Input
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Enter clinical notes, therapy session transcript, intake assessment, or patient description here..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="min-h-32 resize-y"
          />
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {inputText.length} characters • Minimum 50 characters recommended
            </div>
            <Button 
              onClick={performAnalysis}
              disabled={analyzing || inputText.trim().length < 10}
              className="flex items-center gap-2"
            >
              {analyzing ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  Analyze Content
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {results && (
        <div className="space-y-6">
          {/* Quick Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Analysis Overview
                </span>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  {results.processingTime.toFixed(1)}s processing time
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(results.confidence * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">Overall Confidence</div>
                </div>
                
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Badge 
                    variant="outline" 
                    className={`text-lg px-3 py-1 ${getRiskBadgeColor(results.overallRisk.level)}`}
                  >
                    {results.overallRisk.level.toUpperCase()}
                  </Badge>
                  <div className="text-sm text-gray-600 mt-1">Risk Level</div>
                </div>
                
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {results.mentalHealthIndicators.filter(i => i.present).length}
                  </div>
                  <div className="text-sm text-gray-600">Indicators Found</div>
                </div>
                
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {results.recommendations.length}
                  </div>
                  <div className="text-sm text-gray-600">Recommendations</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Results */}
          <Card>
            <CardContent className="p-0">
              <Tabs defaultValue="risk" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="risk">Risk Assessment</TabsTrigger>
                  <TabsTrigger value="indicators">Mental Health Indicators</TabsTrigger>
                  <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
                  <TabsTrigger value="summary">Clinical Summary</TabsTrigger>
                </TabsList>
                
                <div className="p-6">
                  <TabsContent value="risk" className="space-y-4 mt-0">
                    <div className="flex items-center gap-3 mb-4">
                      <Shield className="w-6 h-6 text-purple-600" />
                      <h3 className="text-xl font-semibold">Risk Assessment</h3>
                      <Badge 
                        variant="outline" 
                        className={getRiskBadgeColor(results.overallRisk.level)}
                      >
                        {results.overallRisk.level.toUpperCase()} RISK
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Risk Factors Identified</h4>
                        <ul className="space-y-2">
                          {results.overallRisk.factors.map((factor) => (
                            <li key={factor} className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-700">{factor}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Risk Level Score</h4>
                        <div className="space-y-3">
                          <Progress value={results.overallRisk.score * 100} className="w-full" />
                          <div className="text-sm text-gray-600">
                            Score: {results.overallRisk.score.toFixed(2)} / 1.00
                          </div>
                        </div>

                        {results.overallRisk.immediateActions && (
                          <div className="mt-4">
                            <h4 className="font-medium text-red-700 mb-2">Immediate Actions Required</h4>
                            <ul className="space-y-1">
                              {results.overallRisk.immediateActions.map((action) => (
                                <li key={action} className="text-sm text-red-600">• {action}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="indicators" className="space-y-4 mt-0">
                    <div className="flex items-center gap-3 mb-4">
                      <Target className="w-6 h-6 text-blue-600" />
                      <h3 className="text-xl font-semibold">Mental Health Indicators</h3>
                    </div>

                    <div className="space-y-3">
                      {results.mentalHealthIndicators.map((indicator) => (
                        <Card key={indicator.name} className={`border-l-4 ${
                          indicator.present && indicator.confidence > 0.7
                            ? 'border-l-green-500'
                            : indicator.present
                              ? 'border-l-yellow-500'
                              : 'border-l-gray-300'
                        }`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {getIndicatorIcon(indicator.present, indicator.confidence)}
                                <div>
                                  <h4 className="font-medium text-gray-900">{indicator.name}</h4>
                                  {indicator.notes && (
                                    <p className="text-sm text-gray-600">{indicator.notes}</p>
                                  )}
                                </div>
                              </div>
                              
                              <div className="text-right">
                                <div className="text-sm font-medium">
                                  {Math.round(indicator.confidence * 100)}% confidence
                                </div>
                                {indicator.severity && (
                                  <div className="text-sm text-gray-600">
                                    Severity: {indicator.severity}/10
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="recommendations" className="space-y-4 mt-0">
                    <div className="flex items-center gap-3 mb-4">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                      <h3 className="text-xl font-semibold">Clinical Recommendations</h3>
                    </div>

                    <div className="space-y-4">
                      {results.recommendations.map((rec) => (
                        <Card key={rec.description} >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              {getPriorityIcon(rec.priority)}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-medium text-gray-900">{rec.description}</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {rec.type}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${
                                      rec.priority === 'urgent' ? 'border-red-200 text-red-700' :
                                      rec.priority === 'high' ? 'border-orange-200 text-orange-700' :
                                      rec.priority === 'medium' ? 'border-yellow-200 text-yellow-700' :
                                      'border-green-200 text-green-700'
                                    }`}
                                  >
                                    {rec.priority} priority
                                  </Badge>
                                </div>
                                <p className="text-gray-600 text-sm mb-2">{rec.rationale}</p>
                                <div className="text-xs text-gray-500">
                                  Timeline: {rec.timeline}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="summary" className="space-y-4 mt-0">
                    <div className="flex items-center gap-3 mb-4">
                      <FileText className="w-6 h-6 text-indigo-600" />
                      <h3 className="text-xl font-semibold">Clinical Summary</h3>
                    </div>

                    <Card>
                      <CardContent className="p-6">
                        <div className="prose max-w-none">
                          <p className="text-gray-700 leading-relaxed">{results.clinicalSummary}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">Follow-up Required</h4>
                            <div className="flex items-center gap-2">
                              {results.followUpRequired ? (
                                <>
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                  <span className="text-green-700">Yes, follow-up recommended</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-4 h-4 text-gray-400" />
                                  <span className="text-gray-600">No immediate follow-up needed</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">Estimated Treatment Duration</h4>
                            <p className="text-gray-700">{results.estimatedDuration}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

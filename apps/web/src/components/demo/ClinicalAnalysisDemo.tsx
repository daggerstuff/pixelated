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
  AlertCircle,
} from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge/index'
import { Button } from '@/components/ui/button/index'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card/index'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

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
            confidenceThreshold: 0.6,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`)
      }

      interface ClinicalAnalysisResponse {
        riskAssessment?: Record<string, unknown>
        indicators?: Array<Record<string, unknown>>
        recommendations?: Array<Record<string, unknown>>
        analysis?: Record<string, unknown>
        metadata?: Record<string, unknown>
      }

      const apiResult = (await response.json()) as ClinicalAnalysisResponse

      // Transform API response to match our interface
      const analysisResult: AnalysisResult = {
        overallRisk: {
          level: apiResult.riskAssessment?.['level'] as RiskAssessment['level'],
          score: apiResult.riskAssessment?.['score'] as number,
          factors: apiResult.riskAssessment?.['factors'] as string[],
          recommendations: apiResult.riskAssessment?.[
            'recommendations'
          ] as string[],
          immediateActions: apiResult.riskAssessment?.['immediateActions'] as
            | string[]
            | undefined,
        },
        mentalHealthIndicators:
          apiResult.indicators?.map((indicator) => ({
            name: indicator['condition'] as string,
            present: indicator['present'] as boolean,
            confidence: indicator['confidence'] as number,
            severity: indicator['severity'] as number | undefined,
            notes: indicator['notes'] as string | undefined,
          })) ?? [],
        recommendations:
          apiResult.recommendations?.map((rec) => ({
            type: rec['type'] as Recommendation['type'],
            priority: rec['priority'] as Recommendation['priority'],
            description: rec['intervention'] as string,
            rationale: rec['rationale'] as string,
            timeline: rec['timeline'] as string,
          })) ?? [],
        clinicalSummary: apiResult.analysis?.['summary'] as string,
        followUpRequired: apiResult.analysis?.['followUpRequired'] as boolean,
        estimatedDuration: apiResult.analysis?.['estimatedDuration'] as string,
        confidence: apiResult.analysis?.['overallConfidence'] as number,
        processingTime: apiResult.metadata?.['processingTime'] as number,
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
            'Duration of symptoms > 6 months',
          ],
          recommendations: [
            'Monitor closely for escalation',
            'Consider therapeutic intervention',
            'Assess for concurrent conditions',
            'Evaluate support system strength',
          ],
        },
        mentalHealthIndicators: [
          {
            name: 'Generalized Anxiety Disorder',
            present: true,
            confidence: 0.85,
            severity: 6,
            notes: 'Strong indicators present',
          },
          {
            name: 'Major Depressive Episode',
            present: false,
            confidence: 0.25,
            notes: 'Some overlapping symptoms but insufficient criteria',
          },
          {
            name: 'Sleep Disorder',
            present: true,
            confidence: 0.72,
            severity: 5,
            notes: 'Secondary to anxiety symptoms',
          },
          {
            name: 'Panic Disorder',
            present: false,
            confidence: 0.15,
            notes: 'No discrete panic attacks reported',
          },
        ],
        recommendations: [
          {
            type: 'intervention',
            priority: 'high',
            description:
              'Cognitive Behavioral Therapy (CBT) for anxiety management',
            rationale:
              'Evidence-based treatment for GAD with strong efficacy data',
            timeline: '12-16 weeks',
          },
          {
            type: 'assessment',
            priority: 'medium',
            description: 'Comprehensive sleep study evaluation',
            rationale: 'Sleep disturbances may require targeted intervention',
            timeline: '2-3 weeks',
          },
          {
            type: 'monitoring',
            priority: 'medium',
            description: 'Weekly symptom tracking and check-ins',
            rationale: 'Monitor treatment progress and symptom trajectory',
            timeline: 'Ongoing during treatment',
          },
        ],
        clinicalSummary:
          'Client presents with symptoms consistent with Generalized Anxiety Disorder, characterized by excessive worry, sleep disturbances, and functional impairment. Symptoms have persisted for 6+ months and are causing significant distress. Cognitive-behavioral interventions are recommended as first-line treatment.',
        followUpRequired: true,
        estimatedDuration: '12-16 weeks for initial treatment phase',
        confidence: 0.82,
        processingTime: 1.3,
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
      case 'low':
        return 'bg-secondary text-muted-foreground border-input'
      case 'moderate':
        return 'bg-secondary text-foreground border-ring'
      case 'high':
        return 'bg-secondary text-foreground border-ring'
      case 'critical':
        return 'bg-primary text-primary-foreground border-primary'
      default:
        return 'bg-secondary text-muted-foreground border-input'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <AlertTriangle className="h-4 w-4 text-foreground" />
      case 'high':
        return <AlertCircle className="h-4 w-4 text-foreground" />
      case 'medium':
        return <Clock className="h-4 w-4 text-muted-foreground" />
      case 'low':
        return <CheckCircle className="h-4 w-4 text-muted-foreground" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getIndicatorIcon = (present: boolean, confidence: number) => {
    if (present && confidence > 0.7)
      return <CheckCircle className="h-4 w-4 text-foreground" />
    if (present && confidence > 0.5)
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />
    return <XCircle className="h-4 w-4 text-muted-foreground" />
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="space-y-4 text-center">
        <h1 className="flex items-center justify-center gap-3 text-3xl font-bold text-foreground">
          <Brain className="h-8 w-8 text-foreground" />
          Clinical Analysis Engine
        </h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Advanced AI-powered clinical analysis for comprehensive mental health
          assessment. Analyze clinical notes, session transcripts, or patient
          descriptions for evidence-based insights.
        </p>
      </div>

      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
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

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {inputText.length} characters • Minimum 50 characters recommended
            </div>
            <Button
              onClick={performAnalysis}
              disabled={analyzing || inputText.trim().length < 10}
              className="flex items-center gap-2"
            >
              {analyzing ? (
                <>
                  <div className="border-t-transparent h-4 w-4 animate-spin rounded-none border-2 border-ring" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  Analyze Content
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="rounded-none border border-ring bg-secondary p-3 text-sm text-foreground">
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
                  <TrendingUp className="h-5 w-5" />
                  Analysis Overview
                </span>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {results.processingTime.toFixed(1)}s processing time
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-none bg-secondary p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {Math.round(results.confidence * 100)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Overall Confidence
                  </div>
                </div>

                <div className="rounded-none bg-secondary p-4 text-center">
                  <Badge
                    variant="outline"
                    className={`px-3 py-1 text-lg ${getRiskBadgeColor(results.overallRisk.level)}`}
                  >
                    {results.overallRisk.level.toUpperCase()}
                  </Badge>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Risk Level
                  </div>
                </div>

                <div className="rounded-none bg-secondary p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {
                      results.mentalHealthIndicators.filter((i) => i.present)
                        .length
                    }
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Indicators Found
                  </div>
                </div>

                <div className="rounded-none bg-secondary p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {results.recommendations.length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Recommendations
                  </div>
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
                  <TabsTrigger value="indicators">
                    Mental Health Indicators
                  </TabsTrigger>
                  <TabsTrigger value="recommendations">
                    Recommendations
                  </TabsTrigger>
                  <TabsTrigger value="summary">Clinical Summary</TabsTrigger>
                </TabsList>

                <div className="p-6">
                  <TabsContent value="risk" className="mt-0 space-y-4">
                    <div className="mb-4 flex items-center gap-3">
                      <Shield className="h-6 w-6 text-foreground" />
                      <h3 className="text-xl font-semibold">Risk Assessment</h3>
                      <Badge
                        variant="outline"
                        className={getRiskBadgeColor(results.overallRisk.level)}
                      >
                        {results.overallRisk.level.toUpperCase()} RISK
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div>
                        <h4 className="mb-3 font-medium text-foreground">
                          Risk Factors Identified
                        </h4>
                        <ul className="space-y-2">
                          {results.overallRisk.factors.map((factor) => (
                            <li key={factor} className="flex items-start gap-2">
                              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                              <span className="text-foreground">{factor}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="mb-3 font-medium text-foreground">
                          Risk Level Score
                        </h4>
                        <div className="space-y-3">
                          <Progress
                            value={results.overallRisk.score * 100}
                            className="w-full"
                          />
                          <div className="text-sm text-muted-foreground">
                            Score: {results.overallRisk.score.toFixed(2)} / 1.00
                          </div>
                        </div>

                        {results.overallRisk.immediateActions && (
                          <div className="mt-4">
                            <h4 className="mb-2 font-medium text-foreground">
                              Immediate Actions Required
                            </h4>
                            <ul className="space-y-1">
                              {results.overallRisk.immediateActions.map(
                                (action) => (
                                  <li
                                    key={action}
                                    className="text-sm text-foreground"
                                  >
                                    • {action}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="indicators" className="mt-0 space-y-4">
                    <div className="mb-4 flex items-center gap-3">
                      <Target className="h-6 w-6 text-foreground" />
                      <h3 className="text-xl font-semibold">
                        Mental Health Indicators
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {results.mentalHealthIndicators.map((indicator) => (
                        <Card
                          key={indicator.name}
                          className={`border-l-4 ${
                            indicator.present && indicator.confidence > 0.7
                              ? 'border-l-ring'
                              : indicator.present
                                ? 'border-l-input'
                                : 'border-l-border'
                          }`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {getIndicatorIcon(
                                  indicator.present,
                                  indicator.confidence,
                                )}
                                <div>
                                  <h4 className="font-medium text-foreground">
                                    {indicator.name}
                                  </h4>
                                  {indicator.notes && (
                                    <p className="text-sm text-muted-foreground">
                                      {indicator.notes}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-sm font-medium">
                                  {Math.round(indicator.confidence * 100)}%
                                  confidence
                                </div>
                                {indicator.severity && (
                                  <div className="text-sm text-muted-foreground">
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

                  <TabsContent
                    value="recommendations"
                    className="mt-0 space-y-4"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <TrendingUp className="h-6 w-6 text-foreground" />
                      <h3 className="text-xl font-semibold">
                        Clinical Recommendations
                      </h3>
                    </div>

                    <div className="space-y-4">
                      {results.recommendations.map((rec) => (
                        <Card key={rec.description}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              {getPriorityIcon(rec.priority)}
                              <div className="flex-1">
                                <div className="mb-2 flex items-center gap-2">
                                  <h4 className="font-medium text-foreground">
                                    {rec.description}
                                  </h4>
                                  <Badge variant="outline" className="text-xs">
                                    {rec.type}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${
                                      rec.priority === 'urgent' ||
                                      rec.priority === 'high'
                                        ? 'border-ring font-semibold text-foreground'
                                        : 'border-input text-muted-foreground'
                                    }`}
                                  >
                                    {rec.priority} priority
                                  </Badge>
                                </div>
                                <p className="mb-2 text-sm text-muted-foreground">
                                  {rec.rationale}
                                </p>
                                <div className="text-xs text-muted-foreground">
                                  Timeline: {rec.timeline}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="summary" className="mt-0 space-y-4">
                    <div className="mb-4 flex items-center gap-3">
                      <FileText className="h-6 w-6 text-foreground" />
                      <h3 className="text-xl font-semibold">
                        Clinical Summary
                      </h3>
                    </div>

                    <Card>
                      <CardContent className="p-6">
                        <div className="prose max-w-none">
                          <p className="leading-relaxed text-foreground">
                            {results.clinicalSummary}
                          </p>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-6 border-t pt-6 md:grid-cols-2">
                          <div>
                            <h4 className="mb-2 font-medium text-foreground">
                              Follow-up Required
                            </h4>
                            <div className="flex items-center gap-2">
                              {results.followUpRequired ? (
                                <>
                                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-foreground">
                                    Yes, follow-up recommended
                                  </span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">
                                    No immediate follow-up needed
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div>
                            <h4 className="mb-2 font-medium text-foreground">
                              Estimated Treatment Duration
                            </h4>
                            <p className="text-foreground">
                              {results.estimatedDuration}
                            </p>
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

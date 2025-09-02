import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import Alert from '@/components/ui/alert'
import { 
  AlertTriangle, 
  Shield, 
  Phone, 
  Clock, 
  Heart, 
  Brain,
  FileText,
  CheckCircle,
  Zap,
  Activity,
  TrendingUp,
  AlertCircle
} from 'lucide-react'
import { apiClient, APIError } from '@/lib/api-client'

interface CrisisDetectionApiResponse {
  assessment: {
    overallRisk: 'none' | 'low' | 'moderate' | 'high' | 'imminent';
    suicidalIdeation: {
      present: boolean;
      severity: 'with_intent' | 'with_plan' | 'active' | 'passive' | 'none';
    };
    selfHarm: {
      present: boolean;
      risk: 'high' | 'moderate' | 'low';
      frequency: 'daily' | 'frequent' | 'occasional' | 'rare' | 'none';
    };
    agitation: {
      present: boolean;
      controllable: boolean;
      severity: 'severe' | 'moderate' | 'low';
    };
    substanceUse: {
      present: boolean;
      acute: boolean;
      impairment: 'severe' | 'moderate' | 'low';
    };
  };
  riskFactors: { factor: string }[];
  protectiveFactors: { factor: string }[];
  recommendations: {
    immediate: { action: string }[];
  };
  resources: {
    crisis: {
      name: string;
      contact: string;
      specialization: string[];
      availability: string;
    }[];
  };
  metadata: {
    confidenceScore: number;
  };
}

interface CrisisAssessment {
  riskLevel: 'none' | 'low' | 'moderate' | 'high' | 'imminent'
  riskScore: number
  crisisIndicators: {
    suicidalIdeation: { present: boolean; confidence: number; severity?: number }
    selfHarm: { present: boolean; confidence: number; severity?: number }
    hopelessness: { present: boolean; confidence: number; severity?: number }
    impulsivity: { present: boolean; confidence: number; severity?: number }
    socialIsolation: { present: boolean; confidence: number; severity?: number }
    substanceUse: { present: boolean; confidence: number; severity?: number }
  }
  protectiveFactors: string[]
  immediateActions: string[]
  emergencyResources: {
    type: string
    contact: string
    description: string
    available: string
  }[]
  confidenceLevel: number
  timestamp: string
}

export default function CrisisDetectionDemo() {
  const [inputText, setInputText] = useState('')
  const [assessing, setAssessing] = useState(false)
  const [assessment, setAssessment] = useState<CrisisAssessment | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [realTimeMonitoring, setRealTimeMonitoring] = useState(false)
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null)
  const [assessmentHistory, setAssessmentHistory] = useState<CrisisAssessment[]>([])

  const performCrisisAssessment = useCallback(async (isRealTime: boolean = false) => {
    if (!inputText.trim()) {
      setError('Please enter content to assess for crisis indicators')
      return
    }

    if (!isRealTime) {
      setAssessing(true)
      setError(null)
      setAssessment(null)
    }

    try {
      const result = await apiClient.detectCrisis({
        content: inputText,
        contentType: 'chat_message',
        context: {
          previousAssessments: assessmentHistory.slice(-3), // Last 3 assessments for context
          sessionMetadata: {
            previousCrisisFlags: assessmentHistory
              .filter(a => a.riskLevel === 'high' || a.riskLevel === 'imminent')
              .map(a => `${a.riskLevel}_risk`)
          }
        },
        options: {
          sensitivityLevel: 'high',
          includeTreatmentSuggestions: true,
          includeResourceRecommendations: true,
          enableImmediateNotifications: true
        }
      }) as CrisisDetectionApiResponse

      const crisisAssessment: CrisisAssessment = {
        riskLevel: result.assessment.overallRisk,
        riskScore: result.assessment.overallRisk === 'imminent' ? 0.95 :
                  result.assessment.overallRisk === 'high' ? 0.8 :
                  result.assessment.overallRisk === 'moderate' ? 0.6 :
                  result.assessment.overallRisk === 'low' ? 0.3 : 0.1,
        crisisIndicators: {
          suicidalIdeation: {
            present: result.assessment.suicidalIdeation.present,
            confidence: result.assessment.suicidalIdeation.severity === 'with_intent' ? 0.95 :
                       result.assessment.suicidalIdeation.severity === 'with_plan' ? 0.85 :
                       result.assessment.suicidalIdeation.severity === 'active' ? 0.75 :
                       result.assessment.suicidalIdeation.severity === 'passive' ? 0.5 : 0.1,
            severity: result.assessment.suicidalIdeation.severity === 'with_intent' ? 10 :
                     result.assessment.suicidalIdeation.severity === 'with_plan' ? 9 :
                     result.assessment.suicidalIdeation.severity === 'active' ? 7 :
                     result.assessment.suicidalIdeation.severity === 'passive' ? 4 : 0
          },
          selfHarm: {
            present: result.assessment.selfHarm.present,
            confidence: result.assessment.selfHarm.risk === 'high' ? 0.9 :
                       result.assessment.selfHarm.risk === 'moderate' ? 0.6 : 0.3,
            severity: result.assessment.selfHarm.frequency === 'daily' ? 10 :
                     result.assessment.selfHarm.frequency === 'frequent' ? 8 :
                     result.assessment.selfHarm.frequency === 'occasional' ? 5 :
                     result.assessment.selfHarm.frequency === 'rare' ? 2 : 0
          },
          hopelessness: {
            present: result.riskFactors.some(rf => rf.factor.includes('hopelessness')),
            confidence: 0.7,
            severity: 6
          },
          impulsivity: {
            present: result.assessment.agitation.present,
            confidence: result.assessment.agitation.controllable ? 0.4 : 0.8,
            severity: result.assessment.agitation.severity === 'severe' ? 9 :
                     result.assessment.agitation.severity === 'moderate' ? 6 : 3
          },
          socialIsolation: {
            present: result.riskFactors.some(rf => rf.factor.includes('isolation')),
            confidence: 0.6,
            severity: 5
          },
          substanceUse: {
            present: result.assessment.substanceUse.present,
            confidence: result.assessment.substanceUse.acute ? 0.9 : 0.5,
            severity: result.assessment.substanceUse.impairment === 'severe' ? 9 :
                     result.assessment.substanceUse.impairment === 'moderate' ? 6 : 3
          }
        },
        protectiveFactors: result.protectiveFactors.map(pf => pf.factor),
        immediateActions: result.recommendations.immediate.map(action => action.action),
        emergencyResources: result.resources.crisis.map(resource => ({
          type: resource.name,
          contact: resource.contact,
          description: resource.specialization.join(', '),
          available: resource.availability
        })),
        confidenceLevel: result.metadata.confidenceScore / 100,
        timestamp: new Date().toISOString()
      }

      if (!isRealTime) {
        setAssessment(crisisAssessment)
      }

      // Add to assessment history
      setAssessmentHistory(prev => [...prev.slice(-9), crisisAssessment]) // Keep last 10

      // Handle high-risk situations
      if (crisisAssessment.riskLevel === 'imminent' || crisisAssessment.riskLevel === 'high') {
        // Could trigger notifications, alerts, etc.
        console.warn('HIGH RISK SITUATION DETECTED:', crisisAssessment)
      }

    } catch (error: unknown) {
      console.error('Crisis assessment failed:', error)

      if (error instanceof APIError) {
        setError(`Assessment failed: ${String(error)}`)
      } else {
        setError('Assessment failed. Please try again.')
      }

      // Fallback to demo data for demonstration
      if (!isRealTime) {
        const demoAssessment: CrisisAssessment = {
          riskLevel: 'moderate',
          riskScore: 0.65,
          crisisIndicators: {
            suicidalIdeation: { present: false, confidence: 0.15 },
            selfHarm: { present: false, confidence: 0.08 },
            hopelessness: { present: true, confidence: 0.82, severity: 6 },
            impulsivity: { present: false, confidence: 0.25 },
            socialIsolation: { present: true, confidence: 0.75, severity: 7 },
            substanceUse: { present: false, confidence: 0.12 }
          },
          protectiveFactors: [
            'Strong family support system mentioned',
            'Currently employed/functioning',
            'No history of suicide attempts',
            'Seeking help by reaching out'
          ],
          immediateActions: [
            'Continue monitoring for escalation',
            'Ensure professional mental health support',
            'Activate support network',
            'Safety planning recommended'
          ],
          emergencyResources: [
            {
              type: 'Crisis Hotline',
              contact: '988',
              description: 'National Suicide Prevention Lifeline',
              available: '24/7'
            },
            {
              type: 'Crisis Text Line',
              contact: 'Text HOME to 741741',
              description: 'Free, confidential crisis support via text',
              available: '24/7'
            }
          ],
          confidenceLevel: 0.78,
          timestamp: new Date().toISOString()
        }

        setTimeout(() => {
          setAssessment(demoAssessment)
          setError(null)
        }, 2000)
      }
    } finally {
      if (!isRealTime) {
        setAssessing(false)
      }
    }
  }, [inputText, assessmentHistory])

  // Real-time monitoring effect
  useEffect(() => {
    if (realTimeMonitoring && inputText.length > 50) {
      // Clear existing timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout)
      }

      // Set new timeout for real-time analysis
      const timeout = setTimeout(() => {
        performCrisisAssessment(true) // Silent assessment
      }, 2000) // Wait 2 seconds after user stops typing

      setTypingTimeout(timeout)
    }

    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout)
      }
    }
  }, [inputText, realTimeMonitoring, typingTimeout, performCrisisAssessment])

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'none': return 'bg-green-100 text-green-800 border-green-200'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'imminent': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'none': return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'low': return <Shield className="w-5 h-5 text-blue-600" />
      case 'moderate': return <AlertTriangle className="w-5 h-5 text-yellow-600" />
      case 'high': return <AlertTriangle className="w-5 h-5 text-orange-600" />
      case 'imminent': return <AlertTriangle className="w-5 h-5 text-red-600" />
      default: return <Shield className="w-5 h-5 text-gray-600" />
    }
  }

  const getIndicatorIcon = (present: boolean, confidence: number) => {
    if (present && confidence > 0.7) return <AlertTriangle className="w-4 h-4 text-red-500" />
    if (present && confidence > 0.5) return <AlertTriangle className="w-4 h-4 text-orange-500" />
    if (present) return <AlertTriangle className="w-4 h-4 text-yellow-500" />
    return <CheckCircle className="w-4 h-4 text-green-500" />
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-3">
          <Shield className="w-8 h-8 text-red-600" />
          Crisis Detection & Assessment
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Advanced AI-powered crisis detection system for real-time assessment of suicide risk, 
          self-harm indicators, and mental health emergencies with immediate resource recommendations.
        </p>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          <strong>Important:</strong> This is a demonstration tool. For actual crises, immediately contact 
          emergency services (911) or the National Suicide Prevention Lifeline (988).
        </div>
      </div>

      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Crisis Assessment Input
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Enter text to assess for crisis indicators (e.g., chat messages, clinical notes, session transcripts)..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="min-h-32 resize-y"
          />
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {inputText.length} characters • Real-time crisis detection
              {realTimeMonitoring && (
                <Badge variant="outline" className="ml-2 bg-green-50 text-green-700">
                  <Activity className="w-3 h-3 mr-1" />
                  Live Monitoring
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRealTimeMonitoring(!realTimeMonitoring)}
                className={realTimeMonitoring ? 'bg-green-50 border-green-200' : ''}
              >
                <Activity className="w-4 h-4 mr-2" />
                {realTimeMonitoring ? 'Disable' : 'Enable'} Real-time
              </Button>
              <Button 
                onClick={() => performCrisisAssessment(false)}
                disabled={assessing || inputText.trim().length < 5}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700"
              >
                {assessing ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Assessing...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Assess Crisis Risk
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Assessment History Indicator */}
          {assessmentHistory.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <TrendingUp className="w-3 h-3" />
              <span>{assessmentHistory.length} previous assessment{assessmentHistory.length !== 1 ? 's' : ''}</span>
              {assessmentHistory.slice(-3).some(a => a.riskLevel === 'high' || a.riskLevel === 'imminent') && (
                <Badge variant="outline" className="text-red-600 border-red-200">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  High-risk history
                </Badge>
              )}
            </div>
          )}

          {error && (
            <Alert variant="error" icon={<AlertTriangle className="w-4 h-4" />}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Assessment Results */}
      {assessment && (
        <div className="space-y-6">
          {/* Risk Level Overview */}
          <Card className={`border-l-4 ${
            assessment.riskLevel === 'imminent' ? 'border-l-red-500' :
            assessment.riskLevel === 'high' ? 'border-l-orange-500' :
            assessment.riskLevel === 'moderate' ? 'border-l-yellow-500' :
            assessment.riskLevel === 'low' ? 'border-l-blue-500' :
            'border-l-green-500'
          }`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getRiskIcon(assessment.riskLevel)}
                  <span>Crisis Risk Assessment</span>
                </div>
                <Badge 
                  variant="outline" 
                  className={`text-lg px-4 py-2 ${getRiskLevelColor(assessment.riskLevel)}`}
                >
                  {assessment.riskLevel.toUpperCase()} RISK
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Risk Score</h4>
                  <Progress value={assessment.riskScore * 100} className="w-full mb-2" />
                  <div className="text-sm text-gray-600">
                    {(assessment.riskScore * 100).toFixed(1)}% risk probability
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Confidence Level</h4>
                  <Progress value={assessment.confidenceLevel * 100} className="w-full mb-2" />
                  <div className="text-sm text-gray-600">
                    {(assessment.confidenceLevel * 100).toFixed(1)}% confidence
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Assessment Time</h4>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">
                      {new Date(assessment.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Crisis Indicators */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                Crisis Indicators Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(assessment.crisisIndicators).map(([key, indicator]) => (
                  <div key={key} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getIndicatorIcon(indicator.present, indicator.confidence)}
                        <span className="font-medium capitalize">
                          {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {Math.round(indicator.confidence * 100)}%
                      </div>
                    </div>
                    
                    <Progress 
                      value={indicator.confidence * 100} 
                      className="w-full mb-2" 
                    />
                    
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{indicator.present ? 'Present' : 'Not detected'}</span>
                      {indicator.severity && (
                        <span>Severity: {indicator.severity}/10</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Immediate Actions & Resources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Immediate Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700">
                  <Zap className="w-5 h-5" />
                  Immediate Actions Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {assessment.immediateActions.map((action, index) => (
                    <li key={action} className="flex items-start gap-2">
                      <div className="w-6 h-6 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                        {index + 1}
                      </div>
                      <span className="text-gray-700">{action}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Emergency Resources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <Phone className="w-5 h-5" />
                  Emergency Resources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {assessment.emergencyResources.map((resource) => (
                    <div key={resource.type + resource.contact} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-red-900">{resource.type}</h4>
                        <Badge variant="outline" className="text-xs bg-red-100 text-red-700">
                          {resource.available}
                        </Badge>
                      </div>
                      <div className="text-lg font-mono text-red-800 mb-1">
                        {resource.contact}
                      </div>
                      <p className="text-sm text-red-700">{resource.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Protective Factors */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <Heart className="w-5 h-5" />
                Protective Factors Identified
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {assessment.protectiveFactors.map((factor) => (
                  <div key={factor} className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-green-800">{factor}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-4 justify-center">
                <Button 
                  variant="outline" 
                  className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                  onClick={() => window.open('tel:988')}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Call 988 (Crisis Lifeline)
                </Button>
                
                <Button 
                  variant="outline"
                  className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  onClick={() => window.open('sms:741741?body=HOME')}
                >
                  Crisis Text Line
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => performCrisisAssessment(false)}
                  disabled={assessing}
                >
                  Re-assess Risk
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

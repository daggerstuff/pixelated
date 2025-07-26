import React from 'react'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Heart, Brain, Shield, Zap } from 'lucide-react'

// Types for the component
export interface EnhancedMentalHealthAnalysis {
  timestamp: number
  category: 'low' | 'medium' | 'high' | 'critical'
  explanation: string
  expertGuided: boolean
  scores: Record<string, unknown>
  summary: string
  hasMentalHealthIssue: boolean
  confidence: number
  supportingEvidence: string[]
  riskLevel: 'low' | 'medium' | 'high'
  emotions?: string[]
  riskFactors?: string[]
}

interface MentalHealthInsightsProps {
  analysis: EnhancedMentalHealthAnalysis
}

export const MentalHealthInsights: React.FC<MentalHealthInsightsProps> = ({
  analysis,
}) => {
  const getRiskIcon = () => {
    switch (analysis.riskLevel) {
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'medium':
        return <Shield className="h-4 w-4 text-yellow-500" />
      case 'low':
      default:
        return <Heart className="h-4 w-4 text-green-500" />
    }
  }

  const getRiskBadgeVariant = () => {
    switch (analysis.riskLevel) {
      case 'high':
        return 'destructive'
      case 'medium':
        return 'outline'
      case 'low':
      default:
        return 'secondary'
    }
  }

  return (
    <div className="space-y-4">
      {/* Risk Level Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getRiskIcon()}
          <span className="text-sm font-medium text-green-300">
            Risk Assessment
          </span>
        </div>
        <Badge variant={getRiskBadgeVariant()}>
          {analysis.riskLevel.toUpperCase()}
        </Badge>
      </div>

      {/* Analysis Summary */}
      <div className="rounded-lg bg-green-900/20 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-4 w-4 text-green-400" />
          <span className="text-sm font-medium text-green-300">Analysis</span>
        </div>
        <p className="text-xs text-green-200 mb-2">{analysis.explanation}</p>
        <p className="text-xs text-green-300">
          Confidence: {Math.round(analysis.confidence * 100)}%
        </p>
      </div>

      {/* Emotions Detection */}
      {analysis.emotions && analysis.emotions.length > 0 && (
        <div className="rounded-lg bg-blue-900/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-300">
              Detected Emotions
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {analysis.emotions.map((emotion) => (
              <Badge
                key={emotion}
                variant="outline"
                className="text-xs border-blue-400 text-blue-300"
              >
                {emotion}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Risk Factors */}
      {analysis.riskFactors && analysis.riskFactors.length > 0 && (
        <div className="rounded-lg bg-yellow-900/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <span className="text-sm font-medium text-yellow-300">
              Risk Factors
            </span>
          </div>
          <ul className="text-xs text-yellow-200 space-y-1">
            {analysis.riskFactors.map((factor) => (
              <li key={factor} className="flex items-start gap-1">
                <span className="text-yellow-400">•</span>
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Supporting Evidence */}
      {analysis.supportingEvidence.length > 0 && (
        <div className="rounded-lg bg-purple-900/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-medium text-purple-300">
              Supporting Evidence
            </span>
          </div>
          <ul className="text-xs text-purple-200 space-y-1">
            {analysis.supportingEvidence.map((evidence) => (
              <li key={evidence} className="flex items-start gap-1">
                <span className="text-purple-400">•</span>
                {evidence}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Expert Guidance Indicator */}
      {analysis.expertGuided && (
        <div className="rounded-lg bg-red-900/20 p-3 border border-red-500/30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-sm font-medium text-red-300">
              Expert Guidance Recommended
            </span>
          </div>
          <p className="text-xs text-red-200 mt-1">
            This case may require professional mental health intervention.
          </p>
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-gray-400 pt-2 border-t border-green-700/30">
        <div className="flex justify-between">
          <span>Category: {analysis.category}</span>
          <span>{new Date(analysis.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  )
}

export default MentalHealthInsights

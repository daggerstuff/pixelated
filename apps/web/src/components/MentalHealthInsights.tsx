import { AlertTriangle, Heart, Brain, Shield, Zap } from 'lucide-react'
import { FC } from 'react'

import { Badge } from '@/components/ui/badge/index'
import { type EnhancedMentalHealthAnalysis } from '@/lib/mental-health/types'

interface MentalHealthInsightsProps {
  analysis: EnhancedMentalHealthAnalysis
}

const RISK_BADGE_VARIANT_MAP: Record<
  'low' | 'medium' | 'high' | 'critical',
  'destructive' | 'outline' | 'secondary'
> = {
  critical: 'destructive',
  high: 'destructive',
  medium: 'outline',
  low: 'secondary',
} as const

const getRiskIconComponent = (
  riskLevel: 'low' | 'medium' | 'high' | 'critical',
): React.ReactElement => {
  switch (riskLevel) {
    case 'critical':
      return <Zap className="h-4 w-4 animate-pulse text-foreground" />
    case 'high':
      return <AlertTriangle className="h-4 w-4 text-foreground" />
    case 'medium':
      return <Shield className="h-4 w-4 text-muted-foreground" />
    case 'low':
    default:
      return <Heart className="h-4 w-4 text-muted-foreground" />
  }
}

export const MentalHealthInsights: FC<MentalHealthInsightsProps> = ({
  analysis,
}) => {
  const getRiskIcon = () => {
    return getRiskIconComponent(analysis.riskLevel)
  }

  const getRiskBadgeVariant = () => {
    return RISK_BADGE_VARIANT_MAP[analysis.riskLevel]
  }

  return (
    <div className="space-y-4">
      {/* Risk Level Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getRiskIcon()}
          <span className="text-sm font-medium text-foreground">
            Risk Assessment
          </span>
        </div>
        <Badge variant={getRiskBadgeVariant()}>
          {analysis.riskLevel.toUpperCase()}
        </Badge>
      </div>

      {/* Analysis Summary */}
      <div className="rounded-none bg-secondary p-3">
        <div className="mb-2 flex items-center gap-2">
          <Brain className="h-4 w-4 text-foreground" />
          <span className="text-sm font-medium text-foreground">Analysis</span>
        </div>
        <p className="mb-2 text-xs text-foreground">{analysis.explanation}</p>
        <p className="text-xs text-muted-foreground">
          Confidence: {Math.round(analysis.confidence * 100)}%
        </p>
      </div>

      {/* Emotions Detection */}
      {analysis.emotions && analysis.emotions.length > 0 && (
        <div className="rounded-none bg-secondary p-3">
          <div className="mb-2 flex items-center gap-2">
            <Heart className="h-4 w-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">
              Detected Emotions
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {analysis.emotions.map((emotion) => (
              <Badge
                key={emotion}
                variant="outline"
                className="border-input text-xs text-foreground"
              >
                {emotion}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Risk Factors */}
      {analysis.riskFactors && analysis.riskFactors.length > 0 && (
        <div className="rounded-none bg-secondary p-3">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">
              Risk Factors
            </span>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {analysis.riskFactors.map((factor) => (
              <li key={factor} className="flex items-start gap-1">
                <span className="text-muted-foreground">•</span>
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Supporting Evidence */}
      {analysis.supportingEvidence.length > 0 && (
        <div className="rounded-none bg-secondary p-3">
          <div className="mb-2 flex items-center gap-2">
            <Zap className="h-4 w-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">
              Supporting Evidence
            </span>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {analysis.supportingEvidence.map((evidence) => (
              <li key={evidence} className="flex items-start gap-1">
                <span className="text-muted-foreground">•</span>
                {evidence}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Expert Guidance Indicator */}
      {analysis.expertGuided && (
        <div className="rounded-none border border-ring bg-secondary p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">
              Expert Guidance Recommended
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            This case may require professional mental health intervention.
          </p>
        </div>
      )}

      {/* Metadata */}
      <div className="border-t border-border pt-2 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Category: {analysis.category}</span>
          <span>{new Date(analysis.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  )
}

import { AlertTriangle, Heart, Brain, Shield, Zap } from 'lucide-react'
import { FC } from 'react'

import { Badge } from '@/components/ui/badge'

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

const RISK_BADGE_VARIANT_MAP: Record<
  'low' | 'medium' | 'high',
  'destructive' | 'outline' | 'secondary'
> = {
  high: 'destructive',
  medium: 'outline',
  low: 'secondary',
} as const

const getRiskIconComponent = (
  riskLevel: 'low' | 'medium' | 'high',
): React.ReactElement => {
  switch (riskLevel) {
    case 'high':
      return <AlertTriangle className='text-red-500 h-4 w-4' />
    case 'medium':
      return <Shield className='text-yellow-500 h-4 w-4' />
    case 'low':
    default:
      return <Heart className='text-green-500 h-4 w-4' />
  }
}

export const MentalHealthInsights: FC<MentalHealthInsightsProps> = ({
  analysis,
}) => {
  const getRiskIcon = () => {
    return getRiskIconComponent(analysis.riskLevel)
  }

  const getRiskBadgeVariant = () => {
    return RISK_BADGE_VARIANT_MAP[analysis.riskLevel] || 'secondary'
  }

  return (
    <div className='space-y-4'>
      {/* Risk Level Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          {getRiskIcon()}
          <span className='text-green-300 text-sm font-medium'>
            Risk Assessment
          </span>
        </div>
        <Badge variant={getRiskBadgeVariant()}>
          {analysis.riskLevel.toUpperCase()}
        </Badge>
      </div>

      {/* Analysis Summary */}
      <div className='bg-green-900/20 rounded-lg p-3'>
        <div className='mb-2 flex items-center gap-2'>
          <Brain className='text-green-400 h-4 w-4' />
          <span className='text-green-300 text-sm font-medium'>Analysis</span>
        </div>
        <p className='text-green-200 mb-2 text-xs'>{analysis.explanation}</p>
        <p className='text-green-300 text-xs'>
          Confidence: {Math.round(analysis.confidence * 100)}%
        </p>
      </div>

      {/* Emotions Detection */}
      {analysis.emotions && analysis.emotions.length > 0 && (
        <div className='bg-blue-900/20 rounded-lg p-3'>
          <div className='mb-2 flex items-center gap-2'>
            <Heart className='text-blue-400 h-4 w-4' />
            <span className='text-blue-300 text-sm font-medium'>
              Detected Emotions
            </span>
          </div>
          <div className='flex flex-wrap gap-1'>
            {analysis.emotions.map((emotion) => (
              <Badge
                key={emotion}
                variant='outline'
                className='border-blue-400 text-blue-300 text-xs'
              >
                {emotion}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Risk Factors */}
      {analysis.riskFactors && analysis.riskFactors.length > 0 && (
        <div className='bg-yellow-900/20 rounded-lg p-3'>
          <div className='mb-2 flex items-center gap-2'>
            <AlertTriangle className='text-yellow-400 h-4 w-4' />
            <span className='text-yellow-300 text-sm font-medium'>
              Risk Factors
            </span>
          </div>
          <ul className='text-yellow-200 space-y-1 text-xs'>
            {analysis.riskFactors.map((factor) => (
              <li key={factor} className='flex items-start gap-1'>
                <span className='text-yellow-400'>•</span>
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Supporting Evidence */}
      {analysis.supportingEvidence.length > 0 && (
        <div className='bg-purple-900/20 rounded-lg p-3'>
          <div className='mb-2 flex items-center gap-2'>
            <Zap className='text-purple-400 h-4 w-4' />
            <span className='text-purple-300 text-sm font-medium'>
              Supporting Evidence
            </span>
          </div>
          <ul className='text-purple-200 space-y-1 text-xs'>
            {analysis.supportingEvidence.map((evidence) => (
              <li key={evidence} className='flex items-start gap-1'>
                <span className='text-purple-400'>•</span>
                {evidence}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Expert Guidance Indicator */}
      {analysis.expertGuided && (
        <div className='bg-red-900/20 border-red-500/30 rounded-lg border p-3'>
          <div className='flex items-center gap-2'>
            <AlertTriangle className='text-red-400 h-4 w-4' />
            <span className='text-red-300 text-sm font-medium'>
              Expert Guidance Recommended
            </span>
          </div>
          <p className='text-red-200 mt-1 text-xs'>
            This case may require professional mental health intervention.
          </p>
        </div>
      )}

      {/* Metadata */}
      <div className='text-gray-400 border-green-700/30 border-t pt-2 text-xs'>
        <div className='flex justify-between'>
          <span>Category: {analysis.category}</span>
          <span>{new Date(analysis.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  )
}

export default MentalHealthInsights

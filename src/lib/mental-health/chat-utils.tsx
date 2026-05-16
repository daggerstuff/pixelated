import { Brain, Shield, ChartBar, AlertTriangle, Lightbulb } from 'lucide-react'
import React from 'react'

import type { MentalHealthAnalysisResult } from '@/lib/ai/mental-llama/types/mentalLLaMATypes'
import {
  type EnhancedMentalHealthAnalysis,
  type MindMirrorAnalysis,
} from '@/lib/mental-health/types'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  displayContent?: React.ReactNode
  timestamp: string
  mentalHealthAnalysis?: MentalHealthAnalysisResult
  isProcessing?: boolean
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  needsIntervention?: boolean
  apiResponse?: unknown
  metadata?: {
    responseType?: string
    confidence?: number
    copingStrategies?: unknown
    resources?: unknown
    processingTime?: number
  }
}

/**
 * Converts enhanced analysis to Mind Mirror format
 */
export const convertToMindMirrorAnalysis = (
  analysis: EnhancedMentalHealthAnalysis,
): MindMirrorAnalysis => {
  // Map severity levels to archetypes (must match keys in MindMirrorDashboard.tsx)
  const severityToArchetype: Record<string, string> = {
    low: 'wise_elder',
    medium: 'caregiver',
    high: 'wounded_healer',
    critical: 'wounded_healer',
  }

  let archetype = severityToArchetype[analysis.category] || 'visionary'

  // Determine energy and social connection based on explanation content
  const explanationLower = (analysis.explanation || '').toLowerCase()

  // Refine archetype based on specific indicators
  if (analysis.category === 'low') {
    if (
      explanationLower.includes('curiosity') ||
      explanationLower.includes('wonder')
    ) {
      archetype = 'inner_child'
    }
  } else if (analysis.category === 'medium') {
    if (
      explanationLower.includes('angry') ||
      explanationLower.includes('frustrated')
    ) {
      archetype = 'rebel_spirit'
    } else if (
      explanationLower.includes('analytical') ||
      explanationLower.includes('planning')
    ) {
      archetype = 'shadow_strategist'
    }
  }

  const isStressRelated =
    explanationLower.includes('stress') ||
    explanationLower.includes('overwhelm')
  const isSocialIsolationRelated =
    explanationLower.includes('isolation') ||
    explanationLower.includes('lonely') ||
    explanationLower.includes('social')

  return {
    archetype: {
      main_archetype: archetype,
      confidence: analysis.confidence || 0,
      color: '#45B7D1',
      description: analysis.explanation || 'Analysis completed',
    },
    mood_vector: {
      emotional_intensity:
        analysis.riskLevel === 'high'
          ? 0.8
          : analysis.riskLevel === 'medium'
            ? 0.6
            : 0.4,
      cognitive_clarity: analysis.confidence || 0,
      energy_level: isStressRelated ? 0.3 : 0.6,
      social_connection: isSocialIsolationRelated ? 0.2 : 0.7,
      coherence_index: analysis.confidence || 0,
      urgency_score:
        analysis.riskLevel === 'high'
          ? 0.9
          : analysis.riskLevel === 'medium'
            ? 0.6
            : 0.3,
    },
    timestamp: analysis.timestamp || Date.now(),
    session_id: 'chat_session',
    insights: analysis.supportingEvidence || [],
    recommendations: [],
  }
}

/**
 * Returns the initial welcome messages for the chat
 */
export const getInitialMessages = (): ChatMessage[] => [
  {
    id: 'welcome_msg',
    role: 'assistant',
    content: `Welcome to our Mental Health Chat powered by MentalLLaMA. I'm here to provide thoughtful, evidence-based support.

🧠 **Clinical-Grade Analysis**: Advanced AI analyzes your messages for mental health indicators
🔒 **Privacy-First**: All analysis uses encrypted processing - your data stays secure
📊 **Real-Time Insights**: Get immediate feedback on emotional patterns and trends
🚨 **Crisis Detection**: Automatic identification of urgent situations with immediate resources

How are you feeling today? I'm here to listen and help.`,
    displayContent: (
      <div className='space-y-3'>
        <p>
          Welcome to our Mental Health Chat powered by MentalLLaMA. I'm here to
          provide thoughtful, evidence-based support.
        </p>
        <div className='space-y-2 py-1'>
          <div className='flex items-center gap-2'>
            <Brain className='text-purple-600 h-4 w-4 shrink-0' />
            <p className='text-sm'>
              <strong>Clinical-Grade Analysis</strong>: Advanced AI analyzes
              your messages for mental health indicators
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <Shield className='text-blue-600 h-4 w-4 shrink-0' />
            <p className='text-sm'>
              <strong>Privacy-First</strong>: All analysis uses encrypted
              processing - your data stays secure
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <ChartBar className='text-indigo-600 h-4 w-4 shrink-0' />
            <p className='text-sm'>
              <strong>Real-Time Insights</strong>: Get immediate feedback on
              emotional patterns and trends
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <AlertTriangle className='text-red-600 h-4 w-4 shrink-0' />
            <p className='text-sm'>
              <strong>Crisis Detection</strong>: Automatic identification of
              urgent situations with immediate resources
            </p>
          </div>
        </div>
        <p>How are you feeling today? I'm here to listen and help.</p>
      </div>
    ),
    timestamp: new Date().toISOString(),
  },
]

/**
 * Creates a therapeutic intervention message
 */
export const createInterventionMessage = (
  id: string,
  intervention: string,
): ChatMessage => ({
  id,
  role: 'assistant',
  content: `**Therapeutic Intervention**\n\n${intervention}`,
  displayContent: (
    <div className='space-y-2'>
      <div className='text-amber-600 flex items-center gap-2'>
        <Lightbulb className='h-4 w-4' />
        <span className='font-bold'>Therapeutic Intervention</span>
      </div>
      <div className='mt-2'>
        {intervention.split('\n\n').map((para, i) => (
          <p key={i} className={i > 0 ? 'mt-2' : ''}>
            {para}
          </p>
        ))}
      </div>
    </div>
  ),
  timestamp: new Date().toISOString(),
})

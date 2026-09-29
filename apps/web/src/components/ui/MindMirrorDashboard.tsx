import { Brain, Heart, Zap, Shield, User } from 'lucide-react'
import { Activity, Eye, Sparkles, TrendingUp } from 'lucide-react'
import React, { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge/index'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card/index'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { MindMirrorAnalysis } from '@/lib/mental-health/types'

interface MindMirrorDashboardProps {
  analysis?: MindMirrorAnalysis
  isAnalyzing?: boolean
  className?: string
}

const ARCHETYPES = {
  wounded_healer: {
    name: 'Wounded Healer',
    icon: '🩹',
    description: 'Transforms pain into healing wisdom',
  },
  shadow_strategist: {
    name: 'Shadow Strategist',
    icon: 'target',
    description: 'Strategic thinker with deep analytical skills',
  },
  visionary: {
    name: 'Visionary',
    icon: '🔮',
    description: 'Future-focused creative innovator',
  },
  inner_child: {
    name: 'Inner Child',
    icon: '👶',
    description: 'Innocent wonder and emotional authenticity',
  },
  wise_elder: {
    name: 'Wise Elder',
    icon: '🧙',
    description: 'Experience-based guidance and wisdom',
  },
  rebel_spirit: {
    name: 'Rebel Spirit',
    icon: '⚡',
    description: 'Change agent with revolutionary energy',
  },
  caregiver: {
    name: 'Caregiver',
    icon: '💝',
    description: "Nurturing protector focused on others' wellbeing",
  },
}

type ArchetypeKey = keyof typeof ARCHETYPES
type ArchetypeInfo = (typeof ARCHETYPES)[ArchetypeKey]

export const MindMirrorDashboard: React.FC<MindMirrorDashboardProps> = ({
  analysis,
  isAnalyzing = false,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState('overview')

  const archetypeInfo = useMemo(() => {
    if (!analysis) {
      return null
    }
    const archetypeKey = analysis.archetype.main_archetype
      .toLowerCase()
      .replace(' ', '_')
    return (ARCHETYPES as Record<string, ArchetypeInfo>)[archetypeKey] ?? null
  }, [analysis?.archetype])

  const moodMetrics = useMemo(() => {
    if (!analysis?.mood_vector) {
      return []
    }

    const { mood_vector } = analysis
    return [
      {
        label: 'Emotional Intensity',
        value: mood_vector.emotional_intensity,
        icon: Heart,
      },
      {
        label: 'Cognitive Clarity',
        value: mood_vector.cognitive_clarity,
        icon: Brain,
      },
      {
        label: 'Energy Level',
        value: mood_vector.energy_level,
        icon: Zap,
      },
      {
        label: 'Social Connection',
        value: mood_vector.social_connection,
        icon: User,
      },
    ]
  }, [analysis?.mood_vector])

  if (isAnalyzing) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card className="border border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-3">
              <div className="h-8 w-8 animate-spin rounded-none border-b-2 border-ring"></div>
              <span className="text-lg font-medium text-foreground">
                🧠 Processing through AI...
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card className="border border-border">
          <CardContent className="p-8 text-center">
            <Brain className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium text-foreground">
              Ready for Analysis
            </h3>
            <p className="text-muted-foreground">
              Share your thoughts to see real-time psychological insights
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Archetype Card */}
      {archetypeInfo && (
        <Card className="overflow-hidden border border-border">
          <div className="bg-primary p-6 text-primary-foreground">
            <div className="flex items-center space-x-4">
              <div className="text-4xl">{archetypeInfo.icon}</div>
              <div className="flex-1">
                <h3 className="text-xl font-bold">{archetypeInfo.name}</h3>
                <p className="text-primary-foreground/90 text-sm">
                  {archetypeInfo.description}
                </p>
              </div>
              <Badge
                variant="secondary"
                className="bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground"
              >
                {Math.round(analysis.archetype.confidence * 100)}% confidence
              </Badge>
            </div>
          </div>
        </Card>
      )}

      {/* Mood Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        {moodMetrics.map((metric) => (
          <Card
            key={metric.label}
            className="border border-border transition-colors hover:border-ring"
          >
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="rounded-none border border-input bg-secondary p-2">
                  <metric.icon className="h-5 w-5 text-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {metric.label}
                  </p>
                  <div className="flex items-center space-x-2">
                    <div className="h-2 flex-1 rounded-none bg-secondary">
                      <div
                        className="h-2 rounded-none bg-primary"
                        style={{ width: `${metric.value * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-foreground">
                      {Math.round(metric.value * 100)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Analysis Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="recommendations">Guidance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Mental State Overview</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Coherence Index</span>
                <Badge
                  variant={
                    analysis.mood_vector.coherence_index > 0.7
                      ? 'default'
                      : 'secondary'
                  }
                >
                  {Math.round(analysis.mood_vector.coherence_index * 100)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Urgency Score</span>
                <Badge
                  variant={
                    analysis.mood_vector.urgency_score > 0.7
                      ? 'destructive'
                      : 'outline'
                  }
                >
                  {Math.round(analysis.mood_vector.urgency_score * 100)}%
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Eye className="h-5 w-5" />
                <span>AI Insights</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysis.insights.length > 0 ? (
                  analysis.insights.map((insight) => (
                    <div
                      key={insight}
                      className="flex items-start space-x-3 rounded-none border border-input bg-secondary p-3"
                    >
                      <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <p className="text-sm text-foreground">{insight}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    No specific insights available
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Personalized Guidance</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysis.recommendations.length > 0 ? (
                  analysis.recommendations.map((rec) => (
                    <div
                      key={rec}
                      className="flex items-start space-x-3 rounded-none border border-input bg-secondary p-3"
                    >
                      <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <p className="text-sm text-foreground">{rec}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    No specific recommendations available
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default MindMirrorDashboard

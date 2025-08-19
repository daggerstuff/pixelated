import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Brain,
  Heart,
  Zap,
  Shield,
  User
} from 'lucide-react'
import { Activity, Eye, Sparkles, TrendingUp } from 'lucide-react'

// Archetype definitions inspired by Mind-Mirror
export interface ArchetypeResult {
  main_archetype: string
  confidence: number
  secondary_archetype?: string
  color: string
  description: string
}

export interface MoodVector {
  emotional_intensity: number
  cognitive_clarity: number
  energy_level: number
  social_connection: number
  coherence_index: number
  urgency_score: number
}

export interface MindMirrorAnalysis {
  archetype: ArchetypeResult
  mood_vector: MoodVector
  timestamp: number
  session_id: string
  insights: string[]
  recommendations: string[]
}

interface MindMirrorDashboardProps {
  analysis?: MindMirrorAnalysis
  isAnalyzing?: boolean
  className?: string
}

const ARCHETYPES = {
  wounded_healer: {
    name: "Wounded Healer",
    icon: "🩹",
    color: "#FF6B6B",
    description: "Transforms pain into healing wisdom",
    gradient: "from-red-400 to-pink-500"
  },
  shadow_strategist: {
    name: "Shadow Strategist", 
    icon: "🎯",
    color: "#4ECDC4",
    description: "Strategic thinker with deep analytical skills",
    gradient: "from-teal-400 to-cyan-500"
  },
  visionary: {
    name: "Visionary",
    icon: "🔮",
    color: "#45B7D1", 
    description: "Future-focused creative innovator",
    gradient: "from-blue-400 to-indigo-500"
  },
  inner_child: {
    name: "Inner Child",
    icon: "👶",
    color: "#96CEB4",
    description: "Innocent wonder and emotional authenticity",
    gradient: "from-green-400 to-emerald-500"
  },
  wise_elder: {
    name: "Wise Elder",
    icon: "🧙",
    color: "#FECA57",
    description: "Experience-based guidance and wisdom",
    gradient: "from-yellow-400 to-orange-500"
  },
  rebel_spirit: {
    name: "Rebel Spirit",
    icon: "⚡",
    color: "#FF9FF3",
    description: "Change agent with revolutionary energy",
    gradient: "from-purple-400 to-pink-500"
  },
  caregiver: {
    name: "Caregiver",
    icon: "💝",
    color: "#54A0FF",
    description: "Nurturing protector focused on others' wellbeing",
    gradient: "from-blue-400 to-purple-500"
  }
}

export const MindMirrorDashboard: FC<MindMirrorDashboardProps> = ({
  analysis,
  isAnalyzing = false,
  className = ""
}) => {
  const [activeTab, setActiveTab] = useState("overview")
  
  const archetypeInfo = useMemo(() => {
    if (!analysis?.archetype) {
      return null
    }
    const archetypeKey = analysis.archetype.main_archetype.toLowerCase().replace(' ', '_')
    return ARCHETYPES[archetypeKey as keyof typeof ARCHETYPES] || null
  }, [analysis?.archetype])

  const moodMetrics = useMemo(() => {
    if (!analysis?.mood_vector) {
      return []
    }
    
    const { mood_vector } = analysis
    return [
      {
        label: "Emotional Intensity",
        value: mood_vector.emotional_intensity,
        icon: Heart,
        color: "text-red-500",
        bgColor: "bg-red-50"
      },
      {
        label: "Cognitive Clarity", 
        value: mood_vector.cognitive_clarity,
        icon: Brain,
        color: "text-blue-500",
        bgColor: "bg-blue-50"
      },
      {
        label: "Energy Level",
        value: mood_vector.energy_level,
        icon: Zap,
        color: "text-yellow-500", 
        bgColor: "bg-yellow-50"
      },
      {
        label: "Social Connection",
        value: mood_vector.social_connection,
        icon: User,
        color: "text-green-500",
        bgColor: "bg-green-50"
      }
    ]
  }, [analysis?.mood_vector])

  if (isAnalyzing) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <span className="text-lg font-medium text-gray-700">
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
        <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-50 to-slate-50">
          <CardContent className="p-8 text-center">
            <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              Ready for Analysis
            </h3>
            <p className="text-gray-500">
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
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className={`bg-gradient-to-r ${archetypeInfo.gradient} p-6 text-white`}>
            <div className="flex items-center space-x-4">
              <div className="text-4xl">{archetypeInfo.icon}</div>
              <div className="flex-1">
                <h3 className="text-xl font-bold">{archetypeInfo.name}</h3>
                <p className="text-white/90 text-sm">{archetypeInfo.description}</p>
              </div>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                {Math.round(analysis.archetype.confidence * 100)}% confidence
              </Badge>
            </div>
          </div>
        </Card>
      )}

      {/* Mood Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        {moodMetrics.map((metric) => (
          <Card key={metric.label} className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                  <metric.icon className={`h-5 w-5 ${metric.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full bg-gradient-to-r ${metric.color.replace('text-', 'from-')} to-opacity-60`}
                        style={{ width: `${metric.value * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-700">
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
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Mental State Overview</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Coherence Index</span>
                <Badge variant={analysis.mood_vector.coherence_index > 0.7 ? "default" : "secondary"}>
                  {Math.round(analysis.mood_vector.coherence_index * 100)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Urgency Score</span>
                <Badge variant={analysis.mood_vector.urgency_score > 0.7 ? "destructive" : "outline"}>
                  {Math.round(analysis.mood_vector.urgency_score * 100)}%
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Eye className="h-5 w-5" />
                <span>AI Insights</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysis.insights?.map((insight) => (
                  <div key={insight} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                    <Sparkles className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-700">{insight}</p>
                  </div>
                )) || (
                  <p className="text-sm text-gray-500 italic">No specific insights available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Personalized Guidance</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysis.recommendations?.map((rec) => (
                  <div key={rec} className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                    <Shield className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-700">{rec}</p>
                  </div>
                )) || (
                  <p className="text-sm text-gray-500 italic">No specific recommendations available</p>
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

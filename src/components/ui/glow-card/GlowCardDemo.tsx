import React from 'react'
import { MentalHealthCard } from '../mental-health-card'
import { Activity, Brain, Heart, TrendingUp } from 'lucide-react'

export default function GlowCardDemo() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-950 via-gray-900 to-black flex items-center justify-center p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl">
        <MentalHealthCard
          title="Mindfulness Session"
          description="Daily meditation and breathing exercises to reduce stress and improve focus"
          metric="Progress"
          metricValue="85%"
          status="active"
          icon={<Brain className="w-6 h-6 text-blue-400" />}
          glowColor="blue"
        />

        <MentalHealthCard
          title="Wellness Check-in"
          description="Track your emotional state and mental wellbeing throughout the day"
          metric="Streak"
          metricValue="12 days"
          status="completed"
          icon={<Heart className="w-6 h-6 text-purple-400" />}
          glowColor="purple"
        />

        <MentalHealthCard
          title="Activity Tracker"
          description="Monitor physical activity and its impact on your mental health"
          metric="Today"
          metricValue="8,432"
          status="active"
          icon={<Activity className="w-6 h-6 text-green-400" />}
          glowColor="green"
        />

        <MentalHealthCard
          title="Growth Insights"
          description="Analyze patterns and trends in your mental health journey"
          metric="Improvement"
          metricValue="+24%"
          status="pending"
          icon={<TrendingUp className="w-6 h-6 text-orange-400" />}
          glowColor="orange"
        />
      </div>
    </div>
  )
}

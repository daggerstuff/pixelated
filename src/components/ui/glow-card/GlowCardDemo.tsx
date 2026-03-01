import { Activity, Brain, Heart, TrendingUp } from 'lucide-react'
import React from 'react'

import { MentalHealthCard } from '../mental-health-card'

export default function GlowCardDemo() {
  return (
    <div className='from-gray-950 via-gray-900 to-black flex min-h-screen w-full items-center justify-center bg-gradient-to-br p-8'>
      <div className='grid max-w-7xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3'>
        <MentalHealthCard
          title='Mindfulness Session'
          description='Daily meditation and breathing exercises to reduce stress and improve focus'
          metric='Progress'
          metricValue='85%'
          status='active'
          icon={<Brain className='text-blue-400 h-6 w-6' />}
          glowColor='blue'
        />

        <MentalHealthCard
          title='Wellness Check-in'
          description='Track your emotional state and mental wellbeing throughout the day'
          metric='Streak'
          metricValue='12 days'
          status='completed'
          icon={<Heart className='text-purple-400 h-6 w-6' />}
          glowColor='purple'
        />

        <MentalHealthCard
          title='Activity Tracker'
          description='Monitor physical activity and its impact on your mental health'
          metric='Today'
          metricValue='8,432'
          status='active'
          icon={<Activity className='text-green-400 h-6 w-6' />}
          glowColor='green'
        />

        <MentalHealthCard
          title='Growth Insights'
          description='Analyze patterns and trends in your mental health journey'
          metric='Improvement'
          metricValue='+24%'
          status='pending'
          icon={<TrendingUp className='text-orange-400 h-6 w-6' />}
          glowColor='orange'
        />
      </div>
    </div>
  )
}

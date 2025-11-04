import React, { ReactNode } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GlowCard } from '../glow-card/GlowCard'

interface MentalHealthCardProps {
  title?: string
  description?: string
  metric?: string
  metricValue?: string
  status?: 'active' | 'completed' | 'pending'
  icon?: ReactNode
  glowColor?: 'blue' | 'purple' | 'green' | 'red' | 'orange'
}

const statusColors = {
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

export const MentalHealthCard: React.FC<MentalHealthCardProps> = ({
  title = 'Mindfulness Session',
  description = 'Daily meditation and breathing exercises to reduce stress and improve focus',
  metric = 'Progress',
  metricValue = '85%',
  status = 'active',
  icon = null,
  glowColor = 'blue',
}) => {
  return (
    <GlowCard glowColor={glowColor} className="w-full max-w-md">
      <div className="relative z-10 p-6 h-full flex flex-col">
        <div className="flex items-start justify-between mb-4">
          {icon && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              {icon}
            </div>
          )}
          <Badge
            variant="outline"
            className={`${statusColors[status]} backdrop-blur-sm font-medium text-xs uppercase tracking-wider`}
          >
            {status}
          </Badge>
        </div>

        <div className="flex-1 space-y-3">
          <h3 className="text-2xl font-semibold text-white tracking-tight leading-tight">
            {title}
          </h3>
          <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
        </div>

        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {metric}
            </span>
            <span className="text-2xl font-bold text-white tabular-nums">
              {metricValue}
            </span>
          </div>
        </div>
      </div>
    </GlowCard>
  )
}

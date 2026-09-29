import React, { ReactNode } from 'react'

// Card components not used - using GlowCard instead
import { Badge } from '@/components/ui/badge/index'

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
  active: 'border-ring bg-secondary font-medium text-foreground',
  completed: 'border-border bg-secondary text-foreground',
  pending: 'border-border bg-secondary text-muted-foreground',
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
      <div className="relative z-10 flex h-full flex-col p-6">
        <div className="mb-4 flex items-start justify-between">
          {icon && (
            <div className="bg-white/5 border-white/10 rounded-xl border p-3 backdrop-blur-sm">
              {icon}
            </div>
          )}
          <Badge
            variant="outline"
            className={`${statusColors[status]} text-xs font-medium uppercase tracking-wider backdrop-blur-sm`}
          >
            {status}
          </Badge>
        </div>

        <div className="flex-1 space-y-3">
          <h3 className="text-white text-2xl font-semibold leading-tight tracking-tight">
            {title}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>

        <div className="border-white/10 mt-6 border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {metric}
            </span>
            <span className="text-white text-2xl font-bold tabular-nums">
              {metricValue}
            </span>
          </div>
        </div>
      </div>
    </GlowCard>
  )
}

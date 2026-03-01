import React, { ReactNode } from 'react'

// Card components not used - using GlowCard instead
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
    <GlowCard glowColor={glowColor} className='w-full max-w-md'>
      <div className='relative z-10 flex h-full flex-col p-6'>
        <div className='mb-4 flex items-start justify-between'>
          {icon && (
            <div className='bg-white/5 border-white/10 rounded-xl border p-3 backdrop-blur-sm'>
              {icon}
            </div>
          )}
          <Badge
            variant='outline'
            className={`${statusColors[status]} text-xs font-medium uppercase tracking-wider backdrop-blur-sm`}
          >
            {status}
          </Badge>
        </div>

        <div className='flex-1 space-y-3'>
          <h3 className='text-white text-2xl font-semibold leading-tight tracking-tight'>
            {title}
          </h3>
          <p className='text-gray-400 text-sm leading-relaxed'>{description}</p>
        </div>

        <div className='border-white/10 mt-6 border-t pt-4'>
          <div className='flex items-center justify-between'>
            <span className='text-gray-500 text-xs font-medium uppercase tracking-wider'>
              {metric}
            </span>
            <span className='text-white text-2xl font-bold tabular-nums'>
              {metricValue}
            </span>
          </div>
        </div>
      </div>
    </GlowCard>
  )
}

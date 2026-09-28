import { ArrowTrendingUpIcon } from '@heroicons/react/24/outline'
import { FC, memo } from 'react'

import { FadeIn } from '@/components/layout/AdvancedAnimations'

interface ResearchMetrics {
  totalStudies: number
  activeStudies: number
  totalParticipants: number
  publications: number
  avgEffectSize: number
  dataQuality: number
}

interface MetricsGridProps {
  metrics: ResearchMetrics
}

const MetricsGrid: FC<MetricsGridProps> = memo(({ metrics }) => {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <FadeIn>
        <div className="rounded-none border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Studies
              </p>
              <p className="text-3xl font-bold text-foreground">
                {metrics.totalStudies}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-none bg-secondary">
              <span className="text-foreground">🔬</span>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {metrics.activeStudies} currently active
          </p>
        </div>
      </FadeIn>

      <FadeIn>
        <div className="rounded-none border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Participants
              </p>
              <p className="text-3xl font-bold text-foreground">
                {metrics.totalParticipants.toLocaleString()}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-none bg-secondary">
              <span className="text-foreground">👥</span>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Across all studies
          </p>
        </div>
      </FadeIn>

      <FadeIn>
        <div className="rounded-none border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Publications
              </p>
              <p className="text-3xl font-bold text-foreground">
                {metrics.publications}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-none bg-secondary">
              <span className="text-foreground">📚</span>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Peer-reviewed articles
          </p>
        </div>
      </FadeIn>

      <FadeIn>
        <div className="rounded-none border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Avg Effect Size
              </p>
              <p className="text-3xl font-bold text-foreground">
                {metrics.avgEffectSize}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-none bg-secondary">
              <span className="text-foreground">
                <ArrowTrendingUpIcon className="h-5 w-5" />
              </span>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Treatment effectiveness
          </p>
        </div>
      </FadeIn>
    </div>
  )
})

MetricsGrid.displayName = 'MetricsGrid'

export default MetricsGrid

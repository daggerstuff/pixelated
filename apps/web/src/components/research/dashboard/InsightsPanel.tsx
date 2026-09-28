import { LightBulbIcon } from '@heroicons/react/24/outline'
import { FC, memo } from 'react'

import { SlideUp } from '@/components/layout/AdvancedAnimations'

const InsightsPanel: FC = memo(() => {
  return (
    <SlideUp>
      <div className="h-full rounded-none border border-border bg-card p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <span>
            <LightBulbIcon className="h-5 w-5" />
          </span>
          Research Insights
        </h3>
        <div className="space-y-3">
          <div className="rounded-none border border-border bg-secondary p-3">
            <p className="font-medium text-foreground">
              AI Intervention Effectiveness
            </p>
            <p className="text-sm text-muted-foreground">
              +23% improvement in patient outcomes with AI assistance
            </p>
          </div>
          <div className="rounded-none border border-border bg-secondary p-3">
            <p className="font-medium text-foreground">
              Privacy Preservation Impact
            </p>
            <p className="text-sm text-muted-foreground">
              Federated learning maintains 94% data utility
            </p>
          </div>
          <div className="rounded-none border border-input bg-secondary p-3">
            <p className="font-medium text-foreground">Real-Time Processing</p>
            <p className="text-sm text-muted-foreground">
              Live interventions improve session effectiveness by 18%
            </p>
          </div>
        </div>
      </div>
    </SlideUp>
  )
})

InsightsPanel.displayName = 'InsightsPanel'

export default InsightsPanel

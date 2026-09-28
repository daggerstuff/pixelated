import { FC, memo } from 'react'

import { SlideUp } from '@/components/layout/AdvancedAnimations'

interface Milestone {
  title: string
  date: string
  priority: string
}

const MILESTONES: Milestone[] = [
  {
    title: 'AI Ethics Review',
    date: '2024-01-25',
    priority: 'high',
  },
  {
    title: 'Data Privacy Audit',
    date: '2024-02-01',
    priority: 'medium',
  },
  {
    title: 'Publication Deadline',
    date: '2024-02-15',
    priority: 'high',
  },
  {
    title: 'Conference Presentation',
    date: '2024-03-01',
    priority: 'medium',
  },
]

const UpcomingMilestones: FC = memo(() => {
  return (
    <SlideUp>
      <div className="h-full rounded-none border border-border bg-card p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <span>📋</span>
          Upcoming Milestones
        </h3>
        <div className="space-y-3">
          {MILESTONES.map((milestone, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-none bg-secondary p-3"
            >
              <div>
                <p className="font-medium text-foreground">{milestone.title}</p>
                <p className="text-sm text-muted-foreground">
                  {milestone.date}
                </p>
              </div>
              <span
                className={`rounded-none px-2 py-1 text-xs font-medium ${
                  milestone.priority === 'high'
                    ? 'border border-ring bg-secondary font-semibold text-foreground'
                    : 'border border-border bg-secondary text-muted-foreground'
                }`}
              >
                {milestone.priority}
              </span>
            </div>
          ))}
        </div>
      </div>
    </SlideUp>
  )
})

UpcomingMilestones.displayName = 'UpcomingMilestones'

export default UpcomingMilestones

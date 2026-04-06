import React, { FC, memo } from 'react'
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
      <div className='bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg border p-6 h-full'>
        <h3 className='mb-4 flex items-center gap-2 text-lg font-semibold'>
          <span>📋</span>
          Upcoming Milestones
        </h3>
        <div className='space-y-3'>
          {MILESTONES.map((milestone, index) => (
            <div
              key={index}
              className='bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between rounded-lg p-3'
            >
              <div>
                <p className='text-gray-900 dark:text-white font-medium'>
                  {milestone.title}
                </p>
                <p className='text-gray-600 dark:text-gray-400 text-sm'>
                  {milestone.date}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  milestone.priority === 'high'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
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

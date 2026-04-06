import React, { FC, memo } from 'react'
import { LightBulbIcon } from '@heroicons/react/24/outline'
import { SlideUp } from '@/components/layout/AdvancedAnimations'

const InsightsPanel: FC = memo(() => {
  return (
    <SlideUp>
      <div className='bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg border p-6 h-full'>
        <h3 className='mb-4 flex items-center gap-2 text-lg font-semibold'>
          <span><LightBulbIcon className="w-5 h-5" /></span>
          Research Insights
        </h3>
        <div className='space-y-3'>
          <div className='bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 rounded-lg border p-3'>
            <p className='text-purple-900 dark:text-purple-100 font-medium'>
              AI Intervention Effectiveness
            </p>
            <p className='text-purple-700 dark:text-purple-200 text-sm'>
              +23% improvement in patient outcomes with AI assistance
            </p>
          </div>
          <div className='bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 rounded-lg border p-3'>
            <p className='text-green-900 dark:text-green-100 font-medium'>
              Privacy Preservation Impact
            </p>
            <p className='text-green-700 dark:text-green-200 text-sm'>
              Federated learning maintains 94% data utility
            </p>
          </div>
          <div className='bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 rounded-lg border p-3'>
            <p className='text-blue-900 dark:text-blue-100 font-medium'>
              Real-Time Processing
            </p>
            <p className='text-blue-700 dark:text-blue-200 text-sm'>
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

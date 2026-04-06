import React, { FC, memo } from 'react'
import { ArrowTrendingUpIcon } from '@heroicons/react/24/outline'
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
    <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
      <FadeIn>
        <div className='bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg border p-6'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-gray-600 dark:text-gray-400 text-sm font-medium'>
                Total Studies
              </p>
              <p className='text-gray-900 dark:text-white text-3xl font-bold'>
                {metrics.totalStudies}
              </p>
            </div>
            <div className='bg-blue-100 dark:bg-blue-900/30 flex h-8 w-8 items-center justify-center rounded-lg'>
              <span className='text-blue-600 dark:text-blue-400'>🔬</span>
            </div>
          </div>
          <p className='text-gray-500 mt-2 text-sm'>
            {metrics.activeStudies} currently active
          </p>
        </div>
      </FadeIn>

      <FadeIn>
        <div className='bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg border p-6'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-gray-600 dark:text-gray-400 text-sm font-medium'>
                Participants
              </p>
              <p className='text-gray-900 dark:text-white text-3xl font-bold'>
                {metrics.totalParticipants.toLocaleString()}
              </p>
            </div>
            <div className='bg-green-100 dark:bg-green-900/30 flex h-8 w-8 items-center justify-center rounded-lg'>
              <span className='text-green-600 dark:text-green-400'>👥</span>
            </div>
          </div>
          <p className='text-gray-500 mt-2 text-sm'>Across all studies</p>
        </div>
      </FadeIn>

      <FadeIn>
        <div className='bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg border p-6'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-gray-600 dark:text-gray-400 text-sm font-medium'>
                Publications
              </p>
              <p className='text-gray-900 dark:text-white text-3xl font-bold'>
                {metrics.publications}
              </p>
            </div>
            <div className='bg-purple-100 dark:bg-purple-900/30 flex h-8 w-8 items-center justify-center rounded-lg'>
              <span className='text-purple-600 dark:text-purple-400'>📚</span>
            </div>
          </div>
          <p className='text-gray-500 mt-2 text-sm'>Peer-reviewed articles</p>
        </div>
      </FadeIn>

      <FadeIn>
        <div className='bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg border p-6'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-gray-600 dark:text-gray-400 text-sm font-medium'>
                Avg Effect Size
              </p>
              <p className='text-gray-900 dark:text-white text-3xl font-bold'>
                {metrics.avgEffectSize}
              </p>
            </div>
            <div className='bg-yellow-100 dark:bg-yellow-900/30 flex h-8 w-8 items-center justify-center rounded-lg'>
              <span className='text-yellow-600 dark:text-yellow-400'>
                <ArrowTrendingUpIcon className='h-5 w-5' />
              </span>
            </div>
          </div>
          <p className='text-gray-500 mt-2 text-sm'>Treatment effectiveness</p>
        </div>
      </FadeIn>
    </div>
  )
})

MetricsGrid.displayName = 'MetricsGrid'

export default MetricsGrid

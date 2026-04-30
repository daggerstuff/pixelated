import React, { FC, memo } from 'react'

import { SlideUp } from '@/components/layout/AdvancedAnimations'

interface ResearchStudy {
  id: string
  title: string
  description: string
  status: 'planning' | 'active' | 'completed' | 'published'
  participants: number
  startDate: Date
  endDate?: Date
  methodology: string
  outcomes: string[]
}

interface ActiveStudiesListProps {
  studies: ResearchStudy[]
  selectedStudies: string[]
  onStudySelect: (studyId: string) => void
}

const ActiveStudiesList: FC<ActiveStudiesListProps> = memo(
  ({ studies, selectedStudies, onStudySelect }) => {
    const activeStudies = studies.filter((study) => study.status === 'active')

    return (
      <SlideUp>
        <div className='bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg border p-6'>
          <h3 className='mb-4 text-lg font-semibold'>
            Active Research Studies
          </h3>
          <div className='space-y-4'>
            {activeStudies.map((study) => (
              <div
                key={study.id}
                className='bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 flex items-center gap-4 rounded-lg border p-4'
              >
                <input
                  type='checkbox'
                  aria-label={"Select study " + study.title}
                  checked={selectedStudies.includes(study.id)}
                  onChange={() => onStudySelect(study.id)}
                  className='text-blue-600 h-4 w-4 rounded'
                />
                <div className='flex-1'>
                  <div className='mb-2 flex items-center justify-between'>
                    <p className='text-gray-900 dark:text-white font-medium'>
                      {study.title}
                    </p>
                    <span className='bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 rounded-full px-2 py-1 text-xs font-medium'>
                      {study.status}
                    </span>
                  </div>
                  <p className='text-gray-600 dark:text-gray-400 mb-2 text-sm'>
                    {study.description}
                  </p>
                  <div className='flex items-center gap-4 text-sm'>
                    <span>Participants: {study.participants}</span>
                    <span>Methodology: {study.methodology}</span>
                    <span>Started: {study.startDate.toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
            {activeStudies.length === 0 && (
              <p className='text-gray-500 py-4 text-center italic'>
                No active studies found.
              </p>
            )}
          </div>
        </div>
      </SlideUp>
    )
  },
)

ActiveStudiesList.displayName = 'ActiveStudiesList'

export default ActiveStudiesList

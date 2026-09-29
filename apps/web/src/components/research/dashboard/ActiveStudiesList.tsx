import { FC, memo } from 'react'

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
        <div className="rounded-none border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">
            Active Research Studies
          </h3>
          <div className="space-y-4">
            {activeStudies.map((study) => (
              <div
                key={study.id}
                className="flex items-center gap-4 rounded-none border border-input bg-secondary p-4"
              >
                <input
                  type="checkbox"
                  aria-label={'Select study ' + study.title}
                  checked={selectedStudies.includes(study.id)}
                  onChange={() => onStudySelect(study.id)}
                  className="h-4 w-4 rounded-none accent-primary"
                />
                <div className="flex-1">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium text-foreground">{study.title}</p>
                    <span className="rounded-none border border-border bg-secondary px-2 py-1 text-xs font-medium text-foreground">
                      {study.status}
                    </span>
                  </div>
                  <p className="mb-2 text-sm text-muted-foreground">
                    {study.description}
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span>Participants: {study.participants}</span>
                    <span>Methodology: {study.methodology}</span>
                    <span>Started: {study.startDate.toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
            {activeStudies.length === 0 && (
              <p className="py-4 text-center italic text-muted-foreground">
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

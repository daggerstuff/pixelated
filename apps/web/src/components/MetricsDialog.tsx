import { useAnonymizedMetrics } from '@/simulator'

interface MetricsDialogProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Text configuration for MetricsDialog.
 * Facilitates future i18n implementation and centralizes user-facing strings.
 */
const TEXT = {
  title: 'Practice Progress',
  closeAriaLabel: 'Close dialog',
  closeButton: 'Close',
  overview: 'Overview',
  totalSessions: 'Total Sessions',
  averageScore: 'Average Score',
  skillsBreakdown: 'Skills Breakdown',
  skillsImproving: 'Skills Improving',
  skillsNeedingFocus: 'Skills Needing Focus',
  noProgressYet: 'Complete more practice sessions to see progress',
  keepPracticing: 'Keep practicing to identify areas for improvement',
}

/**
 * Dialog component to display anonymized metrics from practice sessions
 * Only shows data that has been anonymized and collected with user consent
 */
export function MetricsDialog({ isOpen, onClose }: MetricsDialogProps) {
  const metrics = useAnonymizedMetrics()

  if (!isOpen) {
    return null
  }

  return (
    <div className="bg-foreground/60 fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div className="relative w-full max-w-md rounded-none border border-border bg-card p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
          aria-label={TEXT.closeAriaLabel}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <h3 className="mb-6 text-xl font-semibold">{TEXT.title}</h3>

        <div className="space-y-6">
          <div>
            <h4 className="text-md mb-2 font-medium">{TEXT.overview}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-none bg-secondary p-3">
                <p className="text-xs text-muted-foreground">
                  {TEXT.totalSessions}
                </p>
                <p className="text-2xl font-bold">{metrics.sessionCount}</p>
              </div>
              <div className="rounded-none bg-secondary p-3">
                <p className="text-xs text-muted-foreground">
                  {TEXT.averageScore}
                </p>
                <p className="text-2xl font-bold">{metrics.averageScore}%</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-md mb-2 font-medium">{TEXT.skillsBreakdown}</h4>
            <div className="space-y-2">
              <div>
                <p className="mb-1 text-sm font-medium">
                  {TEXT.skillsImproving}
                </p>
                {metrics.skillsImproving.length > 0 ? (
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {metrics.skillsImproving.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    {TEXT.noProgressYet}
                  </p>
                )}
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">
                  {TEXT.skillsNeedingFocus}
                </p>
                {metrics.skillsNeeding.length > 0 ? (
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {metrics.skillsNeeding.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    {TEXT.keepPracticing}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={onClose}
            className="hover:bg-primary/90 rounded-none bg-primary px-4 py-2 text-primary-foreground"
          >
            {TEXT.closeButton}
          </button>
        </div>
      </div>
    </div>
  )
}

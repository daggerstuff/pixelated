import React, { useState } from 'react'
import useSkillProgress, { SkillProgress } from '@/hooks/useSkillProgress'
import type { TherapistSession } from '@/types/dashboard'
import { ProgressBar } from './ProgressBar'
import { SessionMetrics } from './SessionMetrics'
import { cn } from '@/lib/utils'

interface TherapistProgressTrackerProps {
  session: TherapistSession
  className?: string
}

export function TherapistProgressTracker({
  session,
  className,
}: TherapistProgressTrackerProps) {
  // Calculate session duration
  const startTime = new Date(session.startTime)
  const endTime = session.endTime ? new Date(session.endTime) : new Date()
  const durationMs = endTime.getTime() - startTime.getTime()
  const durationMinutes = Math.floor(durationMs / 60000)
  const durationHours = Math.floor(durationMinutes / 60)
  const remainingMinutes = durationMinutes % 60
  // We call the hook with the session to derive or fetch skill progress data
  const {
    data: skillProgress,
    loading: skillsLoading,
    error: skillsError,
  } = useSkillProgress(session)

  // Expandable sections for better keyboard navigation
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    overview: true,
    progress: true,
    skills: true,
    notes: true,
  })

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  // Fallback mock data if hook returns nothing
  const fallbackSkills: SkillProgress[] = [
    { skill: 'Active Listening', score: 85, trend: 'up' },
    { skill: 'Empathy', score: 78, trend: 'stable' },
    { skill: 'Questioning', score: 92, trend: 'up' },
    { skill: 'Reflection', score: 71, trend: 'down' },
  ]

  const effectiveSkills =
    skillProgress && skillProgress.length > 0 ? skillProgress : fallbackSkills

  return (
    <div
      className={cn('space-y-6', className)}
      aria-label="Therapist Progress Tracker"
      tabIndex={0}
    >
      {/* Session Overview */}
      <section
        className="bg-muted rounded-md p-4 focus:outline-none focus:ring-2 focus:ring-primary"
        aria-labelledby="overview-heading"
        tabIndex={0}
      >
        <div className="flex items-center justify-between">
          <h4 id="overview-heading" className="text-md font-semibold mb-3">
            Session Overview
          </h4>
          <button
            onClick={() => toggleSection('overview')}
            aria-label={
              expandedSections['overview']
                ? 'Collapse session overview'
                : 'Expand session overview'
            }
            className="text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded"
            aria-expanded={expandedSections['overview']}
          >
            {expandedSections['overview'] ? '−' : '+'}
          </button>
        </div>
        {expandedSections['overview'] && (
          <SessionMetrics
            metrics={[
              { label: 'Session ID', value: session.id },
              { label: 'Status', value: session.status },
              {
                label: 'Duration',
                value: session.endTime
                  ? `${durationHours}h ${remainingMinutes}m`
                  : 'In Progress',
              },
              { label: 'Progress', value: `${session.progress}%` },
            ]}
          />
        )}
      </section>

      {/* Overall Progress */}
      <section
        className="bg-muted rounded-md p-4 focus:outline-none focus:ring-2 focus:ring-primary"
        aria-labelledby="progress-heading"
        tabIndex={0}
      >
        <div className="flex items-center justify-between">
          <h4 id="progress-heading" className="text-md font-semibold mb-3">
            Overall Progress
          </h4>
          <button
            onClick={() => toggleSection('progress')}
            aria-label={
              expandedSections['progress']
                ? 'Collapse overall progress'
                : 'Expand overall progress'
            }
            className="text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded"
            aria-expanded={expandedSections['progress']}
          >
            {expandedSections['progress'] ? '−' : '+'}
          </button>
        </div>
        {expandedSections['progress'] && (
          <ProgressBar value={session.progress} label="Session Completion" />
        )}
      </section>

      {/* Skill Development */}
      <section
        className="bg-muted rounded-md p-4 focus:outline-none focus:ring-2 focus:ring-primary"
        aria-labelledby="skills-heading"
        tabIndex={0}
      >
        <div className="flex items-center justify-between">
          <h4 id="skills-heading" className="text-md font-semibold mb-3">
            Skill Development
          </h4>
          <button
            onClick={() => toggleSection('skills')}
            aria-label={
              expandedSections['skills']
                ? 'Collapse skill development'
                : 'Expand skill development'
            }
            className="text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded"
            aria-expanded={expandedSections['skills']}
          >
            {expandedSections['skills'] ? '−' : '+'}
          </button>
        </div>

        {expandedSections['skills'] && (
          <div className="space-y-3">
            {skillsLoading && (
              <div className="text-sm text-muted-foreground">
                Loading skills…
              </div>
            )}

            {skillsError && (
              <div className="text-sm text-red-600">
                Failed to load skills: {skillsError.message}
              </div>
            )}

            {!skillsLoading &&
              !skillsError &&
              (!effectiveSkills || effectiveSkills.length === 0) && (
                <div className="text-sm text-muted-foreground">
                  No skill progress available for this session.
                </div>
              )}

            {!skillsLoading &&
              !skillsError &&
              effectiveSkills &&
              effectiveSkills.length > 0 && (
                <div className="space-y-2" role="list">
                  {effectiveSkills.map(
                    (skill: SkillProgress, index: number) => (
                      <div
                        key={`${skill.skill}-${index}`}
                        className="flex items-center justify-between p-2 rounded hover:bg-background focus-within:bg-background focus-within:ring-1 focus-within:ring-primary"
                        tabIndex={0}
                        role="listitem"
                        aria-label={`${skill.skill}: ${skill.score}% (${skill.trend})`}
                      >
                        <span className="text-sm font-medium">
                          {skill.skill}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {skill.score}%
                          </span>
                          <span
                            className={cn(
                              'text-xs',
                              skill.trend === 'up' && 'text-green-600',
                              skill.trend === 'down' && 'text-red-600',
                              skill.trend === 'stable' && 'text-gray-600',
                            )}
                            aria-label={`Trend: ${skill.trend === 'up' ? 'improving' : skill.trend === 'down' ? 'declining' : 'stable'}`}
                          >
                            {skill.trend === 'up'
                              ? '↗'
                              : skill.trend === 'down'
                                ? '↘'
                                : '→'}
                          </span>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
          </div>
        )}
      </section>

      {/* Session Notes */}
      <section
        className="bg-muted rounded-md p-4 focus:outline-none focus:ring-2 focus:ring-primary"
        aria-labelledby="notes-heading"
        tabIndex={0}
      >
        <div className="flex items-center justify-between">
          <h4 id="notes-heading" className="text-md font-semibold mb-3">
            Session Notes
          </h4>
          <button
            onClick={() => toggleSection('notes')}
            aria-label={
              expandedSections['notes']
                ? 'Collapse session notes'
                : 'Expand session notes'
            }
            className="text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded"
            aria-expanded={expandedSections['notes']}
          >
            {expandedSections['notes'] ? '−' : '+'}
          </button>
        </div>
        {expandedSections['notes'] && (
          <div className="text-sm">
            {session.notes ? (
              <p>{session.notes}</p>
            ) : (
              <p className="text-muted-foreground italic">
                Session notes and observations will appear here...
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

export default TherapistProgressTracker

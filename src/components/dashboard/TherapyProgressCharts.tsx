import React from 'react'
import type { TherapistAnalyticsChartData } from '@/types/analytics'
import { cn } from '@/lib/utils'

interface TherapyProgressChartsProps {
  data: TherapistAnalyticsChartData
  className?: string
  /** Optional locale string (e.g. 'en-US'). If omitted, will use the user's default locale. */
  locale?: string
}

// Session Progress Timeline Chart
interface SessionProgressTimelineProps {
  sessions: TherapistAnalyticsChartData['sessionMetrics']
}

const SessionProgressTimeline: React.FC<
  SessionProgressTimelineProps & { locale?: string }
> = ({ sessions, locale }) => {
  if (sessions.length === 0) {
    return (
      <div className="bg-muted rounded-md p-4 text-center text-muted-foreground">
        No session data available
      </div>
    )
  }

  const sorted = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )
  const values = sorted.map((s) => s.averageSessionProgress ?? 0)
  const max = Math.max(...values, 1)
  const df = new Intl.DateTimeFormat(
    locale ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-US'),
    { month: 'short', day: 'numeric' },
  )

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Session Progress Timeline</h3>
      <div className="flex items-end space-x-2 h-32">
        {sorted.map((s, i) => (
          <div
            key={String(s.sessionId)}
            className="flex-1 flex flex-col items-center"
          >
            <div
              className="bg-blue-600 w-full rounded-t transition-all duration-300 hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus:outline-none"
              style={{
                // guard against undefined just in case
                height: `${((values[i] ?? 0) / max) * 100}%`,
                minHeight: '4px',
              }}
              title={`Session ${s.sessionId}: ${values[i] ?? 0}% progress`}
              tabIndex={0}
              role="presentation"
              aria-label={`Session ${s.sessionId}: ${values[i] ?? 0}% progress`}
            />
            <span className="text-xs mt-2 text-gray-600">
              {df.format(new Date(s.date))}
            </span>
            <span className="text-xs text-gray-500">{values[i] ?? 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const SkillDevelopmentRadar: React.FC<{
  skills?: TherapistAnalyticsChartData['skillProgress']
}> = ({ skills = [] }) => {
  if (!skills || skills.length === 0)
    return (
      <div className="bg-muted rounded-md p-4 text-center text-muted-foreground">
        No skill data available
      </div>
    )

  const top = [...skills]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 6)

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Skill Development Radar</h3>
      <div className="relative w-64 h-64 mx-auto">
        <div className="absolute inset-0">
          {[0, 25, 50, 75, 100].map((level) => (
            <div
              key={level}
              className="absolute border border-gray-200 rounded-full"
              style={{
                width: `${level}%`,
                height: `${level}%`,
                top: `${(100 - level) / 2}%`,
                left: `${(100 - level) / 2}%`,
              }}
            />
          ))}
        </div>

        {top.map((t, idx) => {
          const angle = (idx * 360) / top.length
          const r = ((t.score ?? 0) / 100) * 50
          const x = 50 + r * Math.cos(((angle - 90) * Math.PI) / 180)
          const y = 50 + r * Math.sin(((angle - 90) * Math.PI) / 180)
          return (
            <div
              key={t.skillId}
              className="absolute w-2 h-2 bg-blue-500 rounded-full"
              style={{ left: `${x}%`, top: `${y}%` }}
              title={`${t.skill}: ${t.score ?? 0}%`}
            />
          )
        })}

        {top.map((t, idx) => {
          const angle = (idx * 360) / top.length
          const x = 50 + 55 * Math.cos(((angle - 90) * Math.PI) / 180)
          const y = 50 + 55 * Math.sin(((angle - 90) * Math.PI) / 180)
          return (
            <div
              key={`label-${t.skillId}`}
              className="absolute text-xs text-gray-600 transform -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {t.skill}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const SessionComparison: React.FC<{
  comparativeData?: TherapistAnalyticsChartData['comparativeData']
}> = ({ comparativeData }) => {
  if (!comparativeData)
    return (
      <div className="bg-muted rounded-md p-4 text-center text-muted-foreground">
        Not enough session data for comparison
      </div>
    )
  const { currentSession, previousSession, trend } = comparativeData
  if (!previousSession)
    return (
      <div className="bg-muted rounded-md p-4 text-center text-muted-foreground">
        Previous session data not available
      </div>
    )
  if (!currentSession)
    return (
      <div className="bg-muted rounded-md p-4 text-center text-muted-foreground">
        Current session data not available
      </div>
    )

  const items = [
    {
      label: 'Progress',
      current: currentSession.averageSessionProgress ?? 0,
      previous: previousSession.averageSessionProgress ?? 0,
      unit: '%',
    },
    {
      label: 'Response Time',
      current: currentSession.averageResponseTime ?? 0,
      previous: previousSession.averageResponseTime ?? 0,
      unit: 's',
    },
    {
      label: 'Milestones',
      current: currentSession.milestonesAchieved ?? 0,
      previous: previousSession.milestonesAchieved ?? 0,
      unit: '',
    },
  ]

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Session Comparison</h3>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm">
          <div className="font-medium">Current Session</div>
          <div className="text-muted-foreground">
            {String(currentSession.sessionId)}
          </div>
        </div>
        <div
          className={cn(
            'px-3 py-1 rounded-full text-sm font-medium',
            trend === 'improving'
              ? 'bg-green-100 text-green-800'
              : trend === 'declining'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800',
          )}
        >
          {trend === 'improving'
            ? '↗ Improving'
            : trend === 'declining'
              ? '↘ Declining'
              : '→ Stable'}
        </div>
        <div className="text-sm text-right">
          <div className="font-medium">Previous Session</div>
          <div className="text-muted-foreground">
            {String(previousSession.sessionId)}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((it, idx) => {
          const diff = (it.current ?? 0) - (it.previous ?? 0)
          return (
            <div key={idx} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{it.label}</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">
                  {it.current}
                  {it.unit}
                </span>
                <span
                  className={cn(
                    'text-xs px-2 py-1 rounded',
                    diff > 0
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800',
                  )}
                >
                  {diff > 0 ? '+' : ''}
                  {diff.toFixed(1)}
                  {it.unit}
                </span>
                <span className="text-sm text-muted-foreground">
                  {it.previous}
                  {it.unit}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const SkillImprovementTimeline: React.FC<{
  skills?: TherapistAnalyticsChartData['skillProgress']
}> = ({ skills = [] }) => {
  if (!skills || skills.length === 0)
    return (
      <div className="bg-muted rounded-md p-4 text-center text-muted-foreground">
        No skill improvement data available
      </div>
    )
  const sorted = [...skills].sort(
    (a, b) => (b.sessionsPracticed ?? 0) - (a.sessionsPracticed ?? 0),
  )

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Skill Practice Timeline</h3>
      <div className="space-y-3">
        {sorted.slice(0, 5).map((skill) => (
          <div
            key={skill.skillId}
            className="flex items-center justify-between"
          >
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{skill.skill}</span>
                <span className="text-sm text-muted-foreground">
                  {skill.score ?? 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all duration-500',
                    skill.trend === 'up'
                      ? 'bg-green-500'
                      : skill.trend === 'down'
                        ? 'bg-red-500'
                        : 'bg-blue-500',
                  )}
                  style={{ width: `${skill.score ?? 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">
                  {skill.sessionsPracticed ?? 0} sessions
                </span>
                <span
                  className={cn(
                    'text-xs',
                    skill.trend === 'up'
                      ? 'text-green-600'
                      : skill.trend === 'down'
                        ? 'text-red-600'
                        : 'text-gray-600',
                  )}
                >
                  {skill.trend === 'up'
                    ? '↗'
                    : skill.trend === 'down'
                      ? '↘'
                      : '→'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TherapyProgressCharts({
  data,
  className,
  locale,
}: TherapyProgressChartsProps) {
  return (
    <div
      className={cn('space-y-6', className)}
      aria-label="Therapy Progress Charts"
    >
      <SessionProgressTimeline sessions={data.sessionMetrics} locale={locale} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SkillDevelopmentRadar skills={data.skillProgress} />
        <SessionComparison comparativeData={data.comparativeData} />
      </div>
      <SkillImprovementTimeline skills={data.skillProgress} />
    </div>
  )
}

export default TherapyProgressCharts

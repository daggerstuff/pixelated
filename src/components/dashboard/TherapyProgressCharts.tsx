import React from "react";
import type { TherapistAnalyticsChartData } from "@/types/analytics";
import { cn } from "@/lib/utils";

interface TherapyProgressChartsProps {
  data: TherapistAnalyticsChartData;
  className?: string;
  /** Optional locale string (e.g. 'en-US'). If omitted, will use the user's default locale. */
  locale?: string;
}

// Session Progress Timeline Chart
interface SessionProgressTimelineProps {
  sessions: TherapistAnalyticsChartData['sessionMetrics'];
}

const SessionProgressTimeline: React.FC<SessionProgressTimelineProps & { locale?: string }> = ({ sessions, locale }) => {
  if (sessions.length === 0) {
    return (
      <div className="bg-muted rounded-md p-4 text-center text-muted-foreground">
        No session data available
      </div>
    );
  }

  // Sort sessions by date
  const sortedSessions = [...sessions].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Get progress values for chart
  const progressValues = sortedSessions.map(session => session.averageSessionProgress ?? 0);
  const maxProgress = Math.max(...progressValues, 1);

  const dateFormatter = new Intl.DateTimeFormat(locale ?? (typeof navigator !== 'undefined' ? navigator.language : undefined), { month: 'short', day: 'numeric' });

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Session Progress Timeline</h3>
      <div className="flex items-end space-x-2 h-32">
        {sortedSessions.map((session, index) => (
          <div key={session.sessionId} className="flex-1 flex flex-col items-center">
            <div
              className="bg-blue-600 w-full rounded-t transition-all duration-300 hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus:outline-none"
              style={{
                // guard against undefined just in case
                height: `${((progressValues[index] ?? 0) / maxProgress) * 100}%`,
                minHeight: '4px'
              }}
              title={`Session ${session.sessionId.slice(0, 8)}: ${progressValues[index] ?? 0}% progress`}
              tabIndex={0}
              role="presentation"
              aria-label={`Session ${session.sessionId.slice(0, 8)}: ${progressValues[index] ?? 0}% progress`}
            />
            <span className="text-xs mt-2 text-gray-600">
              {dateFormatter.format(new Date(session.date))}
            </span>
            <span className="text-xs text-gray-500">{progressValues[index] ?? 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Skill Development Radar Chart
interface SkillDevelopmentRadarProps {
  skills: TherapistAnalyticsChartData['skillProgress'];
}

const SkillDevelopmentRadar: React.FC<SkillDevelopmentRadarProps> = ({ skills }) => {
  if (skills.length === 0) {
    return (
      <div className="bg-muted rounded-md p-4 text-center text-muted-foreground">
        No skill data available
      </div>
    );
  }

  // Get top 6 skills for radar chart
  const topSkills = [...skills]
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Skill Development Radar</h3>
      <div className="relative w-64 h-64 mx-auto">
        {/* Radar grid */}
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

        {/* Skill points */}
        {topSkills.map((skill, index) => {
          const angle = (index * 360) / topSkills.length;
          const radius = (skill.score / 100) * 50; // 50% of container radius
          const x = 50 + radius * Math.cos((angle - 90) * Math.PI / 180);
          const y = 50 + radius * Math.sin((angle - 90) * Math.PI / 180);

          return (
            <div
              key={skill.skillId}
              className="absolute w-2 h-2 bg-blue-500 rounded-full transform -translate-x-1 -translate-y-1"
              style={{
                left: `${x}%`,
                top: `${y}%`,
              }}
              title={`${skill.skill}: ${skill.score}%`}
            />
          );
        })}

        {/* Skill labels */}
        {topSkills.map((skill, index) => {
          const angle = (index * 360) / topSkills.length;
          const x = 50 + 55 * Math.cos((angle - 90) * Math.PI / 180);
          const y = 50 + 55 * Math.sin((angle - 90) * Math.PI / 180);

          return (
            <div
              key={`label-${skill.skillId}`}
              className="absolute text-xs text-gray-600 transform -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${x}%`,
                top: `${y}%`,
              }}
            >
              {skill.skill}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Session Comparison Chart
interface SessionComparisonProps {
  comparativeData?: TherapistAnalyticsChartData['comparativeData'];
}

const SessionComparison: React.FC<SessionComparisonProps> = ({ comparativeData }) => {
  if (!comparativeData) {
    return (
      <div className="bg-muted rounded-md p-4 text-center text-muted-foreground">
        Not enough session data for comparison
      </div>
    );
  }

  const { currentSession, previousSession, trend } = comparativeData;

  if (!previousSession) {
    return (
      <div className="bg-muted rounded-md p-4 text-center text-muted-foreground">
        Previous session data not available
      </div>
    );
  }

  const improvements = [
    {
      label: 'Progress',
      current: currentSession.averageSessionProgress || 0,
      previous: previousSession.averageSessionProgress || 0,
      unit: '%'
    },
    {
      label: 'Response Time',
      current: currentSession.averageResponseTime || 0,
      previous: previousSession.averageResponseTime || 0,
      unit: 's'
    },
    {
      label: 'Milestones',
      current: currentSession.milestonesAchieved || 0,
      previous: previousSession.milestonesAchieved || 0,
      unit: ''
    }
  ];

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Session Comparison</h3>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm">
          <div className="font-medium">Current Session</div>
          <div className="text-muted-foreground">{currentSession.sessionId.slice(0, 8)}</div>
        </div>
        <div className={cn(
          "px-3 py-1 rounded-full text-sm font-medium",
          trend === 'improving' && "bg-green-100 text-green-800",
          trend === 'declining' && "bg-red-100 text-red-800",
          trend === 'stable' && "bg-gray-100 text-gray-800"
        )}>
          {trend === 'improving' ? '↗ Improving' : trend === 'declining' ? '↘ Declining' : '→ Stable'}
        </div>
        <div className="text-sm text-right">
          <div className="font-medium">Previous Session</div>
          <div className="text-muted-foreground">{previousSession.sessionId.slice(0, 8)}</div>
        </div>
      </div>

      <div className="space-y-3">
        {improvements.map((item, index) => {
          const difference = item.current - item.previous;
          const isImprovement = difference > 0;

          return (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{item.label}</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">{item.current}{item.unit}</span>
                <span className={cn(
                  "text-xs px-2 py-1 rounded",
                  isImprovement ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                )}>
                  {isImprovement ? '+' : ''}{difference.toFixed(1)}{item.unit}
                </span>
                <span className="text-sm text-muted-foreground">{item.previous}{item.unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Skill Improvement Timeline
interface SkillImprovementTimelineProps {
  skills: TherapistAnalyticsChartData['skillProgress'];
}

const SkillImprovementTimeline: React.FC<SkillImprovementTimelineProps> = ({ skills }) => {
  if (skills.length === 0) {
    return (
      <div className="bg-muted rounded-md p-4 text-center text-muted-foreground">
        No skill improvement data available
      </div>
    );
  }

  // Sort by sessions practiced
  const sortedSkills = [...skills].sort((a, b) =>
    (b.sessionsPracticed || 0) - (a.sessionsPracticed || 0)
  );

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Skill Practice Timeline</h3>
      <div className="space-y-3">
        {sortedSkills.slice(0, 5).map((skill) => (
          <div key={skill.skillId} className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{skill.skill}</span>
                <span className="text-sm text-muted-foreground">{skill.score}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all duration-500",
                    skill.trend === 'up' && "bg-green-500",
                    skill.trend === 'down' && "bg-red-500",
                    skill.trend === 'stable' && "bg-blue-500"
                  )}
                  style={{ width: `${skill.score}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">
                  {skill.sessionsPracticed || 0} sessions
                </span>
                <span className={cn(
                  "text-xs",
                  skill.trend === 'up' && "text-green-600",
                  skill.trend === 'down' && "text-red-600",
                  skill.trend === 'stable' && "text-gray-600"
                )}>
                  {skill.trend === 'up' ? '↗' : skill.trend === 'down' ? '↘' : '→'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export function TherapyProgressCharts({ data, className, locale }: TherapyProgressChartsProps) {
  return (
    <div className={cn("space-y-6", className)} aria-label="Therapy Progress Charts">
      <SessionProgressTimeline sessions={data.sessionMetrics} locale={locale} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SkillDevelopmentRadar skills={data.skillProgress} />
        <SessionComparison comparativeData={data.comparativeData} />
      </div>
      <SkillImprovementTimeline skills={data.skillProgress} />
    </div>
  );
}

export default TherapyProgressCharts;

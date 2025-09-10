import React from "react";
import type { TherapistSession } from "@/types/dashboard";
import { ProgressBar } from "./ProgressBar";
import { SessionMetrics } from "./SessionMetrics";
import { cn } from "@/lib/utils";

interface TherapistProgressTrackerProps {
  session: TherapistSession;
  className?: string;
}

export function TherapistProgressTracker({ session, className }: TherapistProgressTrackerProps) {
  // Calculate session duration
  const startTime = new Date(session.startTime);
  const endTime = session.endTime ? new Date(session.endTime) : new Date();
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationMinutes = Math.floor(durationMs / 60000);
  const durationHours = Math.floor(durationMinutes / 60);
  const remainingMinutes = durationMinutes % 60;

  // Mock skill progress data (in a real app, this would come from the session data)
  const skillProgress = [
    { skill: "Active Listening", score: 85, trend: "up" as const },
    { skill: "Empathy", score: 78, trend: "stable" as const },
    { skill: "Questioning", score: 92, trend: "up" as const },
    { skill: "Reflection", score: 71, trend: "down" as const },
  ];

  return (
    <div className={cn("space-y-6", className)} aria-label="Therapist Progress Tracker">
      {/* Session Overview */}
      <div className="bg-muted rounded-md p-4">
        <h4 className="text-md font-semibold mb-3">Session Overview</h4>
        <SessionMetrics
          metrics={[
            { label: "Session ID", value: session.id.slice(0, 8) },
            { label: "Status", value: session.status },
            { label: "Duration", value: session.endTime ? `${durationHours}h ${remainingMinutes}m` : "In Progress" },
            { label: "Progress", value: `${session.progress}%` }
          ]}
        />
      </div>

      {/* Overall Progress */}
      <div className="bg-muted rounded-md p-4">
        <h4 className="text-md font-semibold mb-3">Overall Progress</h4>
        <ProgressBar value={session.progress} label="Session Completion" />
      </div>

      {/* Skill Development */}
      <div className="bg-muted rounded-md p-4">
        <h4 className="text-md font-semibold mb-3">Skill Development</h4>
        <div className="space-y-3">
          {skillProgress.map((skill, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm">{skill.skill}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{skill.score}%</span>
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
          ))}
        </div>
      </div>

      {/* Session Notes */}
      <div className="bg-muted rounded-md p-4">
        <h4 className="text-md font-semibold mb-3">Session Notes</h4>
        <div className="text-sm text-muted-foreground italic">
          Session notes and observations will appear here...
        </div>
      </div>
    </div>
  );
}

export default TherapistProgressTracker;

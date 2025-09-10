import React from "react";
import type { TherapistDashboardProps } from "@/types/dashboard";
import { AnalyticsCharts } from "./AnalyticsCharts";
import { ProgressBar } from "./ProgressBar";
import { SessionMetrics } from "./SessionMetrics";
import { SessionControls } from "./SessionControls";
import { TherapistProgressTracker } from "./TherapistProgressTracker";
import { TherapyProgressCharts } from "./TherapyProgressCharts";
import { useTherapistAnalytics } from "@/hooks/useTherapistAnalytics";
import type { AnalyticsFilters } from "@/types/analytics";
import { cn } from "@/lib/utils";

// Accessibility: ARIA roles, keyboard navigation, WCAG 2.1 compliance
// Responsive grid layout using Tailwind

export function TherapistDashboard({ sessions, onSessionControl, children }: TherapistDashboardProps) {
  // Find the most recent session for progress tracking
  const latestSession = sessions.length > 0 ? sessions[0] : null;
  if (!onSessionControl) {
    throw new Error("TherapistDashboard requires onSessionControl prop");
  }

  // Use therapist analytics hook
  const defaultFilters: AnalyticsFilters = { timeRange: '30d' };
  const { data: therapistData, isLoading, error } = useTherapistAnalytics(defaultFilters, sessions);

  return (
    <section
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6",
        "bg-background text-foreground rounded-lg shadow-lg w-full min-h-[60vh]"
      )}
      aria-label="Therapist Dashboard"
      role="main"
    >
      {/* Session Controls */}
      <aside
        className="col-span-1 flex flex-col gap-4 bg-muted rounded-md p-4"
        aria-label="Session Controls"
        tabIndex={0}
      >
        <SessionControls sessions={sessions} onSessionControl={onSessionControl} />
      </aside>

      {/* Analytics Charts */}
      <section
        className="col-span-1 flex flex-col gap-4 bg-muted rounded-md p-4"
        aria-label="Analytics Charts"
        tabIndex={0}
      >
        <h3 className="text-lg font-semibold">Analytics Overview</h3>
        <AnalyticsCharts />
      </section>

      {/* Progress Widgets */}
      <section
        className="col-span-1 flex flex-col gap-4 bg-muted rounded-md p-4"
        aria-label="Progress Tracking Widgets"
        tabIndex={0}
      >
        <h3 className="text-lg font-semibold">Session Progress</h3>
        {latestSession && (
          <TherapistProgressTracker session={latestSession} />
        )}
      </section>

      {/* Therapy Progress Charts - Full width on larger screens */}
      {therapistData && (
        <section
          className="md:col-span-2 xl:col-span-3 flex flex-col gap-4 bg-muted rounded-md p-4"
          aria-label="Therapy Progress Charts"
          tabIndex={0}
        >
          <h3 className="text-lg font-semibold">Therapy Progress Overview</h3>
          <TherapyProgressCharts data={therapistData} />
        </section>
      )}

      {children}
    </section>
  );
}

export default TherapistDashboard;

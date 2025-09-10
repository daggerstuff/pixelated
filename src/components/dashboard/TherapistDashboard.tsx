import React, { useState, useEffect } from "react";
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

  // Skip link state for accessibility
  const [showSkipLink, setShowSkipLink] = useState(false);

  // Handle keyboard navigation for skip links
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setShowSkipLink(true);
      }
    };

    const handleMouseDown = () => {
      setShowSkipLink(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return (
    <div className="relative">
      {/* Skip to main content link for keyboard users */}
      {showSkipLink && (
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground focus:underline focus:ring-2 focus:ring-primary"
          onClick={(e) => {
            e.preventDefault();
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
              mainContent.focus();
            }
          }}
        >
          Skip to main content
        </a>
      )}

      <section
        id="main-content"
        className={cn(
          "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6",
          "bg-background text-foreground rounded-lg shadow-lg w-full min-h-[60vh]",
          "focus:outline-none"
        )}
        aria-label="Therapist Dashboard"
        role="main"
        tabIndex={-1}
      >
        {/* Session Controls */}
        <aside
          className="col-span-1 flex flex-col gap-4 bg-muted rounded-md p-4"
          aria-label="Session Controls"
          role="region"
          tabIndex={0}
        >
          <SessionControls sessions={sessions} onSessionControl={onSessionControl} />
        </aside>

        {/* Analytics Charts */}
        <section
          className="col-span-1 flex flex-col gap-4 bg-muted rounded-md p-4"
          aria-label="Analytics Charts"
          role="region"
          tabIndex={0}
        >
          <h3 className="text-lg font-semibold">Analytics Overview</h3>
          <AnalyticsCharts />
        </section>

        {/* Progress Widgets */}
        <section
          className="col-span-1 flex flex-col gap-4 bg-muted rounded-md p-4"
          aria-label="Progress Tracking Widgets"
          role="region"
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
            role="region"
            tabIndex={0}
          >
            <h3 className="text-lg font-semibold">Therapy Progress Overview</h3>
            <TherapyProgressCharts data={therapistData} />
          </section>
        )}

        {children}
      </section>
    </div>
  );
}

export default TherapistDashboard;

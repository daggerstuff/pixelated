/**
 * Therapy Progress Charts Component
 * Displays therapist analytics and progress visualization
 */

import React from "react";
import { AnalyticsCharts } from "./AnalyticsCharts";

export interface TherapistAnalyticsChartData {
  progressData?: Array<{
    date: string;
    sessions: number;
    avgProgress: number;
  }>;
  skillData?: Array<{
    skill: string;
    score: number;
  }>;
  engagementData?: Array<{
    week: string;
    value: number;
  }>;
}

interface TherapyProgressChartsProps {
  data: TherapistAnalyticsChartData | null;
}

export default function TherapyProgressCharts({ data }: TherapyProgressChartsProps) {
  if (!data) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        No therapy progress data available
      </div>
    );
  }

  // Use AnalyticsCharts for visualization - it handles data internally via hook
  return (
    <div className="therapy-progress-charts">
      <AnalyticsCharts />
    </div>
  );
}

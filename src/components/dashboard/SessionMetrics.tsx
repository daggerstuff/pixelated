import React from "react";

interface SessionMetricsProps {
  metrics: { label: string; value: number | string }[];
}

export function SessionMetrics({ metrics }: SessionMetricsProps) {
  return (
    <div
      className="grid grid-cols-2 gap-4"
      role="list"
      aria-label="Session Metrics"
    >
      {metrics.map((m, i) => (
        <div
          key={i}
          className="bg-muted rounded-md p-2 flex flex-col items-center"
          role="listitem"
        >
          <span className="text-xs text-muted-foreground">{m.label}</span>
          <span className="text-lg font-bold">{m.value}</span>
        </div>
      ))}
    </div>
  );
}

export default SessionMetrics;

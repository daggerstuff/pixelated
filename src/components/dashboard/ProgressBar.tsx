import React from "react";

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
}

export function ProgressBar({ value, max = 100, label }: ProgressBarProps) {
  const percent = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full" aria-label={label || "Progress Bar"} role="progressbar" aria-valuenow={value} aria-valuemax={max} aria-valuemin={0}>
      {label && <span className="block text-sm mb-1">{label}</span>}
      <div className="relative h-4 bg-muted rounded-full">
        <div
          className="absolute left-0 top-0 h-4 rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground ml-2">{percent}%</span>
    </div>
  );
}

export default ProgressBar;

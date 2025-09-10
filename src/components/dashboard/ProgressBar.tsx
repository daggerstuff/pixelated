import React from 'react';

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...rest
}: ProgressBarProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const clampedValue = Math.max(0, Math.min(Number.isFinite(value) ? value : 0, safeMax));
  const percent = Math.max(0, Math.min(100, safeMax > 0 ? Math.round((clampedValue / safeMax) * 100) : 0));
  const ariaValueText = `${percent}%`;

  const accessibleName = ariaLabelledBy ? undefined : ariaLabel || label || 'Progress Bar';

  return (
    <div
      className={['w-full', className].filter(Boolean).join(' ')}
      aria-label={accessibleName}
      aria-labelledby={ariaLabelledBy}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={ariaValueText}
      {...rest}
    >
      {label && <span className="block text-sm mb-1">{label}</span>}
      <div className="relative h-4 bg-muted rounded-full">
        <div
          className="absolute left-0 top-0 h-4 rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground ml-2">{ariaValueText}</span>
    </div>
  );
}

export default ProgressBar;

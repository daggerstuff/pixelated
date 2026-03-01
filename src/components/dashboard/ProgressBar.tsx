import React from 'react'

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  label?: string
  className?: string
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
  // Ensure max is a positive, finite number; default to 100 if not
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100
  // Clamp value to [0, safeMax]
  const clampedValue = Math.max(
    0,
    Math.min(Number.isFinite(value) ? value : 0, safeMax),
  )
  // Calculate percent (avoid NaN/Infinity)
  const percent = Math.max(
    0,
    Math.min(100, safeMax > 0 ? Math.round((clampedValue / safeMax) * 100) : 0),
  )
  // Human-readable ARIA value text
  const ariaValueText = `${percent}%`

  // Determine accessible name: prioritize aria-labelledby, then aria-label, then label prop, then fallback
  const accessibleName = ariaLabelledBy
    ? undefined
    : ariaLabel || label || 'Progress Bar'

  return (
    <div
      className={['w-full', className].filter(Boolean).join(' ')}
      aria-label={accessibleName}
      aria-labelledby={ariaLabelledBy}
      role='progressbar'
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={ariaValueText}
      {...rest}
    >
      {label && <span className='mb-1 block text-sm'>{label}</span>}
      <div className='bg-muted relative h-4 rounded-full'>
        <div
          className='bg-primary absolute left-0 top-0 h-4 rounded-full'
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className='text-muted-foreground ml-2 text-xs'>
        {ariaValueText}
      </span>
    </div>
  )
}

export default ProgressBar

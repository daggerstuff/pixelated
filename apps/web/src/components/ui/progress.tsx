import React from 'react'

import { cn } from '../../lib/utils'

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Progress value (0-100) */
  value?: number
  /** Maximum value */
  max?: number
  /** Show indeterminate loading animation */
  indeterminate?: boolean
  /** Show percentage text */
  showValue?: boolean
  /** Progress bar color variant */
  variant?:
    | 'default'
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'error'
  /** Progress bar size */
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Additional class name */
  className?: string
  /** Additional class name for the value bar */
  valueClassName?: string
  /** Additional class name for the background bar */
  bgClassName?: string
}

export function Progress({
  value = 0,
  max = 100,
  indeterminate = false,
  showValue = false,
  variant = 'primary',
  size = 'md',
  className,
  valueClassName,
  bgClassName,
  ...props
}: ProgressProps) {
  // Calculate percentage
  const percentage = Math.min(Math.max(0, (value / max) * 100), 100)

  // Size classes
  const sizeClasses = {
    xs: 'h-1',
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  }

  // Variant classes for the progress bar
  const variantClasses = {
    default: 'bg-muted-foreground',
    primary: 'bg-primary',
    secondary: 'bg-accent',
    success: 'bg-primary',
    warning: 'bg-foreground',
    error: 'bg-foreground',
  }

  // Base background classes
  const baseBackgroundClasses = 'bg-secondary rounded-none overflow-hidden'

  // Base progress classes
  const baseProgressClasses =
    'h-full rounded-none transition-all duration-300 ease-in-out'

  return (
    <div
      className={cn('w-full', className)}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={indeterminate ? 'Loading' : `${percentage}% loaded`}
      {...props}
    >
      {/* Progress bar with label */}
      <div className="flex items-center justify-between">
        {/* Progress bar container */}
        <div
          className={cn(
            'w-full',
            baseBackgroundClasses,
            sizeClasses[size],
            bgClassName,
          )}
        >
          <div
            className={cn(
              baseProgressClasses,
              variantClasses[variant],
              {
                'animate-pulse': indeterminate,
                'animate-progress-indeterminate w-3/4': indeterminate,
              },
              valueClassName,
            )}
            style={{ width: indeterminate ? undefined : `${percentage}%` }}
          />
        </div>

        {/* Show value if requested */}
        {showValue && !indeterminate && (
          <span className="ml-2 text-xs text-muted-foreground">
            {Math.round(percentage)}%
          </span>
        )}
      </div>
    </div>
  )
}

export default Progress

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

export function ProgressCircular({
  value = 0,
  max = 100,
  indeterminate = false,
  showValue = false,
  variant = 'primary',
  size = 40,
  strokeWidth = 4,
  className,
  ...props
}: Omit<ProgressProps, 'size'> & {
  /** Size of the circular progress in pixels */ size?: number
  /** Width of the progress stroke */ strokeWidth?: number
}) {
  // Calculate percentage and circle properties
  const percentage = Math.min(Math.max(0, (value / max) * 100), 100)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  // Variant classes for the progress stroke
  const variantClasses = {
    default: 'stroke-muted-foreground',
    primary: 'stroke-primary',
    secondary: 'stroke-accent',
    success: 'stroke-primary',
    warning: 'stroke-foreground',
    error: 'stroke-foreground',
  }

  return (
    <div
      className={cn('inline-flex items-center justify-center', className)}
      {...props}
    >
      <svg
        className={cn('transform -rotate-90', {
          'animate-spin': indeterminate,
        })}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={indeterminate ? 'Loading' : `${percentage}% loaded`}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-secondary"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={cn(variantClasses[variant], {
            'animate-pulse': indeterminate,
          })}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={
            indeterminate ? circumference * 0.25 : strokeDashoffset
          }
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Show value if requested */}
      {showValue && !indeterminate && (
        <span className="absolute text-xs text-foreground">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  )
}

export default Progress

import { useId } from 'react'

import { cn } from '@/lib/utils'

export interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  showValue?: boolean
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'error'
}

const variantStyles = {
  default: 'bg-primary',
  success: 'bg-primary',
  warning: 'bg-foreground',
  error: 'bg-foreground',
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  className,
  variant = 'default',
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)
  const id = useId()

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="mb-2 flex items-center justify-between text-sm">
          <label htmlFor={id} className="text-muted-foreground">
            {label}
          </label>
          {showValue && (
            <span className="font-medium">{Math.round(percentage)}%</span>
          )}
        </div>
      )}
      <div
        className="relative h-2 w-full overflow-hidden rounded-none bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? 'Progress'}
        id={id}
      >
        <div
          className={cn(
            'h-full transition-all duration-300 ease-out',
            variantStyles[variant],
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showValue && !label && (
        <div className="mt-1 text-right text-xs text-muted-foreground">
          {Math.round(percentage)}%
        </div>
      )}
    </div>
  )
}

import * as React from 'react'

import { cn } from '../../lib/utils'

export interface AlertProps {
  variant?: 'default' | 'error' | 'warning' | 'success' | 'info'
  title?: string
  description?: React.ReactNode
  icon?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

const variantStyles = {
  default: 'border-border bg-background text-foreground',
  // Value-contrast ladder: info/success quiet, warning ring + weight,
  // error inverted primary (highest emphasis). Icons carry semantics.
  error: 'border-ring bg-primary font-medium text-primary-foreground',
  warning: 'border-ring bg-secondary font-medium text-foreground',
  success: 'border-border bg-secondary text-foreground',
  info: 'border-border bg-secondary text-foreground',
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      variant = 'default',
      title,
      description,
      icon,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'relative w-full border px-4 py-3 text-sm',
          variantStyles[variant],
          className,
        )}
        {...props}
      >
        <div className="flex items-start gap-2">
          {icon && <div className="mt-0.5 flex-shrink-0">{icon}</div>}
          <div className="min-w-0 flex-1">
            {title && (
              <h5 className="mb-1 font-medium leading-none tracking-tight">
                {title}
              </h5>
            )}
            {description && (
              <div className="text-sm opacity-90">{description}</div>
            )}
            {children && !description && <div>{children}</div>}
          </div>
        </div>
      </div>
    )
  },
)

Alert.displayName = 'Alert'

export default Alert

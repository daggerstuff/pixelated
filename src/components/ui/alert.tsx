import * as React from 'react'
import { cn } from '@/lib/utils'

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
  error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
  warning: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300',
  success: 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300',
  info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = 'default', title, description, icon, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'relative w-full rounded-lg border px-4 py-3 text-sm',
          variantStyles[variant],
          className
        )}
        {...props}
      >
        <div className="flex items-start gap-2">
          {icon && (
            <div className="flex-shrink-0 mt-0.5">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {title && (
              <h5 className="mb-1 font-medium leading-none tracking-tight">
                {title}
              </h5>
            )}
            {description && (
              <div className="text-sm opacity-90">
                {description}
              </div>
            )}
            {children && !description && (
              <div>{children}</div>
            )}
          </div>
        </div>
      </div>
    )
  }
)

Alert.displayName = 'Alert'

export default Alert

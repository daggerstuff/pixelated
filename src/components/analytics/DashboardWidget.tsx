import { useId } from 'react'
import type { ReactNode } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw } from 'lucide-react'

export interface DashboardWidgetProps {
  title: string
  description?: string
  isLoading?: boolean
  onRefresh?: () => void
  className?: string
  children: ReactNode
  actions?: ReactNode
  variant?: 'default' | 'compact'
}

export function DashboardWidget({
  title,
  description,
  isLoading = false,
  onRefresh,
  className = '',
  children,
  actions,
  variant = 'default',
}: DashboardWidgetProps) {
  const titleId = useId()
  return (
    <Card
      className={`dashboard-widget ${className}`}
      role="region"
      aria-labelledby={titleId}
    >
      <CardHeader className={variant === 'compact' ? 'pb-2' : 'pb-4'}>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle
              id={titleId}
              className={variant === 'compact' ? 'text-lg' : 'text-xl'}
            >
              {title}
            </CardTitle>
            {description && (
              <CardDescription className="mt-1">{description}</CardDescription>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Refresh data"
              >
                <RefreshCw className="h-4 w-4 text-gray-500" />
              </button>
            )}
            {actions}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-[20px] w-[80%] rounded-md" />

            <Skeleton className="h-[20px] w-[60%] rounded-md" />

            <Skeleton className="h-[20px] w-[70%] rounded-md" />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

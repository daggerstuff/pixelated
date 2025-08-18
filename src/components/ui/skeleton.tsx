import React from 'react'
import { cn } from '../../lib/utils'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width of the skeleton */
  width?: string | number
  /** Height of the skeleton */
  height?: string | number
  /** Number of skeleton items to render */
  count?: number
  /** Whether the skeleton should have a border radius */
  rounded?: boolean
  /** Whether the skeleton should be circular */
  circle?: boolean
  /** Whether the skeleton should have animation */
  animate?: boolean
  /** Whether the skeleton should have a pulse animation */
  pulse?: boolean
  /** Whether the skeleton should have a wave animation */
  wave?: boolean
  /** Additional class name */
  className?: string
}

export function Skeleton({
  width,
  height,
  count = 1,
  rounded = true,
  circle = false,
  animate = true,
  pulse = true,
  wave = false,
  className,
  ...props
}: SkeletonProps) {
  const baseClasses = 'inline-block bg-gray-200 dark:bg-gray-700'
  const animationClasses = animate
    ? pulse
      ? 'animate-pulse'
      : wave
        ? 'animate-skeleton-wave'
        : ''
    : ''

  const shapeClasses = circle ? 'rounded-full' : rounded ? 'rounded' : ''

  const items = []

  const style: React.CSSProperties = {
    ...(width !== undefined && {
      width: typeof width === 'number' ? `${width}px` : width,
    }),
    ...(height !== undefined && {
      height: typeof height === 'number' ? `${height}px` : height,
    }),
  }

  for (let i = 0; i < count; i++) {
    items.push(
      <span
        key={`skeleton-${i}`}
        className={cn(baseClasses, animationClasses, shapeClasses, className)}
        style={style}
        {...props}
      />,
    )

    // Add line break if multiple items are rendered
    if (i < count - 1) {
      items.push(<br key={`br-${i}`} />)
    }
  }

  return <>{items}</>
}

export function SkeletonText({
  lines = 3,
  lineHeight = 16,
  lastLineWidth = '67%',
  spacing = 8,
  className,
  ...props
}: SkeletonProps & {
  /** Number of lines to render */ lines?: number
  /** Height of each line */ lineHeight?: number
  /** Width of the last line (string percentage or pixel value) */ lastLineWidth?:
    | string
    | number
  /** Spacing between lines */ spacing?: number
}) {
  // Convert spacing to proper CSS value
  const spacingPx = typeof spacing === 'number' ? `${spacing}px` : spacing

  const items = []

  for (let i = 0; i < lines; i++) {
    const isLastLine = i === lines - 1
    const width = isLastLine && lastLineWidth ? lastLineWidth : '100%'

    items.push(
      <Skeleton
        key={`text-line-${i}`}
        width={width}
        height={typeof lineHeight === 'number' ? `${lineHeight}px` : lineHeight}
        className={cn('block', className)}
        style={{
          marginBottom: isLastLine ? 0 : spacingPx,
        }}
        {...props}
      />,
    )
  }

  return <div>{items}</div>
}

export function SkeletonAvatar({
  size = 40,
  className,
  ...props
}: SkeletonProps & { /** Size of the avatar */ size?: number }) {
  return (
    <Skeleton
      width={size}
      height={size}
      circle
      className={cn('inline-block', className)}
      {...props}
    />
  )
}

export function SkeletonButton({
  width = 80,
  height = 40,
  className,
  ...props
}: SkeletonProps) {
  return (
    <Skeleton
      width={width}
      height={height}
      className={cn('block', className)}
      {...props}
    />
  )
}

export function SkeletonImage({
  width = '100%',
  height = 200,
  className,
  ...props
}: SkeletonProps) {
  return (
    <Skeleton
      width={width}
      height={height}
      className={cn('block', className)}
      {...props}
    />
  )
}

interface SkeletonCardProps {
  className?: string
  rows?: number
  rowHeight?: number
  rowClassName?: string
  circleSize?: number
  hasCircle?: boolean
  circlePosition?: 'left' | 'right' | 'top'
}

export function SkeletonCard({
  className,
  rows = 3,
  rowHeight = 12,
  rowClassName,
  circleSize = 48,
  hasCircle = false,
  circlePosition = 'left',
}: SkeletonCardProps) {
  return (
    <div
      className={cn('flex w-full gap-4', className, {
        'flex-col': circlePosition === 'top',
        'items-center': circlePosition === 'left' || circlePosition === 'right',
        'flex-row-reverse': circlePosition === 'right',
      })}
    >
      {hasCircle && (
        <div className="flex-shrink-0">
          <SkeletonAvatar size={circleSize} />
        </div>
      )}
      <div
        className={cn('w-full space-y-3', {
          'mt-2': circlePosition === 'top' && hasCircle,
        })}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton
            key={`card-row-${i}`}
            height={rowHeight}
            className={cn(rowClassName, {
              'w-3/4': i === rows - 1,
              'w-full': i !== rows - 1,
            })}
          />
        ))}
      </div>
    </div>
  )
}

export function SkeletonChartBar({ className }: SkeletonProps) {
  return (
    <div className={cn('flex h-40 items-end gap-2', className)}>
      {Array.from({ length: 7 }).map((_, i) => {
        const randomHeight = Math.floor(Math.random() * 100) + 20
        return (
          <div
            key={`chart-bar-${i}`}
            className="flex w-full flex-col items-center gap-2"
          >
            <Skeleton
              height={randomHeight}
              width="100%"
              className="rounded-t-md"
            />

            <Skeleton height={4} width={8} />
          </div>
        )
      })}
    </div>
  )
}

export function SkeletonChartLine({ className }: SkeletonProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex justify-between">
        <Skeleton height={5} width={24} />
        <div className="flex space-x-2">
          <Skeleton height={5} width={12} />
          <Skeleton height={5} width={12} />
          <Skeleton height={5} width={12} />
        </div>
      </div>
      <Skeleton height={40} width="100%" />
    </div>
  )
}

export function SkeletonTable({
  rows = 5,
  columns = 3,
  className,
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`table-header-${i}`} height={6} className="flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={`table-row-${i}`} className="flex gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton
              key={`table-cell-${i}-${j}`}
              height={10}
              className="flex-1"
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonProfile({ className }: SkeletonProps) {
  return (
    <div className={cn('space-y-8', className)}>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-shrink-0 flex flex-col items-center">
          <SkeletonAvatar size={96} />
          <Skeleton className="mt-4" height={4} width={20} />
        </div>

        <div className="flex-grow space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={`profile-field-${i}`} className="space-y-1">
                <Skeleton height={4} width={24} />
                <Skeleton height={6} width="100%" />
              </div>
            ))}
            <div className="space-y-1 md:col-span-2">
              <Skeleton height={4} width={24} />
              <Skeleton height={20} width="100%" />
            </div>
          </div>

          <Skeleton height={10} width={32} />
        </div>
      </div>

      <div className="pt-6 mt-6 space-y-4">
        <Skeleton height={6} width={40} className="mx-auto" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`profile-detail-${i}`} className="space-y-1">
              <Skeleton height={4} width={24} />
              <Skeleton height={6} width="100%" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

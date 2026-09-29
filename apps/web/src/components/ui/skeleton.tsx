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
  const baseClasses = 'inline-block bg-secondary'
  const animationClasses = animate
    ? pulse
      ? 'animate-pulse'
      : wave
        ? 'animate-skeleton-wave'
        : ''
    : ''

  const shapeClasses = circle ? 'rounded-full' : rounded ? 'rounded' : ''

  const items: React.ReactElement[] = []

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

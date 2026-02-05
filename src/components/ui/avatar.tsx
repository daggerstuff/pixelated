import React from 'react'
import { cn } from '@/lib/utils'

export interface AvatarProps {
  className?: string
  src?: string | null
  initials?: string
  alt?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Avatar({
  className,
  src,
  initials,
  alt = '',
  size = 'md',
}: AvatarProps) {
  return (
    <div
      className={cn(
        'rounded-full overflow-hidden bg-gray-200 flex items-center justify-center text-gray-600',
        className,
      )}
    >
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <span className="font-medium text-sm">{initials}</span>
      )}
    </div>
  )
}

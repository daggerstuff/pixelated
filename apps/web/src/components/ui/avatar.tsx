import { cn } from '../../lib/utils'

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
  size: _size = 'md',
}: AvatarProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-none bg-secondary text-muted-foreground',
        className,
      )}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm font-medium">{initials}</span>
      )}
    </div>
  )
}

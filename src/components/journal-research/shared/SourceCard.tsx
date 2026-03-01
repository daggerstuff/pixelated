import { format } from 'date-fns'
import { ExternalLink } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card/card'
import type { Source } from '@/lib/api/journal-research/types'

export interface SourceCardProps {
  source: Source
  onClick?: () => void
  className?: string
}

export function SourceCard({ source, onClick, className }: SourceCardProps) {
  const handleLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(source.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <Card
      className={`transition-shadow hover:shadow-lg ${onClick ? 'cursor-pointer' : ''} ${className ?? ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      <CardHeader>
        <CardTitle className='line-clamp-2 text-lg font-semibold'>
          {source.title}
        </CardTitle>
        <CardDescription className='mt-1'>
          {source.authors.join(', ')}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className='space-y-3'>
          <div className='text-muted-foreground line-clamp-3 text-sm'>
            {source.abstract}
          </div>

          <div className='flex flex-wrap gap-2'>
            {source.keywords.slice(0, 5).map((keyword) => (
              <span
                key={keyword}
                className='bg-muted rounded-full px-2 py-1 text-xs'
              >
                {keyword}
              </span>
            ))}
            {source.keywords.length > 5 && (
              <span className='bg-muted rounded-full px-2 py-1 text-xs'>
                +{source.keywords.length - 5} more
              </span>
            )}
          </div>

          <div className='grid grid-cols-2 gap-4 text-sm'>
            <div>
              <span className='text-muted-foreground'>Published:</span>
              <span className='ml-2 font-medium'>
                {format(source.publicationDate, 'MMM yyyy')}
              </span>
            </div>
            <div>
              <span className='text-muted-foreground'>Type:</span>
              <span className='ml-2 font-medium capitalize'>
                {source.sourceType}
              </span>
            </div>
          </div>

          <div className='text-muted-foreground flex items-center gap-4 text-xs'>
            {source.openAccess && (
              <span className='bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded px-2 py-1'>
                Open Access
              </span>
            )}
            <span className='capitalize'>{source.dataAvailability}</span>
            {source.doi && (
              <span className='font-mono text-xs'>{source.doi}</span>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className='flex items-center justify-between'>
        <div className='text-muted-foreground text-xs'>
          Discovered {format(source.discoveryDate, 'MMM d, yyyy')}
        </div>
        <a
          href={source.url}
          target='_blank'
          rel='noopener noreferrer'
          onClick={handleLinkClick}
          className='text-primary flex items-center gap-1 text-xs hover:underline'
          aria-label={`Open ${source.title} in new tab`}
        >
          View Source
          <ExternalLink className='h-3 w-3' />
        </a>
      </CardFooter>
    </Card>
  )
}

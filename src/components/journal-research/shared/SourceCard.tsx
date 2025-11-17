import type { Source } from '@/lib/api/journal-research/types'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card/card'
import { format } from 'date-fns'
import { ExternalLink } from 'lucide-react'

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
        <CardTitle className="text-lg font-semibold line-clamp-2">
          {source.title}
        </CardTitle>
        <CardDescription className="mt-1">
          {source.authors.join(', ')}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground line-clamp-3">
            {source.abstract}
          </div>

          <div className="flex flex-wrap gap-2">
            {source.keywords.slice(0, 5).map((keyword) => (
              <span
                key={keyword}
                className="rounded-full bg-muted px-2 py-1 text-xs"
              >
                {keyword}
              </span>
            ))}
            {source.keywords.length > 5 && (
              <span className="rounded-full bg-muted px-2 py-1 text-xs">
                +{source.keywords.length - 5} more
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Published:</span>
              <span className="ml-2 font-medium">
                {format(source.publicationDate, 'MMM yyyy')}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Type:</span>
              <span className="ml-2 font-medium capitalize">
                {source.sourceType}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {source.openAccess && (
              <span className="rounded bg-green-100 px-2 py-1 text-green-800 dark:bg-green-900 dark:text-green-200">
                Open Access
              </span>
            )}
            <span className="capitalize">{source.dataAvailability}</span>
            {source.doi && (
              <span className="font-mono text-xs">{source.doi}</span>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Discovered {format(source.discoveryDate, 'MMM d, yyyy')}
        </div>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
          aria-label={`Open ${source.title} in new tab`}
        >
          View Source
          <ExternalLink className="h-3 w-3" />
        </a>
      </CardFooter>
    </Card>
  )
}


import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import { SourceCard } from '../shared/SourceCard'
import { useSourceQuery } from '@/lib/hooks/journal-research'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ExternalLink } from 'lucide-react'

export interface SourceDetailProps {
  sessionId: string
  sourceId: string
  className?: string
}

export function SourceDetail({
  sessionId,
  sourceId,
  className,
}: SourceDetailProps) {
  const { data: source, isLoading } = useSourceQuery(sessionId, sourceId)

  if (isLoading) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">Loading source...</p>
      </div>
    )
  }

  if (!source) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">Source not found</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{source.title}</h1>
          <p className="text-muted-foreground mt-1">
            Published {format(source.publicationDate, 'MMM d, yyyy')} •{' '}
            {source.sourceType}
          </p>
        </div>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          View Source <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {/* Source Card */}
      <SourceCard source={source} />

      {/* Source Details */}
      <Card>
        <CardHeader>
          <CardTitle>Source Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Source ID
              </p>
              <p className="mt-1">{source.sourceId}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Publication Date
              </p>
              <p className="mt-1">{format(source.publicationDate, 'PPpp')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Source Type
              </p>
              <p className="mt-1">{source.sourceType}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Open Access
              </p>
              <p className="mt-1">{source.openAccess ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Data Availability
              </p>
              <p className="mt-1">{source.dataAvailability}</p>
            </div>
            {source.doi && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">DOI</p>
                <p className="mt-1">{source.doi}</p>
              </div>
            )}
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-muted-foreground">
                Authors
              </p>
              <p className="mt-1">{source.authors.join(', ')}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-muted-foreground">
                Abstract
              </p>
              <p className="mt-1 text-sm">{source.abstract}</p>
            </div>
            {source.keywords.length > 0 && (
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Keywords
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {source.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-md bg-muted px-2 py-1 text-xs"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Discovery Date
              </p>
              <p className="mt-1">
                {format(source.discoveryDate, 'PPpp')}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Discovery Method
              </p>
              <p className="mt-1">{source.discoveryMethod}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-muted-foreground">URL</p>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-sm text-primary hover:underline"
              >
                {source.url}
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


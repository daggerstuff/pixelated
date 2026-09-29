import { ScrollArea } from '@/components/ui/scroll-area'

import type { UnusualPattern } from '../../lib/audit/analysis'
import { Badge } from '../ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'

interface UnusualPatternsProps {
  patterns: UnusualPattern[]
}

const severityColors = {
  low: 'bg-secondary text-foreground',
  medium: 'bg-secondary text-foreground border border-ring font-medium',
  high: 'bg-foreground text-background',
}

export function UnusualPatterns({ patterns }: UnusualPatternsProps) {
  if (!patterns.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unusual Patterns</CardTitle>
          <CardDescription>No unusual patterns detected</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unusual Patterns</CardTitle>
        <CardDescription>
          {patterns.length} pattern{patterns.length !== 1 ? 's' : ''} detected
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {patterns.map((pattern) => (
              <div
                key={`${pattern.type}-${pattern.severity}-${pattern.description.slice(0, 16)}`}
                className="rounded-lg border p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-lg font-semibold capitalize">
                    {pattern.type.replace('_', ' ')}
                  </h3>
                  <Badge
                    variant="outline"
                    className={severityColors[pattern.severity]}
                  >
                    {pattern.severity}
                  </Badge>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">
                  {pattern.description}
                </p>
                <div className="text-xs text-muted-foreground">
                  {pattern.relatedLogs.length} related log entries
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

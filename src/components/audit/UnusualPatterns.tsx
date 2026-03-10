import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { Badge } from '../ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { UnusualPattern } from '../../lib/audit/analysis'

interface UnusualPatternsProps {
  patterns: UnusualPattern[]
}

const severityColors = {
  low: 'bg-yellow-100 text-yellow-800',
  medium: 'bg-orange-100 text-orange-800',
  high: 'bg-red-100 text-red-800',
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
                className="border rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
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
                <p className="text-sm text-gray-600 mb-3">
                  {pattern.description}
                </p>
                <div className="text-xs text-gray-500">
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

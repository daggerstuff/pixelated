import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import { useReportQuery } from '@/lib/hooks/journal-research'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { Download, FileText } from 'lucide-react'

export interface ReportViewerProps {
  sessionId: string
  reportId: string
  className?: string
}

export function ReportViewer({
  sessionId,
  reportId,
  className,
}: ReportViewerProps) {
  const { data: report, isLoading } = useReportQuery(sessionId, reportId)

  if (isLoading) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">Loading report...</p>
      </div>
    )
  }

  if (!report) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">Report not found</p>
      </div>
    )
  }

  const renderContent = () => {
    if (!report.content) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No content available. Report may still be generating.
        </div>
      )
    }

    if (report.format === 'json') {
      return (
        <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
          {JSON.stringify(report.content, null, 2)}
        </pre>
      )
    }

    if (report.format === 'markdown') {
      return (
        <div className="prose max-w-none">
          <pre className="whitespace-pre-wrap text-sm">
            {typeof report.content === 'string'
              ? report.content
              : JSON.stringify(report.content, null, 2)}
          </pre>
        </div>
      )
    }

    if (report.format === 'pdf') {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            PDF reports are available for download.
          </p>
          {report.filePath && (
            <a
              href={report.filePath}
              download
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          )}
        </div>
      )
    }

    return (
      <div className="text-muted-foreground">
        Content format not supported for preview.
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Report Viewer</h1>
          <p className="text-muted-foreground mt-1">
            Generated {format(report.generatedDate, 'PPpp')}
          </p>
        </div>
        <div className="flex gap-2">
          {report.filePath && (
            <a
              href={report.filePath}
              download
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
          )}
        </div>
      </div>

      {/* Report Info */}
      <Card>
        <CardHeader>
          <CardTitle>Report Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Report ID
              </p>
              <p className="mt-1">{report.reportId}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Session ID
              </p>
              <p className="mt-1">{report.sessionId}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Report Type
              </p>
              <p className="mt-1 capitalize">
                {report.reportType.replace('_', ' ')}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Format
              </p>
              <p className="mt-1 uppercase">{report.format}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Generated Date
              </p>
              <p className="mt-1">{format(report.generatedDate, 'PPpp')}</p>
            </div>
            {report.filePath && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  File Path
                </p>
                <p className="mt-1 font-mono text-sm">{report.filePath}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <CardTitle>Report Content</CardTitle>
          </div>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>
    </div>
  )
}


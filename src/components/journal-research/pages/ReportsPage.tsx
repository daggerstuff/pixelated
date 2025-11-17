import { JournalResearchQueryProvider } from '@/lib/api/journal-research/react-query'
import { ReportGenerator, ReportViewer } from '../features'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'

export interface ReportsPageProps {
  sessionId?: string | null
  reportId?: string | null
}

export function ReportsPage({ sessionId, reportId }: ReportsPageProps) {
  return (
    <JournalResearchQueryProvider>
      {reportId ? (
        <Card>
          <CardHeader>
            <CardTitle>Report Viewer</CardTitle>
          </CardHeader>
          <CardContent>
            <ReportViewer reportId={reportId} />
          </CardContent>
        </Card>
      ) : (
        <ReportGenerator sessionId={sessionId ?? null} />
      )}
    </JournalResearchQueryProvider>
  )
}


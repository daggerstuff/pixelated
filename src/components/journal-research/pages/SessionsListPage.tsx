import { JournalResearchQueryProvider } from '@/lib/api/journal-research/react-query'
import { SessionList } from '../lists/SessionList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import { useSessionListQuery } from '@/lib/hooks/journal-research'

function SessionsListContent() {
  const { data: sessions, isLoading } = useSessionListQuery({
    page: 1,
    pageSize: 10,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Sessions</CardTitle>
      </CardHeader>
      <CardContent>
        <SessionList
          sessions={sessions ?? { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }}
          isLoading={isLoading}
          onSessionClick={(session) => {
            window.location.href = `/journal-research/sessions/${session.sessionId}`
          }}
        />
      </CardContent>
    </Card>
  )
}

export function SessionsListPage() {
  return (
    <JournalResearchQueryProvider>
      <SessionsListContent />
    </JournalResearchQueryProvider>
  )
}


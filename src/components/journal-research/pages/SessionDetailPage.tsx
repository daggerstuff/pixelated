import { JournalResearchQueryProvider } from '@/lib/api/journal-research/react-query'
import { SessionDetail } from '../features/SessionDetail'

export interface SessionDetailPageProps {
  sessionId: string
}

export function SessionDetailPage({ sessionId }: SessionDetailPageProps) {
  return (
    <JournalResearchQueryProvider>
      <SessionDetail sessionId={sessionId} />
    </JournalResearchQueryProvider>
  )
}


import { JournalResearchQueryProvider } from '@/lib/api/journal-research/react-query'
import { SourceDiscovery } from '../features/SourceDiscovery'

export interface DiscoveryPageProps {
  sessionId?: string | null
}

export function DiscoveryPage({ sessionId }: DiscoveryPageProps) {
  return (
    <JournalResearchQueryProvider>
      <SourceDiscovery sessionId={sessionId ?? null} />
    </JournalResearchQueryProvider>
  )
}


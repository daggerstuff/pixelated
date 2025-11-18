import { JournalResearchQueryProvider } from '@/lib/api/journal-research/react-query'
import { IntegrationPanel } from '../features/IntegrationPanel'

export interface IntegrationPageProps {
  sessionId?: string | null
}

export function IntegrationPage({ sessionId }: IntegrationPageProps) {
  return (
    <JournalResearchQueryProvider>
      <IntegrationPanel sessionId={sessionId ?? null} />
    </JournalResearchQueryProvider>
  )
}


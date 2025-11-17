import { JournalResearchQueryProvider } from '@/lib/api/journal-research/react-query'
import { AcquisitionPanel } from '../features/AcquisitionPanel'

export interface AcquisitionPageProps {
  sessionId?: string | null
}

export function AcquisitionPage({ sessionId }: AcquisitionPageProps) {
  return (
    <JournalResearchQueryProvider>
      <AcquisitionPanel sessionId={sessionId ?? null} />
    </JournalResearchQueryProvider>
  )
}


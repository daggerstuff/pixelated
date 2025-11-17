import { JournalResearchQueryProvider } from '@/lib/api/journal-research/react-query'
import { EvaluationPanel } from '../features/EvaluationPanel'

export interface EvaluationPageProps {
  sessionId?: string | null
}

export function EvaluationPage({ sessionId }: EvaluationPageProps) {
  return (
    <JournalResearchQueryProvider>
      <EvaluationPanel sessionId={sessionId ?? null} />
    </JournalResearchQueryProvider>
  )
}


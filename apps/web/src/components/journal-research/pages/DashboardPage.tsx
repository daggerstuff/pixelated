import { ProtectedRoute } from '@/components/auth'
import { JournalResearchQueryProvider } from '@/lib/api/journal-research/react-query'

import { Dashboard } from '../features/Dashboard'

export function DashboardPage() {
  return (
    <ProtectedRoute>
      <JournalResearchQueryProvider>
        <Dashboard />
      </JournalResearchQueryProvider>
    </ProtectedRoute>
  )
}

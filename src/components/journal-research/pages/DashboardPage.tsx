import { JournalResearchQueryProvider } from '@/lib/api/journal-research/react-query'
import { Dashboard } from '../features/Dashboard'
import { ProtectedRoute } from '@/components/auth'

export function DashboardPage() {
  return (
    <ProtectedRoute>
      <JournalResearchQueryProvider>
        <Dashboard />
      </JournalResearchQueryProvider>
    </ProtectedRoute>
  )
}


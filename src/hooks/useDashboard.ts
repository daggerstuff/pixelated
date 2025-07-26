import { useState, useEffect } from 'react'
import { useAuth } from './useAuth.js'

interface DashboardStats {
  sessionsThisWeek: number
  totalPracticeHours: number
  progressScore: number
}

interface RecentSession {
  id: string
  type: 'chat' | 'simulator'
  timestamp: Date
  title: string
}

interface DashboardData {
  stats: DashboardStats
  recentSessions: RecentSession[]
  securityLevel: 'standard' | 'hipaa' | 'maximum'
}

export function useDashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/dashboard')

        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data')
        }

        const dashboardData = await response.json()
        setData(dashboardData)
        setError(null)
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
        setError('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchDashboardData()
    }
  }, [user])

  return { data, loading, error }
}

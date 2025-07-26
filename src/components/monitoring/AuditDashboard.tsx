import { useEffect, useState } from 'react'
import { LineChart } from '../ui/charts/LineChart'
import { PieChart } from '../ui/charts/PieChart'

interface AuditMetrics {
  accessByTime: {
    labels: string[]
    data: number[]
  }
  accessByType: {
    labels: string[]
    data: number[]
  }
  unusualAccess: {
    count: number
    details: string[]
  }
}

export function AuditDashboard() {
  const [metrics, setMetrics] = useState<AuditMetrics>({
    accessByTime: { labels: [], data: [] },
    accessByType: { labels: [], data: [] },
    unusualAccess: { count: 0, details: [] },
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAuditMetrics = async () => {
      try {
        // Fetch audit logs and process them into metrics
        const response = await fetch('/api/audit/metrics')
        if (!response.ok) {
          throw new Error('Failed to fetch audit metrics')
        }

        const data = await response.json()
        setMetrics(data)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load audit metrics',
        )
      } finally {
        setLoading(false)
      }
    }

    fetchAuditMetrics()
    // Refresh metrics every 5 minutes
    const interval = setInterval(fetchAuditMetrics, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <div>Loading audit metrics...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Audit Log Dashboard</h1>

      {/* PHI Access Over Time */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">PHI Access Patterns</h2>
        <LineChart
          data={metrics.accessByTime.data}
          labels={metrics.accessByTime.labels}
          label="Access Count"
          color="#4f46e5"
        />
      </div>

      {/* Access by Type Distribution */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Access Type Distribution</h2>
        <div className="h-[300px]">
          <PieChart
            data={metrics.accessByType.data}
            labels={metrics.accessByType.labels}
          />
        </div>
      </div>

      {/* Unusual Access Patterns */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">
          Unusual Access Patterns
          {metrics.unusualAccess.count > 0 && (
            <span className="ml-2 px-2 py-1 text-sm bg-red-100 text-red-800 rounded-full">
              {metrics.unusualAccess.count} detected
            </span>
          )}
        </h2>
        {metrics.unusualAccess.details.length > 0 ? (
          <ul className="space-y-2">
            {metrics.unusualAccess.details.map((detail) => (
              <li key={`unusual-access-${detail.id || detail.timestamp || detail.user || Date.now()}`} className="flex items-center text-red-600">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {detail}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-green-600">No unusual access patterns detected</p>
        )}
      </div>
    </div>
  )
}

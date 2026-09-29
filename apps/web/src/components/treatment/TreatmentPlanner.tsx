import React, { useState, useMemo, FC, SyntheticEvent } from 'react'

import type { TreatmentRecommendation } from '../../lib/ai/services/RecommendationService'
import RecommendationDisplay from '../ai/RecommendationDisplay'

interface TreatmentPlannerProps {
  pageTitle: string
  pageDescription: string
  // Define any props this component might receive from Astro, if necessary
}

const TreatmentPlanner: FC<TreatmentPlannerProps> = ({
  pageTitle,
  pageDescription,
}) => {
  const [clientId, setClientId] = useState('')
  const [indications, setIndications] = useState('')
  const [recommendations, setRecommendations] = useState<
    TreatmentRecommendation[]
  >([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')

  async function fetchRecommendations(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setRecommendations([])
    try {
      if (!clientId || !indications) {
        setError('Client ID and at least one indication are required.')
        setLoading(false)
        return
      }
      const res = await fetch('/api/ai/recommendations/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          indications: indications
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          includePersonalization: true,
          includeEfficacyStats: true,
          includeAlternativeApproaches: true,
          maxMediaRecommendations: 3,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to fetch recommendations')
        setLoading(false)
        return
      }
      setRecommendations(data.data.recommendations as TreatmentRecommendation[])
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err?.message || String(err) : 'Unknown error'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // ⚡ Bolt: Memoize filtered recommendations to prevent O(N) filtering array allocations on every render
  const filteredRecommendations = useMemo(() => {
    return filter === 'all'
      ? recommendations
      : recommendations.filter((rec) => rec.priority === filter)
  }, [filter, recommendations])

  return (
    <>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-foreground">{pageTitle}</h1>
        <p className="text-muted-foreground">{pageDescription}</p>
      </div>
      <form
        className="mb-8 rounded-none border border-border bg-card p-6"
        onSubmit={fetchRecommendations}
        autoComplete="off"
      >
        <div className="mb-4">
          <label
            htmlFor="clientId"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Client ID (UUID)
          </label>
          <input
            id="clientId"
            name="clientId"
            type="text"
            required
            pattern="[0-9a-fA-F-]{36}"
            className="w-full rounded-none border border-input px-3 py-2"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="indications"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Indications (comma-separated)
          </label>
          <input
            id="indications"
            name="indications"
            type="text"
            required
            className="w-full rounded-none border border-input px-3 py-2"
            value={indications}
            onChange={(e) => setIndications(e.target.value)}
            placeholder="e.g. depression, anxiety"
          />
        </div>
        <button
          type="submit"
          className="hover:bg-primary/90 rounded-none bg-primary px-6 py-2 font-semibold text-primary-foreground transition disabled:opacity-35"
          disabled={loading}
        >
          Fetch Recommendations
        </button>
      </form>

      <div className="mb-6 flex gap-2">
        <button
          type="button"
          className={`filter-btn${filter === 'all' ? ' active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          type="button"
          className={`filter-btn${filter === 'high' ? ' active' : ''}`}
          onClick={() => setFilter('high')}
        >
          High Priority
        </button>
        <button
          type="button"
          className={`filter-btn${filter === 'medium' ? ' active' : ''}`}
          onClick={() => setFilter('medium')}
        >
          Medium
        </button>
        <button
          type="button"
          className={`filter-btn${filter === 'low' ? ' active' : ''}`}
          onClick={() => setFilter('low')}
        >
          Low
        </button>
      </div>

      {loading && (
        <div className="text-muted-foreground">Loading recommendations...</div>
      )}
      {error && <div className="font-medium text-foreground">{error}</div>}

      {!loading && !error && filteredRecommendations.length > 0 && (
        <RecommendationDisplay recommendations={filteredRecommendations} />
      )}
    </>
  )
}

export default TreatmentPlanner

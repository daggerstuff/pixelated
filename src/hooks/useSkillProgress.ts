import { useEffect, useState } from 'react'
import type { TherapistSession } from '@/types/dashboard'

export type SkillProgress = {
  skill: string
  score: number
  trend: 'up' | 'down' | 'stable'
}

type UseSkillProgressResult = {
  data: SkillProgress[] | null
  loading: boolean
  error: Error | null
}

/**
 * useSkillProgress - returns skill progress for a therapist session.
 * It prefers session.provided skill data if present, otherwise attempts
 * to fetch from a (placeholder) service. The fetching implementation
 * is intentionally lightweight so it can be replaced by a real API
 * call (useQuery/React Query, SWR, or fetch) in the future.
 */
export function useSkillProgress(
  session?: TherapistSession,
): UseSkillProgressResult {
  const [data, setData] = useState<SkillProgress[] | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let mounted = true

    setLoading(true)
    setError(null)
      ; (async () => {
        try {
          if (!session) {
            if (mounted) {
              setData([])
            }
            return
          }

          // If session directly contains skill progress, use it.
          if ((session as any).skills && Array.isArray((session as any).skills)) {
            const normalized = (session as any).skills.map((s: any) => ({
              skill: String(s.skill || s.name || 'Unknown'),
              score: Number(s.score ?? 0),
              trend: s.trend === 'up' || s.trend === 'down' ? s.trend : 'stable',
            })) as SkillProgress[]

            if (mounted) {
              setData(normalized)
            }
          } else if (session.progressMetrics?.skillScores) {
            const derived = Object.entries(session.progressMetrics.skillScores).map(
              ([skill, score]) => ({
                skill,
                score,
                trend: 'stable' as const,
              }),
            )
            if (mounted) {
              setData(derived)
            }
          } else {
            // Placeholder: simulate fetching derived metrics from a local calculation or service
            // In production, replace with an API call or a call to a context/service.
            await new Promise((r) => setTimeout(r, 250))
            const derived: SkillProgress[] = [
              { skill: 'Active Listening', score: 0, trend: 'stable' },
              { skill: 'Empathy', score: 0, trend: 'stable' },
              { skill: 'Questioning', score: 0, trend: 'stable' },
            ]

            if (mounted) {
              setData(derived)
            }
          }
        } catch (err: any) {
          if (mounted) {
            setError(err instanceof Error ? err : new Error(String(err)))
          }
        } finally {
          if (mounted) {
            setLoading(false)
          }
        }
      })()

    return () => {
      mounted = false
    }
  }, [session])

  return { data, loading, error }
}

export default useSkillProgress

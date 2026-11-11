/**
 * What the training session page renders after its data load (VAL-UX-001).
 *
 * An outage is not a missing session, and a 5xx is never an absence. The
 * underlying status decides:
 *
 *  - `ready` — a 2xx whose body is a training session.
 *  - `unavailable` — a 5xx (the 8 s deadline's 503, a database-availability
 *    503), a 2xx whose body is not a training session, or a load that produced
 *    no status at all (a thrown network failure). The trainee gets the
 *    temporarily-unavailable surface with a retry control that preserves the
 *    session URL.
 *  - `not-found` — a 4xx: a genuine absence (404) or a refusal such as 403.
 *    Keeps the existing `/training?error=session-not-found` redirect.
 *
 * This lives beside the page rather than in `lib/` because the granted area is
 * `apps/web/src/pages/training/**`; the leading underscore keeps Astro's router
 * from treating it as a route (the same convention as
 * `pages/api/session/_legacy-surface.ts`).
 */
export type TrainingSessionLoadState = 'ready' | 'not-found' | 'unavailable'

export const classifyTrainingSessionLoad = (
  status: number | null,
  hasValidBody: boolean,
): TrainingSessionLoadState => {
  // No status means the load threw before producing a response.
  if (status === null) return 'unavailable'
  if (status >= 500) return 'unavailable'
  if (status >= 200 && status < 300) {
    return hasValidBody ? 'ready' : 'unavailable'
  }
  return 'not-found'
}

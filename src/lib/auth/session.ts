// Session handling for authentication

import type { SessionData } from './types'
import { getSession as getStoredSession } from '@/lib/sessionStore'

/**
 * Retrieve a session by its ID.
 * Delegates to the generic sessionStore implementation.
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
  return await getStoredSession(sessionId)
}

export type { SessionData }

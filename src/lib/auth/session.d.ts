import type { Session, User } from '@supabase/supabase-js'

export interface SessionData {
  user: User
  session: Session
}

export declare function getSession(
  request: Request,
): Promise<SessionData | null>
export declare function createSession(user: User): Promise<SessionData | null>
export declare function endSession(
  sessionId: string,
  userId: string,
): Promise<void>

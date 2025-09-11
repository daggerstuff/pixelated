// Minimal session store for API endpoint

let sessionStore: Record<string, unknown> = {}

export async function getSession(sessionId: string) {
  // Return stored session if exists
  return sessionStore[sessionId] || null
}

export async function saveSession(sessionData: Record<string, unknown>) {
  // Save session by id
  if (!('id' in sessionData) || typeof sessionData.id !== 'string') {
    throw new Error('Session data must have a string id')
  }
  sessionStore[sessionData.id] = { ...sessionData }
  return { ...sessionData, saved: true }
}

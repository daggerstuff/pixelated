// Minimal evaluation store for API endpoint
export async function getEvaluations(sessionId: string) {
  // TODO: Replace with real DB lookup
  if (sessionId === 'test-session') {
    return [{ sessionId, feedback: 'Excellent session.' }]
  }
  return []
}

export async function saveEvaluation(sessionId: string, feedback: string) {
  // TODO: Replace with real DB save
  return { sessionId, feedback, saved: true }
}

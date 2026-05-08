// In-memory evaluation store for API endpoint
const evaluations = new Map<
  string,
  Array<{ sessionId: string; feedback: string }>
>()

export async function getEvaluations(
  sessionId: string,
): Promise<Array<{ sessionId: string; feedback: string }>> {
  return evaluations.get(sessionId) || []
}

export async function saveEvaluation(
  sessionId: string,
  feedback: string,
): Promise<{ sessionId: string; feedback: string; saved: boolean }> {
  if (!evaluations.has(sessionId)) {
    evaluations.set(sessionId, [])
  }
  const sessionEvaluations = evaluations.get(sessionId)!
  sessionEvaluations.push({ sessionId, feedback })
  return { sessionId, feedback, saved: true }
}

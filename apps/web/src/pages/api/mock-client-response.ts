const mockResponses = [
  'Can you tell me more about your approach?',
  'I am feeling anxious today.',
  'What would you do if I said I was at risk?',
  'Thank you for listening.',
  'I am not sure how to talk about my feelings.',
]

export const POST = async ({ request }) => {
  const { message } = await request.json()
  if (!message) {
    return new Response(JSON.stringify({ error: 'Missing message' }), {
      status: 400,
    })
  }
  const idx = Math.floor(Math.random() * mockResponses.length)
  return new Response(
    JSON.stringify({
      response: `Mock client says: ${message}. ${mockResponses[idx]}`,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

// Simple mock API endpoint for therapist training simulator
// Compatible with Astro API routes or Express

const mockResponses = [
  'Can you tell me more about your approach?',
  'I am feeling anxious today.',
  'What would you do if I said I was at risk?',
  'Thank you for listening.',
  'I am not sure how to talk about my feelings.',
]

export async function handler() {
  const idx = Math.floor(Math.random() * mockResponses.length)
  return new Response(JSON.stringify({ message: mockResponses[idx] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

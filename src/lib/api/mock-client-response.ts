function generateMockResponse(input: string): string {
  return `Mock client says: ${input}`
}

export async function POST(context: any) {
  const { request } = context
  const body = await request.json()
  const { message } = body

  if (!message) {
    return new Response(JSON.stringify({ error: 'Message required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const reply = generateMockResponse(message)
  return new Response(JSON.stringify({ reply }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

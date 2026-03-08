import { getSession, saveSession } from '@/lib/sessionStore'

export async function GET(context: any) {
  const { request } = context
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('id')

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Session ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const session = await getSession(sessionId)
  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(session), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(context: any) {
  const { request } = context
  const sessionData = await request.json()

  const saved = await saveSession(sessionData)
  return new Response(JSON.stringify(saved), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}

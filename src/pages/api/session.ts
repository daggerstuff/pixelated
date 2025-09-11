import { getSession, saveSession } from '@/lib/sessionStore'

export const GET = async ({ request }) => {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('id')
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Missing session id' }), {
      status: 400,
    })
  }
  const session = await getSession(sessionId)
  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
    })
  }
  return new Response(JSON.stringify(session), { status: 200 })
}

export const POST = async ({ request }) => {
  const sessionData = await request.json()
  const saved = await saveSession(sessionData)
  return new Response(JSON.stringify(saved), { status: 201 })
}

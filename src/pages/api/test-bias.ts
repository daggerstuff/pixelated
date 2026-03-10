// Deprecated test endpoint retained only to satisfy lint. Returns 410 Gone.
export const prerender = false

export async function GET() {
    return new Response('Gone', { status: 410 })
}

export async function POST() {
    return new Response(JSON.stringify({ success: false, error: 'Deprecated' }), {
        status: 410,
        headers: { 'content-type': 'application/json' },
    })
}

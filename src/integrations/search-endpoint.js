// Basic endpoint for search functionality
export function GET() {
  return new Response(
    JSON.stringify({
      message: 'Search index endpoint',
      status: 'active',
      results: [],
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}

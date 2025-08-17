// import type { APIRoute } from 'astro'

// Simulates a CPU-intensive operation
async function performHeavyComputation(): Promise<number> {
  // This is a simple yet CPU-intensive operation for demo purposes
  let result = 0
  for (let i = 0; i < 10000000; i++) {
    result += Math.sin(i * 0.01) * Math.cos(i * 0.01)
  }
  return result
}

// Simulates a database query
async function simulateDatabaseQuery(): Promise<Record<string, unknown>> {
  // Simulate DB query delay
  await new Promise((resolve) => setTimeout(resolve, 300))
  return { id: 1, name: 'Example Record', value: Math.random() * 100 }
}

export const GET = async (_) => {
  try {
    // Directly call the computation function
    const computationResult = await performHeavyComputation()

    // Directly call the database simulation function
    const dbResult = await simulateDatabaseQuery()

    // Return the results
    return new Response(
      JSON.stringify({
        success: true,
        computationResult,
        dbResult,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error) {
    console.error('Error in profiling demo API:', error)
    const isProd = process.env.NODE_ENV === 'production'
    return new Response(
      JSON.stringify({
        success: false,
        error: isProd
          ? 'Internal server error'
          : error instanceof Error
            ? error.message
            : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}

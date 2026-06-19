// Health check endpoint for ECS ALB and container health checks
// Matches the path used by the ECS task definition health check

export const GET = async () => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
  }

  return new Response(JSON.stringify(healthData), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}

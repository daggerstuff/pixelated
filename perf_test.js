const endpoints = [
  '/api/components/analytics/charts',
  '/api/components/emotions/3d-visualization',
  '/api/components/treatment-plans/enhanced',
  '/api/components/particles/emotion-system',
  '/api/components/ui/carousel-content',
];

async function fetchSim(url) {
  return {ok: true, status: 200};
}

async function currentImpl() {
  const start = performance.now();
  for (let i = 0; i < 10000; i++) {
    const healthChecks = await Promise.allSettled(
      endpoints.map(async (endpoint) => {
        const response = await fetchSim(endpoint);
        return { endpoint, status: response.status, ok: response.ok }
      })
    );
    const health = {
      overall: healthChecks.every(
        (check) => check.status === 'fulfilled' && check.value.ok,
      ) ? 'healthy' : 'degraded',
      services: healthChecks.map((check) => ({
        endpoint: check.status === 'fulfilled' ? check.value.endpoint : 'unknown',
        status: check.status === 'fulfilled' ? (check.value.ok ? 'healthy' : 'unhealthy') : 'error',
        error: check.status === 'rejected' ? check.reason : null,
      })),
      timestamp: 'mock',
    };
  }
  return performance.now() - start;
}

async function optimizedImpl() {
  const start = performance.now();
  for (let i = 0; i < 10000; i++) {
    const services = await Promise.all(
      endpoints.map(async (endpoint) => {
        try {
          const response = await fetchSim(endpoint);
          return {
            endpoint,
            status: response.ok ? 'healthy' : 'unhealthy',
            error: null,
          };
        } catch (error) {
          return {
            endpoint: 'unknown',
            status: 'error',
            error,
          };
        }
      })
    );
    const health = {
      overall: services.every((s) => s.status === 'healthy') ? 'healthy' : 'degraded',
      services,
      timestamp: 'mock',
    };
  }
  return performance.now() - start;
}

async function run() {
  console.log("Current:", await currentImpl());
  console.log("Optimized:", await optimizedImpl());
}
run();

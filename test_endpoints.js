const fetchSim = (url) => new Promise(r => setTimeout(() => r({status: 200, ok: true}), 20));

async function run() {
  const endpoints = ['a','b','c','d','e'];
  const baseUrl = "x";
  const authHeaders = {};

  const start = performance.now();
  const healthChecks = await Promise.allSettled(
    endpoints.map(async (endpoint) => {
      const response = await fetchSim(
        `${baseUrl}${endpoint}?healthCheck=true`,
        {
          method: 'HEAD',
          headers: authHeaders,
        },
      )
      return { endpoint, status: response.status, ok: response.ok }
    }),
  );
  console.log("Current (Promise.allSettled + map + async func + await):", performance.now() - start);

  const start2 = performance.now();
  const healthChecks2 = [];
  for (const endpoint of endpoints) {
    try {
      const response = await fetchSim(
        `${baseUrl}${endpoint}?healthCheck=true`,
        {
          method: 'HEAD',
          headers: authHeaders,
        },
      )
      healthChecks2.push({ status: 'fulfilled', value: { endpoint, status: response.status, ok: response.ok } });
    } catch(e) {
      healthChecks2.push({ status: 'rejected', reason: e });
    }
  }
  console.log("Sequential loop (what the prompt implies was here originally, maybe?):", performance.now() - start2);

}

run();

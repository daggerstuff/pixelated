const endpoints = Array.from({length: 5}, (_, i) => i);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchSim() {
  await sleep(20);
  return {ok: true, status: 200};
}

async function currentImpl() {
  const start = performance.now();
  const healthChecks = await Promise.allSettled(
    endpoints.map(async (endpoint) => {
      const response = await fetchSim();
      return { endpoint, status: response.status, ok: response.ok }
    })
  );
  return performance.now() - start;
}

async function loopImpl() {
  const start = performance.now();
  const healthChecks = [];
  for (const endpoint of endpoints) {
    try {
        const response = await fetchSim();
        healthChecks.push({status: 'fulfilled', value: { endpoint, status: response.status, ok: response.ok }});
    } catch(e) {
        healthChecks.push({status: 'rejected', reason: e});
    }
  }
  return performance.now() - start;
}

async function newImpl() {
  const start = performance.now();
  const healthChecks = await Promise.all(
    endpoints.map(async (endpoint) => {
      try {
        const response = await fetchSim();
        return { status: 'fulfilled', value: { endpoint, status: response.status, ok: response.ok } };
      } catch (e) {
        return { status: 'rejected', reason: e };
      }
    })
  );
  return performance.now() - start;
}

async function run() {
  console.log("Current (allSettled):", await currentImpl());
  console.log("Loop (Sequential):", await loopImpl());
  console.log("New (Promise.all+catch):", await newImpl());
}
run();

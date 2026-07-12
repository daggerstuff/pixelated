const endpoints = [
  '/api/components/analytics/charts',
  '/api/components/emotions/3d-visualization',
  '/api/components/treatment-plans/enhanced',
  '/api/components/particles/emotion-system',
  '/api/components/ui/carousel-content',
];

async function sequential() {
  const results = [];
  for (const endpoint of endpoints) {
    const res = await new Promise(r => setTimeout(() => r(endpoint), 10));
    results.push(res);
  }
  return results;
}

async function parallel() {
  return await Promise.allSettled(endpoints.map(async (e) => {
    return await new Promise(r => setTimeout(() => r(e), 10));
  }));
}

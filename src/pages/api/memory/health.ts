export const prerender = false

/**
 * Proxy health check to Cipher memory API
 * GET /api/memory/health
 */
export const GET = async () => {
  const start = Date.now();
  const baseUrl = process.env['CIPHER_API_URL'] || 'http://localhost:3000';
  const url = `${baseUrl.replace(/\/+$/, '')}/health`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const payload = await res.json();
    const response = {
      ...payload,
      proxyLatencyMs: Date.now() - start,
    };
    return new Response(JSON.stringify(response, null, 2), {
      status: res.ok ? 200 : res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

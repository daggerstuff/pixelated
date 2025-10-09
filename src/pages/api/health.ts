import type { APIRoute } from 'astro';

const startTime = Date.now();

export const GET: APIRoute = () => {
  try {
    const now = new Date();
    const uptime = Date.now() - startTime;
    const memUsage = process.memoryUsage();

    // Calculate memory pressure
    const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const memPressure = memUsedMB / memTotalMB;

    // Determine status based on memory pressure and uptime
    let status = 'healthy';
    if (memPressure > 0.9) {
      status = 'degraded';
    }
    if (memPressure > 0.95) {
      status = 'unhealthy';
    }

    const healthData = {
      status,
      timestamp: now.toISOString(),
      uptime: Math.floor(uptime / 1000),
      version: process.env['npm_package_version'] || '1.0.0',
      environment: process.env['NODE_ENV'] || 'development',
      memory: {
        used: memUsedMB,
        total: memTotalMB,
        pressure: Math.round(memPressure * 100) / 100,
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024)
      },
      nodeInfo: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid
      }
    };

    const statusCode = status === 'healthy' ? 200 :
      status === 'degraded' ? 200 : 503;

    return new Response(JSON.stringify(healthData), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    // Fallback response in case of any errors
    return new Response(JSON.stringify({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  }
};

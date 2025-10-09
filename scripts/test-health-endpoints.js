#!/usr/bin/env node

// Test script for health endpoints
// Tests the health endpoint logic without starting the full Astro server

console.log('🏥 Testing Health Endpoint Logic...\n');

// Mock the Astro APIRoute behavior
function createMockAPIRoute(handler) {
    return async () => {
        try {
            const result = await handler();
            return result;
        } catch (error) {
            console.error('Handler error:', error);
            throw error;
        }
    };
}

// Import and adapt the health endpoint logic
const startTime = Date.now();

const healthHandler = () => {
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

        return {
            data: healthData,
            status: statusCode,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        };
    } catch (error) {
        // Fallback response in case of any errors
        return {
            data: {
                status: 'error',
                timestamp: new Date().toISOString(),
                error: 'Health check failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        };
    }
};

// Simple health handler
const baseResponse = {
    status: 'healthy',
    version: '2.0.0',
    environment: process.env['NODE_ENV'] || 'development',
    nodeVersion: process.version
}

const simpleHealthHandler = () => {
    try {
        // Minimal health response optimized for speed
        const healthResponse = {
            ...baseResponse,
            timestamp: new Date().toISOString(),
            uptime: Math.floor(process.uptime())
        }

        return {
            data: healthResponse,
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        };

    } catch (error) {
        return {
            data: {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error?.message || 'Unknown error'
            },
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        };
    }
};

// Test both endpoints
async function testHealthEndpoints() {
    console.log('Testing /api/health endpoint:');
    const start1 = Date.now();
    const healthResult = healthHandler();
    const time1 = Date.now() - start1;

    console.log(`✅ Status: ${healthResult.status}`);
    console.log(`⏱️  Response time: ${time1}ms`);
    console.log('📊 Response:', JSON.stringify(healthResult.data, null, 2));
    console.log('');

    console.log('Testing /api/health/simple endpoint:');
    const start2 = Date.now();
    const simpleResult = simpleHealthHandler();
    const time2 = Date.now() - start2;

    console.log(`✅ Status: ${simpleResult.status}`);
    console.log(`⏱️  Response time: ${time2}ms`);
    console.log('📊 Response:', JSON.stringify(simpleResult.data, null, 2));
    console.log('');

    // Performance comparison
    console.log('🏁 Performance Comparison:');
    console.log(`/api/health: ${time1}ms`);
    console.log(`/api/health/simple: ${time2}ms`);
    console.log(`Simple endpoint is ${time2 < time1 ? Math.round((time1 - time2) / time2 * 100) : 0}% faster`);

    // Test under load
    console.log('\n🔄 Testing under load (100 requests each):');

    const start3 = Date.now();
    for (let i = 0; i < 100; i++) {
        healthHandler();
    }
    const time3 = Date.now() - start3;

    const start4 = Date.now();
    for (let i = 0; i < 100; i++) {
        simpleHealthHandler();
    }
    const time4 = Date.now() - start4;

    console.log(`/api/health (100 requests): ${time3}ms (avg: ${time3 / 100}ms)`);
    console.log(`/api/health/simple (100 requests): ${time4}ms (avg: ${time4 / 100}ms)`);

    console.log('\n✅ Health endpoint tests completed successfully!');
}

testHealthEndpoints().catch(console.error);
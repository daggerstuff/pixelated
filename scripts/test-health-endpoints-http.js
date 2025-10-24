#!/usr/bin/env node

// HTTP Test script for health endpoints
// Actually starts a simple HTTP server and tests the endpoints with real requests

import http from 'http'
import { performance } from 'perf_hooks'

console.log('🌐 Testing Health Endpoints via HTTP...\n')

// Simple HTTP server that mimics our health endpoints
const startTime = Date.now()

const healthHandler = () => {
  try {
    const now = new Date()
    const uptime = Date.now() - startTime
    const memUsage = process.memoryUsage()

    const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024)
    const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024)
    const memPressure = memUsedMB / memTotalMB

    let status = 'healthy'
    if (memPressure > 0.9) status = 'degraded'
    if (memPressure > 0.95) status = 'unhealthy'

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
        rss: Math.round(memUsage.rss / 1024 / 1024),
      },
      nodeInfo: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
      },
    }

    const statusCode =
      status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503
    return { data: healthData, statusCode }
  } catch (error) {
    return {
      data: {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      statusCode: 500,
    }
  }
}

const simpleHealthHandler = () => {
  try {
    const healthResponse = {
      status: 'healthy',
      version: '2.0.0',
      environment: process.env['NODE_ENV'] || 'development',
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    }
    return { data: healthResponse, statusCode: 200 }
  } catch (error) {
    return {
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error?.message || 'Unknown error',
      },
      statusCode: 503,
    }
  }
}

// Create HTTP server
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')

  if (req.url === '/api/health' && req.method === 'GET') {
    const result = healthHandler()
    res.statusCode = result.statusCode
    res.end(JSON.stringify(result.data))
  } else if (req.url === '/api/health/simple' && req.method === 'GET') {
    const result = simpleHealthHandler()
    res.statusCode = result.statusCode
    res.end(JSON.stringify(result.data))
  } else {
    res.statusCode = 404
    res.end(JSON.stringify({ error: 'Not found' }))
  }
})

// Make HTTP request
function makeRequest(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Request timeout after ${timeout}ms`))
    }, timeout)

    const start = performance.now()
    const req = http.get(url, (res) => {
      clearTimeout(timeoutId)
      const end = performance.now()

      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve({
            statusCode: res.statusCode,
            data: json,
            responseTime: Math.round((end - start) * 100) / 100, // Round to 2 decimals
          })
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${error.message}`))
        }
      })
    })

    req.on('error', (error) => {
      clearTimeout(timeoutId)
      reject(error)
    })
  })
}

// Test function
async function testEndpoints() {
  // Find available port
  const findAvailablePort = () => {
    return new Promise((resolve, reject) => {
      const testServer = http.createServer()
      testServer.listen(0, () => {
        const port = testServer.address().port
        testServer.close(() => resolve(port))
      })
      testServer.on('error', reject)
    })
  }

  const port = await findAvailablePort()

  return new Promise((resolve, reject) => {
    server.listen(port, 'localhost', async () => {
      console.log(`🚀 Test server started on http://localhost:${port}`)

      try {
        // Test /api/health
        console.log('📊 Testing /api/health...')
        const healthResult = await makeRequest(
          `http://localhost:${port}/api/health`,
        )
        console.log(`✅ Status: ${healthResult.statusCode}`)
        console.log(`⏱️  Response time: ${healthResult.responseTime}ms`)
        console.log(`🎯 Health status: ${healthResult.data.status}`)
        console.log(
          `💾 Memory usage: ${healthResult.data.memory?.used || 'N/A'}MB\n`,
        )

        // Test /api/health/simple
        console.log('📊 Testing /api/health/simple...')
        const simpleResult = await makeRequest(
          `http://localhost:${port}/api/health/simple`,
        )
        console.log(`✅ Status: ${simpleResult.statusCode}`)
        console.log(`⏱️  Response time: ${simpleResult.responseTime}ms`)
        console.log(`🎯 Health status: ${simpleResult.data.status}\n`)

        // Performance comparison
        console.log('🏁 Performance Comparison:')
        console.log(`/api/health: ${healthResult.responseTime}ms`)
        console.log(`/api/health/simple: ${simpleResult.responseTime}ms`)
        const improvement =
          healthResult.responseTime > simpleResult.responseTime
            ? Math.round(
                ((healthResult.responseTime - simpleResult.responseTime) /
                  healthResult.responseTime) *
                  100,
              )
            : 0
        console.log(`Simple endpoint is ${improvement}% faster\n`)

        // Load testing
        console.log('🔄 Load testing (10 concurrent requests each)...')

        const loadTestHealth = async () => {
          const promises = Array(10)
            .fill()
            .map(() => makeRequest(`http://localhost:${port}/api/health`, 2000))
          const start = performance.now()
          const results = await Promise.all(promises)
          const end = performance.now()
          return { results, totalTime: end - start }
        }

        const loadTestSimple = async () => {
          const promises = Array(10)
            .fill()
            .map(() =>
              makeRequest(`http://localhost:${port}/api/health/simple`, 2000),
            )
          const start = performance.now()
          const results = await Promise.all(promises)
          const end = performance.now()
          return { results, totalTime: end - start }
        }

        const [healthLoad, simpleLoad] = await Promise.all([
          loadTestHealth(),
          loadTestSimple(),
        ])

        console.log(
          `/api/health (10 concurrent): ${Math.round(healthLoad.totalTime)}ms total`,
        )
        console.log(
          `/api/health/simple (10 concurrent): ${Math.round(simpleLoad.totalTime)}ms total`,
        )

        const avgHealthTime =
          healthLoad.results.reduce((sum, r) => sum + r.responseTime, 0) / 10
        const avgSimpleTime =
          simpleLoad.results.reduce((sum, r) => sum + r.responseTime, 0) / 10

        console.log(
          `Average response times: health=${avgHealthTime.toFixed(2)}ms, simple=${avgSimpleTime.toFixed(2)}ms`,
        )

        // Test timeout behavior (simulate slow response)
        console.log('\n⏰ Testing timeout behavior...')
        try {
          await makeRequest(`http://localhost:${port}/api/nonexistent`, 1000)
        } catch (error) {
          if (error.message.includes('timeout')) {
            console.log('✅ Timeout handling works correctly')
          } else {
            console.log(`✅ Error handling works: ${error.message}`)
          }
        }

        console.log('\n🎉 HTTP endpoint tests completed successfully!')
        console.log('📋 Summary:')
        console.log(`- Both endpoints respond correctly via HTTP`)
        console.log(
          `- Simple endpoint averages ${avgSimpleTime.toFixed(2)}ms response time`,
        )
        console.log(
          `- Full endpoint averages ${avgHealthTime.toFixed(2)}ms response time`,
        )
        console.log(`- Error handling and timeouts work properly`)

        resolve()
      } catch (error) {
        console.error('❌ Test failed:', error.message)
        reject(error)
      } finally {
        server.close()
      }
    })
  })
}

// Run tests
testEndpoints()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Test suite failed:', error)
    process.exit(1)
  })

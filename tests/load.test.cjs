const autocannon = require('autocannon')

const loadTest = async () => {
  const result = await autocannon({
    url: 'http://localhost:3000',
    connections: 100,
    duration: 30,
    requests: [
      {
        method: 'GET',
        path: '/api/health',
      },
      {
        method: 'POST',
        path: '/api/auth/login',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
        }),
      },
      {
        method: 'GET',
        path: '/api/documents',
        headers: {
          Authorization: 'Bearer test-token',
        },
      },
      {
        method: 'POST',
        path: '/api/documents',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
          title: 'Load Test Document',
          content: 'This is a load test document content',
        }),
      },
    ],
  })

  console.log('Load Test Results:', result)

  // Assert performance thresholds
  if (result.errors > 0 || result.timeouts > 0) {
    throw new Error('Load test failed with errors or timeouts')
  }

  if (result.requests.average > 1000) {
    throw new Error('Average response time too high')
  }

  return result
}

if (require.main === module) {
  loadTest().catch(console.error)
}

module.exports = loadTest

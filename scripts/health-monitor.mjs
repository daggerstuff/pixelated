import express from 'express'
import axios from 'axios'

const app = express()
const PORT = process.env.PORT || 3003

// Health check endpoints to monitor
const ENDPOINTS = [
  { name: 'Main Site', url: process.env.BASE_URL || 'https://pixelatedempathy.com' },
  { name: 'Health API', url: `${process.env.BASE_URL || 'https://pixelatedempathy.com'}/api/health/simple` },
  { name: 'Full Health', url: `${process.env.BASE_URL || 'https://pixelatedempathy.com'}/api/health` },
]

// Slack webhook for notifications
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL

let lastStatus = {}

async function checkEndpoint(endpoint) {
  const startTime = Date.now()
  
  try {
    const response = await axios.get(endpoint.url, {
      timeout: 10000,
      validateStatus: () => true // Accept any status code
    })
    
    const responseTime = Date.now() - startTime
    const status = response.status === 200 ? 'up' : response.status < 500 ? 'degraded' : 'down'
    
    return {
      endpoint: endpoint.name,
      status,
      responseTime,
      httpCode: response.status,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      endpoint: endpoint.name,
      status: 'down',
      responseTime: Date.now() - startTime,
      httpCode: 0,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function sendSlackAlert(status, isRecovery = false) {
  if (!SLACK_WEBHOOK) return

  const emoji = isRecovery ? '✅' : status.status === 'down' ? '🚨' : '⚠️'
  const message = isRecovery 
    ? `${emoji} RECOVERED: ${status.endpoint} is back online`
    : `${emoji} ALERT: ${status.endpoint} is ${status.status.toUpperCase()}`
  
  const payload = {
    text: message,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${message}\n\n*Status:* ${status.status}\n*Response Time:* ${status.responseTime}ms\n*HTTP Code:* ${status.httpCode}\n*Time:* ${status.timestamp}${status.error ? `\n*Error:* ${status.error}` : ''}`
        }
      }
    ]
  }

  try {
    await axios.post(SLACK_WEBHOOK, payload)
  } catch (error) {
    console.error('Failed to send Slack alert:', error)
  }
}

async function runHealthCheck() {
  console.log(`🏥 Running health check at ${new Date().toISOString()}`)
  
  const results = []
  
  for (const endpoint of ENDPOINTS) {
    try {
      const status = await checkEndpoint(endpoint)
      results.push(status)
      
      const lastEndpointStatus = lastStatus[endpoint.name]
      
      // Check if status changed
      if (lastEndpointStatus) {
        if (lastEndpointStatus.status !== 'up' && status.status === 'up') {
          // Recovery
          await sendSlackAlert(status, true)
        } else if (lastEndpointStatus.status === 'up' && status.status !== 'up') {
          // New failure
          await sendSlackAlert(status, false)
        }
      } else if (status.status !== 'up') {
        // First check and it's not up
        await sendSlackAlert(status, false)
      }
      
      lastStatus[endpoint.name] = status
      
      console.log(`${status.status === 'up' ? '✅' : status.status === 'degraded' ? '⚠️' : '❌'} ${endpoint.name}: ${status.status} (${status.responseTime}ms, HTTP ${status.httpCode})`)
    } catch (error) {
      console.error(`Error checking ${endpoint.name}:`, error)
    }
    
    // Small delay between checks
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  return results
}

// API endpoint to get current status
app.get('/status', async (req, res) => {
  try {
    const results = await runHealthCheck()
    res.json({
      timestamp: new Date().toISOString(),
      results,
      summary: {
        total: results.length,
        up: results.filter(r => r.status === 'up').length,
        degraded: results.filter(r => r.status === 'degraded').length,
        down: results.filter(r => r.status === 'down').length
      }
    })
  } catch (error) {
    res.status(500).json({ error: 'Health check failed' })
  }
})

// Health check for this service itself
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

// Start the server
app.listen(PORT, () => {
  console.log(`Health check service running on port ${PORT}`)
  
  // Run initial check
  runHealthCheck()
  
  // Schedule regular checks every 2 minutes
  setInterval(runHealthCheck, 2 * 60 * 1000)
})

export default app

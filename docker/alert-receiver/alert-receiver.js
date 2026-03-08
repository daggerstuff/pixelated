const express = require('express')
const axios = require('axios')

// Environment configuration with defaults
const config = {
  port: parseInt(process.env.PORT) || 4321,
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000, // 1 minute
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 10, // 10 requests per window
  axiosTimeout: parseInt(process.env.AXIOS_TIMEOUT) || 5000, // 5 seconds
  logLevel: process.env.LOG_LEVEL || 'info',
}

// Validate required environment variables
if (!config.slackWebhookUrl) {
  console.warn(
    'WARNING: SLACK_WEBHOOK_URL not configured. Alerts will only be logged.',
  )
}

const app = express()
const ipRequests = new Map()

app.use(express.json())

// Rate limiting middleware
function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress
  const now = Date.now()
  const requests = ipRequests.get(ip) || []

  // Filter out requests outside the window
  const recentRequests = requests.filter(
    (time) => now - time < config.rateLimitWindow,
  )

  // Check if limit exceeded
  if (recentRequests.length >= config.rateLimitMax) {
    console.warn(`Rate limit exceeded for IP: ${ip}`)
    return res.status(429).json({ error: 'Rate limit exceeded' })
  }

  // Add current request
  recentRequests.push(now)
  ipRequests.set(ip, recentRequests)

  next()
}

app.use(rateLimit)

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [ip, requests] of ipRequests.entries()) {
    const recentRequests = requests.filter(
      (time) => now - time < config.rateLimitWindow,
    )
    if (recentRequests.length === 0) {
      ipRequests.delete(ip)
    } else {
      ipRequests.set(ip, recentRequests)
    }
  }
}, config.rateLimitWindow)

// Simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

// Basic input validation for alerts
function validateAlert(alert) {
  if (!alert || typeof alert !== 'object') {
    return false
  }

  // Required fields check
  if (!alert.status) {
    return false
  }

  // Status must be either 'firing' or 'resolved'
  if (alert.status !== 'firing' && alert.status !== 'resolved') {
    return false
  }

  return true
}

// Sanitize alert data to prevent injection attacks
function sanitizeAlertData(alert) {
  const sanitized = {}

  // Copy only expected fields
  if (alert.status) {
    sanitized.status = String(alert.status).substring(0, 20) // Limit length
  }

  if (alert.labels && typeof alert.labels === 'object') {
    sanitized.labels = {}
    const allowedLabels = ['alertname', 'instance', 'job', 'severity']
    for (const label of allowedLabels) {
      if (alert.labels[label]) {
        sanitized.labels[label] = String(alert.labels[label]).substring(0, 100)
      }
    }
  }

  if (alert.annotations && typeof alert.annotations === 'object') {
    sanitized.annotations = {}
    const allowedAnnotations = ['summary', 'description']
    for (const annotation of allowedAnnotations) {
      if (alert.annotations[annotation]) {
        sanitized.annotations[annotation] = String(
          alert.annotations[annotation],
        ).substring(0, 500)
      }
    }
  }

  return sanitized
}

// Webhook endpoint for Prometheus alerts
app.post('/webhook', async (req, res) => {
  try {
    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      console.warn('Invalid request body received')
      return res.status(400).json({ error: 'Invalid request body' })
    }

    const alerts = Array.isArray(req.body.alerts) ? req.body.alerts : []

    console.info(`Processing ${alerts.length} alerts`)

    for (const alert of alerts) {
      // Validate individual alert
      if (!validateAlert(alert)) {
        console.warn('Invalid alert data received', {
          alert: JSON.stringify(alert),
        })
        continue
      }

      // Sanitize alert data
      const sanitizedAlert = sanitizeAlertData(alert)

      const message = {
        text: `🚨 Alert: ${sanitizedAlert.annotations?.summary || sanitizedAlert.labels?.alertname}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${sanitizedAlert.status === 'firing' ? '🚨 FIRING' : '✅ RESOLVED'}*: ${sanitizedAlert.annotations?.summary || sanitizedAlert.labels?.alertname}\n\n*Description:* ${sanitizedAlert.annotations?.description || 'No description'}\n*Instance:* ${sanitizedAlert.labels?.instance || 'Unknown'}\n*Job:* ${sanitizedAlert.labels?.job || 'Unknown'}\n*Severity:* ${sanitizedAlert.labels?.severity || 'Unknown'}`,
            },
          },
        ],
      }

      if (config.slackWebhookUrl) {
        try {
          await axios.post(config.slackWebhookUrl, message, {
            timeout: config.axiosTimeout,
            headers: {
              'Content-Type': 'application/json',
            },
          })
          console.info(
            `Alert sent to Slack: ${sanitizedAlert.labels?.alertname}`,
          )
        } catch (slackError) {
          console.error('Error sending alert to Slack:', {
            error: slackError.message,
            code: slackError.code,
            status: slackError.response?.status,
            alertName: sanitizedAlert.labels?.alertname,
          })
        }
      } else {
        console.warn(
          'Alert received but no Slack webhook configured:',
          sanitizedAlert.labels?.alertname,
        )
      }
    }

    res.json({ status: 'ok', processed: alerts.length })
  } catch (error) {
    console.error('Error processing alert:', {
      error: error.message,
      stack: error.stack,
    })
    res.status(500).json({ error: 'Failed to process alert' })
  }
})

app.listen(config.port, () => {
  console.info(`Alert receiver running on port ${config.port}`)
  console.info('Webhook endpoint: /webhook')
  console.info('Health check: /health')
  console.info(
    `Rate limit: ${config.rateLimitMax} requests per ${config.rateLimitWindow}ms`,
  )
})

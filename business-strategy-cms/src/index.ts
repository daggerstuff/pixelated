// Simple Express server setup
import express from 'express'

const app = express()
const port = process.env['PORT'] || 3000

// Basic middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes placeholder
app.get('/api/v1', (req, res) => {
  res.json({ message: 'Business Strategy CMS API' })
})

// Start server
const startServer = async () => {
  try {
    console.log('Starting server...')

    const server = app.listen(port, () => {
      console.log(`Server running on port ${port}`)
      console.log(`Environment: ${process.env['NODE_ENV'] || 'development'}`)
    })

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      console.log(`Received ${signal}, shutting down gracefully`)
      server.close(() => {
        console.log('Server closed')
        process.exit(0)
      })
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  startServer()
}

export { app }

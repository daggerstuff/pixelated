#!/usr/bin/env node

// Import Astro's production server
import { createServer } from 'node:http'
import { handler as ssrHandler } from './dist/server/entry.mjs'

const port = process.env.PORT || process.env.WEBSITES_PORT || 4321
const host = process.env.HOST || '0.0.0.0'

// Create HTTP server with Astro SSR handler
const server = createServer(ssrHandler)

// Error handling
server.on('error', (err) => {
  console.error('Server error:', err)
  process.exit(1)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close(() => {
    console.log('Process terminated')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  server.close(() => {
    console.log('Process terminated')
    process.exit(0)
  })
})

// Start server
server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`)
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err)
  process.exit(1)
})

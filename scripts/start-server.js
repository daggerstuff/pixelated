#!/usr/bin/env node

// IMPORTANT: Import Sentry instrumentation first
import '../instrument.mjs'

import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

// Configuration
const HOST = process.env.HOST || '0.0.0.0'
const PORT = process.env.PORT || process.env.WEBSITES_PORT || 4321

console.log('🚀 Starting Pixelated Astro Server...')
console.log(`📍 Host: ${HOST}`)
console.log(`🔌 Port: ${PORT}`)
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)

async function startServer() {
  try {
    // Try to import the built server entry point
    const serverEntryPath = path.join(
      projectRoot,
      'dist',
      'server',
      'entry.mjs',
    )

    console.log(`📁 Looking for server entry at: ${serverEntryPath}`)

    // Import the server handler
    const { handler } = await import(serverEntryPath)

    // Create HTTP server
    const server = createServer((req, res) => {
      // Set CORS headers for development
      if (process.env.NODE_ENV !== 'production') {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader(
          'Access-Control-Allow-Methods',
          'GET, POST, PUT, DELETE, OPTIONS',
        )
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization',
        )

        if (req.method === 'OPTIONS') {
          res.writeHead(200)
          res.end()
          return
        }
      }

      // Handle the request with Astro
      handler(req, res)
    })

    // Start the server using the correct port for Azure App Service
    // Always use process.env.PORT or process.env.WEBSITES_PORT if set
    const effectivePort = process.env.PORT || process.env.WEBSITES_PORT || PORT || 4321;
    // Handle listen errors such as address already in use
    server.on('error', error => {
      if (error.code === 'EADDRINUSE') {
        console.warn(`⚠️ Port ${effectivePort} already in use, assuming server is already running`)
      } else {
        console.error('❌ Server encountered error:', error)
        process.exit(1)
      }
    })
    server.listen(effectivePort, HOST, () => {
      console.log(`✅ Server started successfully!`)
      console.log(`🌐 Local: http://localhost:${effectivePort}`)
      console.log(`🔗 Network: http://${HOST}:${effectivePort}`)
      console.log(`🏥 Health check: http://${HOST}:${effectivePort}/api/health/simple`)
    })

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('📥 SIGTERM received, shutting down gracefully...')
      server.close(() => {
        console.log('✅ Server closed successfully')
        process.exit(0)
      })
    })

    process.on('SIGINT', () => {
      console.log('📥 SIGINT received, shutting down gracefully...')
      server.close(() => {
        console.log('✅ Server closed successfully')
        process.exit(0)
      })
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  }
}

startServer()

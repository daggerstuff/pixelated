#!/usr/bin/env node

import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

const HOST = process.env.HOST || '0.0.0.0'
const PORT = process.env.PORT || process.env.WEBSITES_PORT || 4321

console.log('🚀 Starting Robust Pixelated Server...')
console.log(`📍 Host: ${HOST}`)
console.log(`🔌 Port: ${PORT}`)

async function startServer() {
  try {
    let handler = null
    
    // Try to load the Astro server handler
    const serverEntryPath = path.join(projectRoot, 'dist', 'server', 'entry.mjs')
    
    if (fs.existsSync(serverEntryPath)) {
      console.log('✅ Found Astro server entry, loading...')
      const serverModule = await import(serverEntryPath)
      handler = serverModule.handler
    } else {
      console.log('⚠️ Astro server entry not found, using fallback handler')
      
      // Fallback handler
      handler = (req, res) => {
        if (req.url === '/api/health/simple' || req.url === '/api/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
          return
        }
        
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Pixelated Empathy - Starting Up</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .container { max-width: 600px; margin: 0 auto; }
              .status { color: #007acc; font-size: 24px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🧠 Pixelated Empathy</h1>
              <div class="status">Application is starting up...</div>
              <p>The application is currently initializing. Please check back in a few moments.</p>
              <p><a href="/api/health/simple">Health Check</a></p>
            </div>
          </body>
          </html>
        `)
      }
    }

    const server = createServer(handler)

    server.listen(PORT, HOST, () => {
      console.log(`✅ Server started successfully!`)
      console.log(`🌐 URL: http://${HOST}:${PORT}`)
      console.log(`🏥 Health: http://${HOST}:${PORT}/api/health/simple`)
    })

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Port ${PORT} in use, trying ${PORT + 1}`)
        server.listen(PORT + 1, HOST)
      } else {
        console.error('❌ Server error:', err)
        process.exit(1)
      }
    })

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('📥 SIGTERM received, shutting down...')
      server.close(() => process.exit(0))
    })

    process.on('SIGINT', () => {
      console.log('📥 SIGINT received, shutting down...')
      server.close(() => process.exit(0))
    })

  } catch (error) {
    console.error('❌ Server startup failed:', error.message)
    process.exit(1)
  }
}

startServer()
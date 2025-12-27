#!/usr/bin/env node

// Simple test script to verify server startup
const axios = require('axios')

async function testServer() {
  try {
    console.log('Testing server endpoints...')

    // Test health endpoint
    const health = await axios.get('http://localhost:3000/health')
    console.log('✅ Health check:', health.data)

    // Test API health
    const apiHealth = await axios.get('http://localhost:3000/api/v1/health')
    console.log('✅ API Health check:', apiHealth.data)

    console.log('🎉 Server is running correctly!')
  } catch (error) {
    console.error('❌ Server test failed:', error.message)
    process.exit(1)
  }
}

setTimeout(testServer, 3000) // Give server time to start

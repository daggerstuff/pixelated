#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

console.log('🔍 Container Diagnostics')
console.log('========================')
console.log(`Working directory: ${process.cwd()}`)
console.log(`Project root: ${projectRoot}`)
console.log(`Node version: ${process.version}`)
console.log(`Environment: ${process.env.NODE_ENV}`)
console.log(`PORT: ${process.env.PORT}`)
console.log(`WEBSITES_PORT: ${process.env.WEBSITES_PORT}`)

// Check if dist directory exists
const distPath = path.join(projectRoot, 'dist')
console.log(`\n📁 Checking dist directory: ${distPath}`)
if (fs.existsSync(distPath)) {
  console.log('✅ dist directory exists')
  const distContents = fs.readdirSync(distPath)
  console.log('Contents:', distContents)
  
  // Check server directory
  const serverPath = path.join(distPath, 'server')
  if (fs.existsSync(serverPath)) {
    console.log('✅ server directory exists')
    const serverContents = fs.readdirSync(serverPath)
    console.log('Server contents:', serverContents)
    
    // Check entry.mjs
    const entryPath = path.join(serverPath, 'entry.mjs')
    if (fs.existsSync(entryPath)) {
      console.log('✅ entry.mjs exists')
    } else {
      console.log('❌ entry.mjs missing')
    }
  } else {
    console.log('❌ server directory missing')
  }
} else {
  console.log('❌ dist directory missing')
}

console.log('\n🔍 Diagnosis complete')
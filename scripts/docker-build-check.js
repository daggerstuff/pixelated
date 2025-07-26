#!/usr/bin/env node

/**
 * docker-build-check.js
 * 
 * Pre-build validation script for Docker builds
 * Ensures all necessary files and configurations are in place
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

function checkEnvironmentFiles() {
  console.log('🔍 Checking environment files...')
  
  const envFiles = ['.env.production', '.env', '.env.example']
  let foundEnvFile = false
  
  for (const envFile of envFiles) {
    const envPath = path.join(projectRoot, envFile)
    if (fs.existsSync(envPath)) {
      console.log(`✅ Found ${envFile}`)
      foundEnvFile = true
      break
    }
  }
  
  if (!foundEnvFile) {
    console.log('⚠️ No environment file found, creating minimal .env.production')
    const minimalEnv = `NODE_ENV=production
ASTRO_TELEMETRY_DISABLED=1
SKIP_REDIS_TESTS=true
SKIP_FHE_TESTS=true
SKIP_BROWSER_COMPAT_TESTS=true`
    
    fs.writeFileSync(path.join(projectRoot, '.env.production'), minimalEnv)
    console.log('✅ Created minimal .env.production')
  }
}

function checkSourceStructure() {
  console.log('🔍 Checking source structure...')
  
  const requiredDirs = ['src', 'src/pages']
  const requiredFiles = ['package.json', 'astro.config.mjs']
  
  for (const dir of requiredDirs) {
    const dirPath = path.join(projectRoot, dir)
    if (!fs.existsSync(dirPath)) {
      console.error(`❌ Required directory missing: ${dir}`)
      process.exit(1)
    }
    console.log(`✅ Found directory: ${dir}`)
  }
  
  for (const file of requiredFiles) {
    const filePath = path.join(projectRoot, file)
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Required file missing: ${file}`)
      process.exit(1)
    }
    console.log(`✅ Found file: ${file}`)
  }
}

function checkDependencies() {
  console.log('🔍 Checking package.json configuration...')
  
  const packageJsonPath = path.join(projectRoot, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  
  if (!packageJson.scripts?.build) {
    console.error('❌ No build script found in package.json')
    process.exit(1)
  }
  
  console.log('✅ Build script found')
  console.log(`📋 Build command: ${packageJson.scripts.build}`)
}

function main() {
  console.log('🚀 Running Docker build pre-check...\n')
  
  try {
    checkEnvironmentFiles()
    checkSourceStructure()
    checkDependencies()
    
    console.log('\n✅ All pre-build checks passed!')
    console.log('🐳 Docker build should proceed successfully')
    
  } catch (error) {
    console.error('\n❌ Pre-build check failed:', error.message)
    process.exit(1)
  }
}

main()

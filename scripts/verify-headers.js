#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Required headers for HIPAA compliance
const requiredHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': '',
  'Content-Security-Policy': '',
}

// Read the Astro config file
const configPath = path.join(process.cwd(), 'astro.config.mjs')
console.log(`Reading Astro config from: ${configPath}`)

try {
  const configContent = fs.readFileSync(configPath, 'utf8')

  // Check if headers section exists
  if (!configContent.includes('headers: [')) {
    console.error('❌ No headers section found in astro.config.mjs')
    process.exit(1)
  }

  console.log('✅ Found headers section in astro.config.mjs')

  // Check for each required header
  const missingHeaders = []
  const foundHeaders = new Set()

  // Extract headers section using regex
  const headersRegex = /headers:\s*\[\s*\{[^]*?\}\s*\]/g
  const headersMatch = configContent.match(headersRegex)

  if (headersMatch) {
    const headersSection = headersMatch[0]

    // Check for each required header
    for (const header of Object.keys(requiredHeaders)) {
      const keyRegex = new RegExp(`key:\\s*['"]${header}['"]`, 'i')
      if (keyRegex.test(headersSection)) {
        foundHeaders.add(header)
        console.log(`✅ Found header: ${header}`)
      } else {
        missingHeaders.push(header)
        console.log(`❌ Missing header: ${header}`)
      }
    }
  }

  // Report findings
  console.log('\nSecurity Headers Summary:')
  console.log(
    `Found: ${foundHeaders.size} of ${Object.keys(requiredHeaders).length} required headers`,
  )

  if (missingHeaders.length > 0) {
    console.log('\nMissing headers:')
    missingHeaders.forEach((header) => console.log(`- ${header}`))
    console.log('\nPlease add these headers to your astro.config.mjs file')
  } else {
    console.log('\n✅ All required security headers are configured!')
  }
} catch (error) {
  console.error(`Error reading config file: ${error.message}`)
  process.exit(1)
}

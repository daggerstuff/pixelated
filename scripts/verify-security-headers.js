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
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': ["default-src 'self'"],
}

// Read the Astro config file
const configPath = path.join(process.cwd(), 'astro.config.mjs')
console.log(`Reading Astro config from: ${configPath}`)

try {
  const configContent = fs.readFileSync(configPath, 'utf8')

  // Check if headers section exists
  if (!configContent.includes('headers:')) {
    console.error('❌ No headers section found in astro.config.mjs')
    process.exit(1)
  }

  console.log('✅ Found headers section in astro.config.mjs')

  // Check for each required header
  const missingHeaders = []
  const foundHeaders = new Set()

  // Check for each required header
  for (const header of Object.keys(requiredHeaders)) {
    const keyRegex = new RegExp(`key:\\s*['"]${header}['"]`, 'i')
    if (keyRegex.test(configContent)) {
      foundHeaders.add(header)
      console.log(`✅ Found header: ${header}`)
    } else {
      missingHeaders.push(header)
      console.log(`❌ Missing header: ${header}`)
    }
  }

  // Report findings
  console.log('\nSecurity Headers Summary:')
  console.log(
    `Found: ${foundHeaders.size} of ${Object.keys(requiredHeaders).length} required headers`,
  )

  // Generate a markdown report with findings
  let report = `# Security Headers Analysis\n\n`
  report += `## Found Headers (${foundHeaders.size}/${Object.keys(requiredHeaders).length})\n`

  for (const header of foundHeaders) {
    report += `- [x] ${header}\n`
  }

  if (missingHeaders.length > 0) {
    report += `\n## Missing Headers\n`
    for (const header of missingHeaders) {
      report += `- [ ] ${header}\n`
    }
    report += `\nPlease add these headers to your astro.config.mjs file.\n`

    // Write report
    fs.writeFileSync('docs/security/headers-analysis.md', report)

    console.log('\nMissing headers:')
    missingHeaders.forEach((header) => console.log(`- ${header}`))
    console.log('\nPlease add these headers to your astro.config.mjs file')
    process.exit(1)
  } else {
    report += `\n## All Required Headers Found\n`
    report += `All security headers required for HIPAA compliance are properly configured.\n`

    // Write report
    fs.writeFileSync('docs/security/headers-analysis.md', report)

    console.log('\n✅ All required security headers are configured!')
    process.exit(0)
  }
} catch (error) {
  console.error(`Error reading config file: ${error.message}`)
  process.exit(1)
}

#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Required headers for HIPAA compliance
const requiredHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Content-Security-Policy': true, // We'll validate that CSP is properly configured
}

// Read the security headers middleware file
const middlewarePath = path.join(process.cwd(), 'src/lib/middleware/securityHeaders.ts')
console.log(`Reading security headers middleware from: ${middlewarePath}`)

try {
    const middlewareContent = fs.readFileSync(middlewarePath, 'utf8')

  console.log('✅ Reading security headers middleware...')

  // Check for each required header implementation
  const missingHeaders = []
  const foundHeaders = new Set()

  // Check for each required header
  for (const [header, expectedValue] of Object.entries(requiredHeaders)) {
    if (header === 'Content-Security-Policy') {
      // Special check for CSP implementation
      if (middlewareContent.includes('Content-Security-Policy') &&
          middlewareContent.includes('response.headers.set(\'Content-Security-Policy\'')) {
        foundHeaders.add(header)
        console.log(`✅ Found header implementation: ${header}`)

        // Additional CSP validation
        if (middlewareContent.includes('nonce-')) {
          console.log(`✅ CSP uses nonce-based script-src for security`)
        }
        if (middlewareContent.includes('unsafe-inline') && middlewareContent.includes('if (import.meta.env.PROD)')) {
          console.log(`✅ CSP removes unsafe-inline in production environment`)
        }
      } else {
        missingHeaders.push(header)
        console.log(`❌ Missing header implementation: ${header}`)
      }
    } else if (header === 'Strict-Transport-Security') {
      // Check for HSTS implementation with PROD guard
      const hstsPattern = /if \(import\.meta\.env\.PROD\) \{[\s\S]*?Strict-Transport-Security[\s\S]*?\}/
      if (middlewareContent.includes('Strict-Transport-Security') &&
          hstsPattern.test(middlewareContent)) {
        foundHeaders.add(header)
        console.log(`✅ Found header implementation with PROD guard: ${header}`)
      } else {
        missingHeaders.push(header)
        console.log(`❌ Missing PROD-guarded header implementation: ${header}`)
      }
    } else {
      // Check for other header implementations (handles multiline values)
      const escapedValue = expectedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const headerPattern = new RegExp(`response\\.headers\\.set\\([^)]*${header}[^)]*['"]${escapedValue}['"]`, 'i')
      if (headerPattern.test(middlewareContent)) {
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
    report += `\nPlease add these headers to your src/lib/middleware/securityHeaders.ts file.\n`

    // Write report
    fs.writeFileSync('docs/security/headers-analysis.md', report)

    console.log('\nMissing headers:')
    missingHeaders.forEach((header) => console.log(`- ${header}`))
    console.log('\nPlease add these headers to your src/lib/middleware/securityHeaders.ts file')
    process.exit(1)
  } else {
    report += `\n## All Required Headers Found\n`
    report += `All security headers required for HIPAA compliance are properly configured in the middleware.\n`

    // Write report
    fs.writeFileSync('docs/security/headers-analysis.md', report)

    console.log('\n✅ All required security headers are configured!')
    process.exit(0)
  }
} catch (error) {
  console.error(`Error reading middleware file: ${error.message}`)
  process.exit(1)
}

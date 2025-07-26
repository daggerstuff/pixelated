#!/usr/bin/env node

/**
 * Check for large dependencies that shouldn't be in production builds
 */

import fs from 'fs'
import path from 'path'

// Known large dependencies that cause build size issues
const PROBLEMATIC_DEPS = {
  // Icon libraries (very large)
  '@iconify/json': {
    size: '~383MB',
    reason: 'Complete icon library - should use selective imports',
  },
  '@iconify-json/carbon': {
    size: '~5MB',
    reason: 'Large icon set - consider minimal subset',
  },

  // Next.js related (not needed for Astro)
  '@next/swc-linux-x64-gnu': {
    size: '~142MB',
    reason: 'Next.js compiler - not needed for Astro builds',
  },
  '@next/swc-linux-x64-musl': {
    size: '~142MB',
    reason: 'Next.js compiler - not needed for Astro builds',
  },
  'next': {
    size: '~121MB',
    reason: 'Next.js framework - conflicts with Astro',
  },

  // Heavy ML/Graphics libraries
  '@tensorflow/tfjs': {
    size: '~141MB',
    reason: 'Large ML library - consider Lambda layers',
  },
  'three': {
    size: '~50MB',
    reason: '3D graphics library - externalize for Lambda',
  },

  // Development tools that shouldn't be in production
  'playwright': {
    size: '~100MB',
    reason: 'E2E testing tool - should be devDependency only',
  },
  'workerd': {
    size: '~99MB',
    reason: 'Cloudflare Worker runtime - not needed in Lambda',
  },

  // Old/deprecated SDKs
  'aws-sdk': {
    size: '~94MB',
    reason:
      'AWS SDK v2 - should use v3 (@aws-sdk/client-*) for smaller bundles',
  },

  // Diagram libraries
  'mermaid': {
    size: '~61MB',
    reason: 'Diagram library - consider server-side rendering or CDN',
  },
}

function checkPackageJson() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
    const { dependencies = {}, devDependencies = {} } = packageJson

    console.log('🔍 Checking for problematic large dependencies...\n')

    let foundIssues = false

    // Check dependencies
    console.log('📦 Production Dependencies:')
    for (const [dep, info] of Object.entries(PROBLEMATIC_DEPS)) {
      if (dependencies[dep]) {
        console.log(`   ❌ ${dep} (${info.size}) - ${info.reason}`)
        foundIssues = true
      }
    }

    // Check devDependencies for issues that might leak into production
    console.log('\n🛠️  Dev Dependencies (checking for production leaks):')
    const productionLeakRisks = [
      '@iconify/json',
      '@tensorflow/tfjs',
      'three',
      'playwright',
    ]
    for (const dep of productionLeakRisks) {
      if (devDependencies[dep]) {
        console.log(
          `   ⚠️  ${dep} in devDependencies - ensure it doesn't leak to production`,
        )
      }
    }

    if (!foundIssues) {
      console.log('   ✅ No problematic large dependencies found in production')
    }

    // Recommendations
    console.log('\n💡 Recommendations:')
    console.log(
      '   1. Move @iconify/json to devDependencies and use selective imports',
    )
    console.log(
      '   2. Replace aws-sdk with specific @aws-sdk/client-* packages',
    )
    console.log('   3. Move heavy ML/graphics libraries to Lambda layers')
    console.log('   4. Ensure testing tools are devDependencies only')
    console.log('   5. Use external CDN for client-side heavy libraries')

    // Bundle size estimate
    const totalProblematicSize = Object.entries(PROBLEMATIC_DEPS)
      .filter(([dep]) => dependencies[dep])
      .reduce((total, [_, info]) => {
        const sizeMatch = info.size.match(/(\d+)MB/)
        return total + (sizeMatch ? parseInt(sizeMatch[1]) : 0)
      }, 0)

    if (totalProblematicSize > 0) {
      console.log(
        `\n📊 Estimated problematic dependency size: ~${totalProblematicSize}MB`,
      )
      console.log(`   AWS Amplify limit: 230MB`)
      if (totalProblematicSize > 230) {
        console.log('   🚨 CRITICAL: Exceeds AWS Amplify build size limit!')
      }
    }

    return foundIssues ? 1 : 0
  } catch (error) {
    console.error('❌ Error reading package.json:', error.message)
    return 1
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(checkPackageJson())
}

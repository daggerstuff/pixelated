import { execSync } from 'node:child_process'

// Packages that need updating based on outdated check
const packagesToUpdate = [
  // Dependencies
  '@types/react',
  'chart.js',
  'd3',
  'typescript',
  '@types/node',
  'unocss',

  // DevDependencies
  'prettier',
  '@unocss/astro',
  '@unocss/preset-attributify',
  '@unocss/preset-icons',
  '@unocss/preset-uno',
  '@unocss/reset',
  '@unocss/transformer-directives',
  '@unocss/transformer-variant-group',
]

// Security-critical packages that should always be kept updated
const securityCriticalPackages = [
  '@supabase/supabase-js',
  'axios',
  'crypto-js',
  'jsonwebtoken',
  'zod',
  'circomlib',
  'snarkjs',
]

// Combine all packages to update
const allPackagesToUpdate = [
  ...new Set([...packagesToUpdate, ...securityCriticalPackages]),
]

console.log('Updating the following packages:')
console.log(allPackagesToUpdate.join('\n'))

// Update each package individually with exact version
try {
  for (const pkg of allPackagesToUpdate) {
    console.log(`Updating ${pkg}...`)
    execSync(`pnpm update ${pkg} --latest`, { stdio: 'inherit' })
  }
  console.log('\nAll packages updated successfully!')
} catch (error) {
  console.error('Error updating packages:', error)
}

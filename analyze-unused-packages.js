#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

// Read package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))
const allDeps = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies
}

// File extensions to analyze
const extensions = ['.ts', '.tsx', '.js', '.jsx', '.astro', '.mjs', '.cjs', '.vue']

// Packages that might be used indirectly
const indirectPackages = new Set([
  // Build tools and bundlers that might be used indirectly
  'vite', 'astro', 'rollup', 'esbuild', 'terser',
  // Type definitions
  '@types/node', '@types/react', '@types/react-dom',
  // ESLint and Prettier (might be used via scripts)
  'eslint', 'prettier', 'typescript',
  // Testing frameworks
  '@playwright/test', 'vitest', '@vitest/ui', '@vitest/coverage-v8',
  // PostCSS and CSS processing
  'postcss', 'autoprefixer', 'tailwindcss',
  // CLI tools
  'tsx', 'ts-node', 'concurrently', 'wait-on',
  // Polyfills and runtime dependencies
  'promise-polyfill', 'whatwg-fetch', 'web-animations-js', 'resize-observer-polyfill',
  // Node.js process utilities
  'cross-env',
  // Sharp for image processing (might be used by Astro)
  'sharp'
])

// Packages used in configuration files
const configPackages = new Set([
  // Astro integrations and plugins
  '@astrojs/check', '@astrojs/language-server', '@astrojs/ts-plugin',
  // UnoCSS
  '@unocss/astro', '@unocss/core', '@unocss/preset-uno', '@unocss/preset-icons',
  '@unocss/preset-attributify', '@unocss/preset-web-fonts', '@unocss/preset-wind3',
  '@unocss/transformer-directives', '@unocss/transformer-variant-group', '@unocss/vite',
  'unocss',
  // ESLint plugins
  '@eslint/js', '@eslint/json', '@eslint/markdown', '@eslint/css',
  'eslint-plugin-react', 'eslint-plugin-react-hooks', 'eslint-plugin-astro',
  'eslint-plugin-prettier', 'eslint-plugin-vitest', 'eslint-plugin-vitest-globals',
  '@zemd/eslint-astro',
  // TypeScript ESLint
  '@typescript-eslint/eslint-plugin', '@typescript-eslint/parser', 'typescript-eslint',
  // Prettier plugins
  'prettier-plugin-astro',
  // Other config-related
  'globals', 'tsconfig', 'tsconfig-paths'
])

// Packages used in package.json scripts
const scriptPackages = new Set()
for (const script of Object.values(packageJson.scripts || {})) {
  // Extract package names from scripts
  const matches = script.match(/(?:^|\s)([\w@][\w\-@\/]*)/g)
  if (matches) {
    matches.forEach(match => {
      const pkg = match.trim()
      if (pkg.startsWith('@') || pkg.match(/^[a-z]/)) {
        scriptPackages.add(pkg)
      }
    })
  }
}

console.log('Packages used in scripts:', Array.from(scriptPackages).sort())

// Find all files to analyze
function findFiles(dir, files = []) {
  const entries = readdirSync(dir)
  
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    
    if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
      findFiles(fullPath, files)
    } else if (stat.isFile() && extensions.includes(extname(entry))) {
      files.push(fullPath)
    }
  }
  
  return files
}

// Extract imports from file content
function extractImports(content) {
  const imports = new Set()
  
  // Match various import patterns
  const patterns = [
    // ES6 imports: import ... from 'package'
    /import\s+(?:[^'"]*\s+from\s+)?['"]([^'"]+)['"]/g,
    // Dynamic imports: import('package')
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // require: require('package')
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ]
  
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      const importPath = match[1]
      
      // Skip relative imports
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        continue
      }
      
      // Extract package name (handle scoped packages)
      let packageName = importPath
      if (importPath.startsWith('@')) {
        // Scoped package: @scope/package or @scope/package/subpath
        const parts = importPath.split('/')
        packageName = parts.slice(0, 2).join('/')
      } else {
        // Regular package: package or package/subpath
        packageName = importPath.split('/')[0]
      }
      
      imports.add(packageName)
    }
  }
  
  return imports
}

// Analyze all files
console.log('Analyzing files for package usage...')
const allFiles = findFiles('./src')
const usedPackages = new Set()

// Add indirectly used packages
indirectPackages.forEach(pkg => usedPackages.add(pkg))
configPackages.forEach(pkg => usedPackages.add(pkg))
scriptPackages.forEach(pkg => usedPackages.add(pkg))

// Analyze each file
for (const file of allFiles) {
  try {
    const content = readFileSync(file, 'utf-8')
    const imports = extractImports(content)
    imports.forEach(pkg => usedPackages.add(pkg))
  } catch (error) {
    console.warn(`Warning: Could not read ${file}:`, error.message)
  }
}

// Also check config files
const configFiles = [
  './astro.config.mjs',
  './vite.config.js', 
  './eslint.config.js',
  './tailwind.config.ts',
  './uno.config.ts',
  './playwright.config.ts',
  './vitest.config.ts'
]

for (const file of configFiles) {
  try {
    const content = readFileSync(file, 'utf-8')
    const imports = extractImports(content)
    imports.forEach(pkg => usedPackages.add(pkg))
  } catch (error) {
    // File might not exist, that's okay
  }
}

// Check for unused packages
const unusedDeps = []
const unusedDevDeps = []

for (const [pkg, version] of Object.entries(packageJson.dependencies || {})) {
  if (!usedPackages.has(pkg)) {
    unusedDeps.push(pkg)
  }
}

for (const [pkg, version] of Object.entries(packageJson.devDependencies || {})) {
  if (!usedPackages.has(pkg)) {
    unusedDevDeps.push(pkg)
  }
}

console.log('\n=== ANALYSIS RESULTS ===\n')

console.log(`Total packages in dependencies: ${Object.keys(packageJson.dependencies || {}).length}`)
console.log(`Total packages in devDependencies: ${Object.keys(packageJson.devDependencies || {}).length}`)
console.log(`Total packages used: ${usedPackages.size}`)

if (unusedDeps.length > 0) {
  console.log(`\n🔍 POTENTIALLY UNUSED DEPENDENCIES (${unusedDeps.length}):`)
  unusedDeps.sort().forEach(pkg => console.log(`  - ${pkg}`))
}

if (unusedDevDeps.length > 0) {
  console.log(`\n🔍 POTENTIALLY UNUSED DEV DEPENDENCIES (${unusedDevDeps.length}):`)
  unusedDevDeps.sort().forEach(pkg => console.log(`  - ${pkg}`))
}

// Look for redundant packages
console.log('\n🔍 CHECKING FOR REDUNDANT PACKAGES:')

const redundantChecks = [
  // Multiple CSS frameworks
  { packages: ['tailwindcss', '@tailwindcss/vite', 'unocss'], note: 'Multiple CSS frameworks detected' },
  // Multiple testing libraries for same purpose
  { packages: ['@testing-library/react', '@testing-library/dom'], note: 'Multiple testing library packages' },
  // Multiple date libraries
  { packages: ['date-fns', 'dayjs'], note: 'Multiple date manipulation libraries' },
  // Multiple chart libraries
  { packages: ['chart.js', 'recharts'], note: 'Multiple charting libraries' },
  // Multiple database clients for same database
  { packages: ['redis', 'ioredis'], note: 'Multiple Redis clients' },
  { packages: ['pg', 'postgres'], note: 'Multiple PostgreSQL clients' },
  // Multiple React router libraries
  { packages: ['react-router-dom'], note: 'React router in Astro project (might be redundant)' }
]

redundantChecks.forEach(({ packages, note }) => {
  const found = packages.filter(pkg => allDeps[pkg])
  if (found.length > 1) {
    console.log(`  ⚠️  ${note}: ${found.join(', ')}`)
  }
})

console.log('\n=== END ANALYSIS ===')

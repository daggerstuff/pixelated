#!/usr/bin/env node

/**
 * Consolidated fix script
 * Combines functionality from multiple fix scripts into a single utility
 * - Fixes ReactNode imports
 * - Fixes unused imports
 * - Fixes Astro frontmatter
 * - Fixes JSX tags and typos
 * - Fixes Vitest mocks
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

// Helper to run commands
function runCommand(command, label) {
  console.log(`\n🔄 ${label}...`)
  try {
    execSync(command, { stdio: 'inherit', cwd: projectRoot })
    return true
  } catch (error) {
    console.error(`❌ ${label} failed: ${error.message}`)
    return false
  }
}

// Helper to get files recursively
function getFilesRecursively(dir, fileExtensions) {
  let files = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files = files.concat(getFilesRecursively(fullPath, fileExtensions))
    } else if (
      entry.isFile() &&
      fileExtensions.some((ext) => entry.name.endsWith(ext))
    ) {
      files.push(fullPath)
    }
  }

  return files
}

// --- ReactNode Imports Fix ---
function fixReactNodeImports() {
  console.log('🔍 Fixing ReactNode imports...')

  const componentDirs = [
    path.join(projectRoot, 'src', 'components'),
    path.join(projectRoot, 'src', 'lib'),
    path.join(projectRoot, 'src', 'context'),
    path.join(projectRoot, 'src', 'hooks'),
  ]

  let fixedFiles = 0

  for (const dir of componentDirs) {
    if (fs.existsSync(dir)) {
      const files = getFilesRecursively(dir, ['.tsx', '.ts'])

      for (const file of files) {
        if (fixReactNodeImport(file)) {
          fixedFiles++
        }
      }
    }
  }

  console.log(`✅ Fixed ReactNode imports in ${fixedFiles} files`)
}

function fixReactNodeImport(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')

    // Skip files that already have correct imports
    if (
      content.includes('import type { ReactNode }') ||
      !content.includes('ReactNode')
    ) {
      return false
    }

    // Fix imports for ReactNode
    let newContent = content

    // Replace standard import with type import
    if (content.includes('import { ReactNode }')) {
      newContent = content.replace(
        /import\s+{\s*(?:(.*),\s*)?ReactNode(?:,\s*(.*))?\s*}\s+from\s+['"]react['"]/g,
        (match, before, after) => {
          const parts = []
          if (before) {
            parts.push(before)
          }
          if (after) {
            parts.push(after)
          }

          if (parts.length > 0) {
            return `import { ${parts.join(', ')} } from 'react';\nimport type { ReactNode } from 'react'`
          } else {
            return `import type { ReactNode } from 'react'`
          }
        },
      )
    }
    // Add type import if there's another import from react
    else if (content.includes('import ') && content.includes(" from 'react'")) {
      newContent = content.replace(
        /(import .* from ['"]react['"];?)/,
        "$1\nimport type { ReactNode } from 'react';",
      )
    }
    // Add entirely new import
    else {
      newContent = `import type { ReactNode } from 'react';\n${content}`
    }

    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent)
      return true
    }

    return false
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message)
    return false
  }
}

// --- Unused Imports Fix ---
function fixUnusedImports() {
  console.log('🔍 Fixing unused imports...')
  // Use a more compatible ESLint command that doesn't require specific config
  return runCommand(
    'npx eslint --fix "src/**/*.{ts,tsx}" --no-ignore',
    'Removing unused imports',
  )
}

// --- Fix Astro Frontmatter ---
function fixAstroFrontmatter() {
  console.log('🔍 Fixing Astro frontmatter...')
  const sourceDir = path.join(projectRoot, 'src')

  let fixedFiles = 0
  const astroFiles = getFilesRecursively(sourceDir, ['.astro'])

  for (const file of astroFiles) {
    if (checkAndFixAstroFile(file)) {
      fixedFiles++
    }
  }

  console.log(`✅ Fixed frontmatter in ${fixedFiles} Astro files`)
}

function checkAndFixAstroFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')

    // Check if file has proper frontmatter
    const hasFrontmatter =
      /^---\s*\n/.test(content) && /\n---\s*\n/.test(content)

    if (!hasFrontmatter) {
      // File needs frontmatter, add it
      const newContent = `---\n// Frontmatter section (add imports and scripts here)\n---\n\n${content}`
      fs.writeFileSync(filePath, newContent)
      return true
    }

    return false
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message)
    return false
  }
}

// --- Fix Vitest Mocks ---
function fixVitestMocks() {
  console.log('🔍 Fixing Vitest mocks...')

  // Fix: Use direct directory paths instead of globs which don't work with getFilesRecursively
  const testDirs = [
    path.join(projectRoot, 'src'),
    path.join(projectRoot, 'tests'),
  ]

  let fixedFiles = 0

  // Get all test files
  for (const dir of testDirs) {
    try {
      if (fs.existsSync(dir)) {
        const files = getFilesRecursively(dir, ['.test.ts', '.test.tsx'])

        for (const file of files) {
          if (fixVitestMockImports(file)) {
            fixedFiles++
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error processing directory ${dir}:`, error.message)
    }
  }

  console.log(`✅ Fixed Vitest mock imports in ${fixedFiles} files`)
}

function fixVitestMockImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')

    // Check for vitest imports that should be global
    const hasVitestImport =
      /import\s+.*\s+from\s+['"]vitest['"]/.test(content) ||
      /import\s+.*\s+from\s+['"]@vitest\/spy['"]/.test(content) ||
      /import\s+.*\s+from\s+['"]vitest\/spy['"]/.test(content)

    if (hasVitestImport) {
      // Remove vitest imports as they're globally available
      const newContent = content
        .replace(/import\s+.*\s+from\s+['"]vitest['"];?\n?/g, '')
        .replace(/import\s+.*\s+from\s+['"]@vitest\/spy['"];?\n?/g, '')
        .replace(/import\s+.*\s+from\s+['"]vitest\/spy['"];?\n?/g, '')

      // Replace Mock type with ReturnType<typeof vi.fn>
      const finalContent = newContent
        .replace(/Mock(\s*)<([^>]*)>/g, 'ReturnType<typeof vi.fn>$1<$2>')
        .replace(/:\s*Mock(\s*)</g, ': ReturnType<typeof vi.fn>$1<')

      if (finalContent !== content) {
        fs.writeFileSync(filePath, finalContent)
        return true
      }
    }

    return false
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message)
    return false
  }
}

// Main execution
console.log('🚀 Running consolidated fix script...')

// Run all fixes
fixReactNodeImports()
fixUnusedImports()
fixAstroFrontmatter()
fixVitestMocks()

// Additional fixes that use command line utilities
runCommand('tsx scripts/fix-jsx-tags.ts', 'Fixing JSX tags')

console.log('\n✅ All fixes completed!')

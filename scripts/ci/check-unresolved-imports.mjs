#!/usr/bin/env node
/**
 * Check that every relative import in source files resolves to an actual file.
 *
 * Catches the kind of bug where a file is removed but an import statement
 * is left pointing at the old path.
 *
 * Why this exists:
 *   A missing apiClient.ts import in frontend/src/services/analyticsV2Service.ts
 *   cascaded into 2136 type-aware lint warnings.  oxlint has no
 *   import/no-unresolved rule, so we fill the gap here.
 *
 * How it works:
 *   - Regex finds import-source strings after 'from' in import/export stmts.
 *   - Comments are stripped before scanning to avoid false positives.
 *   - Relative paths are resolved against the importing file's directory with
 *     extension fallbacks (.ts, .tsx, .js, /index.ts, etc.)
 */

import { accessSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { glob } from 'glob'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SCAN_GLOB = '{src,business-strategy-cms/src}/**/*.{ts,tsx,js,jsx}'

const SCAN_IGNORE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.astro/**',
  '**/*.test.{ts,tsx,js,jsx}',
  '**/*.spec.{ts,tsx,js,jsx}',
  '**/*.generated.*',
  '**/*.d.ts',
]

/** Regex that matches the import path after 'from'. Captures group 1 = the path. */
const IMPORT_PATH_RE = /\bfrom\s+["']([^"']+)["']/g

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

function pathExists(filePath) {
  try {
    accessSync(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Try to resolve a path to an existing file.
 *
 * Tries (in order):
 *   1. exact match
 *   2. replace .js/.jsx extension with .ts/.tsx
 *   3. append .ts, .tsx, .js, .jsx, .mjs, .cjs, .mts, .cts
 *   4. /index.<ext> for each extension
 *
 * Step 2 handles the common TypeScript convention where imports use .js
 * extensions (for ESM compatibility) but the source files are .ts/.tsx.
 */
function tryResolve(resolvedPath) {
  // 1. Exact match
  if (pathExists(resolvedPath)) return resolvedPath

  // 2. If the path has a .js/.jsx extension, try replacing it with .ts/.tsx
  //    (TypeScript ESM convention: import './foo.js' -> ./foo.ts)
  if (resolvedPath.endsWith('.js')) {
    const withoutExt = resolvedPath.slice(0, -3)
    if (pathExists(withoutExt + '.ts')) return withoutExt + '.ts'
    if (pathExists(withoutExt + '.tsx')) return withoutExt + '.tsx'
    // Also try .mjs -> .mts
    if (resolvedPath.endsWith('.mjs')) {
      if (pathExists(withoutExt + '.mts')) return withoutExt + '.mts'
    }
  }
  if (resolvedPath.endsWith('.jsx')) {
    const withoutExt = resolvedPath.slice(0, -4)
    if (pathExists(withoutExt + '.tsx')) return withoutExt + '.tsx'
  }

  // 3. Try appending extensions
  const exts = ['.ts', '.tsx', '.d.ts', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']
  for (const ext of exts) {
    if (pathExists(resolvedPath + ext)) return resolvedPath + ext
  }

  // 4. Index files
  for (const ext of exts) {
    if (pathExists(resolvedPath + '/index' + ext)) return resolvedPath + '/index' + ext
  }

  return null
}

function isRelativePath(importSource) {
  return importSource.startsWith('./') || importSource.startsWith('../')
}

// ---------------------------------------------------------------------------
// Comment stripping
// ---------------------------------------------------------------------------

/**
 * Strip comments from source, replacing them with equal-length whitespace
 * so line/column offsets for error reporting are preserved.
 */
function stripComments(source) {
  // Multi-line comments: replace /* ... */ with spaces
  let result = source.replace(/\/\*[\s\S]*?\*\//g, (match) => ' '.repeat(match.length))
  // Single-line comments: replace // ... with spaces
  result = result.replace(/\/\/[^\n]*/g, (match) => ' '.repeat(match.length))
  return result
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cliFiles = process.argv.slice(2).filter(Boolean)
  const files =
    cliFiles.length > 0
      ? cliFiles.filter((f) => /\.(ts|tsx|js|jsx)$/.test(f))
      : await glob(SCAN_GLOB, { ignore: SCAN_IGNORE })

  if (files.length === 0) {
    console.log('No files matched the scan glob - nothing to check.')
    return
  }

  const violations = []

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const cleanSource = stripComments(source)
    const fileDir = dirname(resolve(file))

    IMPORT_PATH_RE.lastIndex = 0

    let match
    while ((match = IMPORT_PATH_RE.exec(cleanSource)) !== null) {
      const importPath = match[1]
      if (!isRelativePath(importPath)) continue

      const resolvedPath = resolve(fileDir, importPath)
      const found = tryResolve(resolvedPath)

      if (!found) {
        // Calculate line/column from the match position.
        // Offsets are preserved because stripComments pads with spaces.
        const offset = match.index
        let line = 1
        let lastNewline = -1
        for (let i = 0; i < offset && i < source.length; i++) {
          if (source.charCodeAt(i) === 10) {
            line++
            lastNewline = i
          }
        }
        const column = offset - lastNewline

        violations.push({ file, line, column, importPath })
      }
    }
  }

  if (violations.length === 0) {
    const fileCount = files.length
    const label = fileCount === 1 ? 'file' : 'files'
    console.log('Scanned ' + fileCount + ' ' + label + ' - all relative imports resolve.')
    return
  }

  for (const v of violations) {
    console.error(
      v.file + ':' + v.line + ':' + v.column + '  error  Import does not resolve: "' + v.importPath + '"',
    )
  }
  const label = violations.length === 1 ? 'import' : 'imports'
  console.error(
    '\nFound ' + violations.length + ' unresolved ' + label + '. ' +
    'Fix the import path or create the missing file.',
  )
  process.exit(1)
}

main().catch((err) => {
  console.error('check-unresolved-imports: internal error')
  console.error(err)
  process.exit(2)
})

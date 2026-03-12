#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const projectRoot = process.cwd()
const srcRoot = path.join(projectRoot, 'src')
const nodeModulesRoot = path.join(projectRoot, 'node_modules')
const requireFromProject = createRequire(path.join(projectRoot, 'package.json'))

const TS_IMPORT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.astro'])
const STYLE_EXTENSIONS = new Set(['.css', '.pcss', '.scss', '.sass'])
const IMPORT_REGEXP =
  /(?:import|export)\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g
const STYLE_IMPORT_REGEXP = /@import\s+(?:url\()?\s*['"]([^'"]+)['"]\)?\s*;?/g

const unresolved = new Set()

function pushIssue(issue) {
  unresolved.add(issue)
}

function isExternalUrl(value) {
  return /^([a-z]+:)?\/\//.test(value) || value.startsWith('data:')
}

function isLocalOrAlias(value) {
  return value.startsWith('@/') || value.startsWith('./') || value.startsWith('../')
}

function fileExists(filePath) {
  return fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()
}

function normalizeAlias(filePath) {
  return filePath.replace(/^@\/?/, `${srcRoot}/`).replace(/\/+/g, '/')
}

function tryResolveLocal(specifier, fromDir) {
  const absolute = specifier.startsWith('@/')
    ? normalizeAlias(specifier)
    : path.resolve(fromDir, specifier)

  if (fileExists(absolute)) return true

  const extensionCandidates = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.astro', '.css']
  if (extensionCandidates.some((ext) => fileExists(`${absolute}${ext}`))) {
    return true
  }

  if (fs.existsSync(absolute) && fs.statSync(absolute).isDirectory()) {
    const indexCandidates = ['index.ts', 'index.tsx', 'index.js', 'index.mjs', 'index.css']
    return indexCandidates.some((index) => fileExists(path.join(absolute, index)))
  }

  return false
}

function tryResolveNodeModule(specifier) {
  if (specifier.startsWith('node:')) return true

  try {
    const resolved = requireFromProject.resolve(specifier)
    if (resolved) return true
  } catch {
    // Fallback to direct file lookup for package assets.
  }

  const segments = specifier.split('/')
  if (!segments.length) return false

  const packageName = specifier.startsWith('@')
    ? `${segments[0]}/${segments[1]}`
    : segments[0]
  const packageBase = path.join(nodeModulesRoot, packageName)
  if (!fs.existsSync(packageBase)) return false

  const subpath = segments.slice(specifier.startsWith('@') ? 2 : 1).join('/')
  if (!subpath) return false

  const directPath = path.join(packageBase, subpath)
  if (fileExists(directPath)) return true

  if (fs.existsSync(directPath) && fs.statSync(directPath).isDirectory()) {
    const indexCandidates = ['index.js', 'index.mjs', 'index.cjs', 'index.css']
    if (
      indexCandidates.some((index) =>
        fileExists(path.join(directPath, index)),
      )
    ) {
      return true
    }
  }

  if (subpath && !path.extname(subpath)) {
    const candidateWithCss = `${directPath}.css`
    if (fileExists(candidateWithCss)) return true
  }

  return false
}

function checkImport(specifier, fromDir, sourcePath) {
  if (isExternalUrl(specifier)) return

  if (isLocalOrAlias(specifier)) {
    if (tryResolveLocal(specifier, fromDir)) return
    pushIssue(`${sourcePath} -> ${specifier} (local file import cannot be resolved)`)
    return
  }

  if (specifier.startsWith('.')) {
    // Relative imports are validated by TypeScript/Astro checks.
    return
  }

  if (!tryResolveNodeModule(specifier)) {
    pushIssue(`${sourcePath} -> ${specifier} (package or style import cannot be resolved)`)
  }
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const fromDir = path.dirname(filePath)

  if (filePath.endsWith('.css')) {
    for (const match of content.matchAll(STYLE_IMPORT_REGEXP)) {
      const [, specifier] = match
      if (specifier) checkImport(specifier, fromDir, filePath)
    }
  }

  if (TS_IMPORT_EXTENSIONS.has(path.extname(filePath))) {
    for (const match of content.matchAll(IMPORT_REGEXP)) {
      const specifier = match[1] || match[2] || match[3]
      if (specifier) checkImport(specifier, fromDir, filePath)
    }
  }
}

function collectFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      collectFiles(fullPath, results)
      continue
    }

    const ext = path.extname(entry.name)
    if (
      ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.astro', '.css'].includes(ext)
    ) {
      results.push(fullPath)
    }
  }
  return results
}

const scanned = collectFiles(path.join(projectRoot, 'src'))
for (const filePath of scanned) {
  scanFile(filePath)
}

if (unresolved.size > 0) {
  console.error('❌ Build contract validation failed: unresolved imports/styles found.')
  for (const issue of unresolved) {
    console.error(`  - ${issue}`)
  }
  process.exit(1)
}

console.log('✅ Build contract validation passed: imports resolved.')

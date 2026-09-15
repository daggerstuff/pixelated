#!/usr/bin/env node
/**
 * Mock-path resolution audit.
 *
 * vi.mock('<specifier>') with a specifier that does not resolve to a real
 * module is silently ignored: the mock never applies, and the test exercises
 * the real dependency instead. This suite of bugs cost 16 failing tests in
 * patient-rights (see commit 1ac719f16) before anyone noticed.
 *
 * This audit fails loudly instead: every vi.mock / vi.doMock / vi.unmock /
 * vi.doUnmock call with a static string specifier in the test corpus must
 * resolve to an existing file (with Vite-style extension and index
 * resolution, and the '@/ -> apps/web/src/' alias). Bare package specifiers
 * (uuid, ioredis, ...) are skipped — the registry owns those.
 *
 * Usage:
 *   node scripts/ci/mock-paths-audit.mjs
 *
 * Exit codes: 0 = every mock resolves, 1 = at least one does not.
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { globSync } from 'glob'

const ROOT = resolve(import.meta.dirname, '../..')

/** Mirrors config/vitest.config.ts: '@/ -> apps/web/src/'. */
const ALIASES = [{ find: '@/', replacement: join(ROOT, 'apps/web/src') + '/' }]

/** Vite-style extension resolution order for extensionless specifiers. */
const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.astro']
const INDEX_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']

const MOCK_CALL_RE =
  /\bvi\s*\.\s*(?:do)?(?:un)?mock\s*\(\s*(['"])([^'"]+)\1/g

function resolvesTo(existingPath) {
  const candidates = [existingPath]
  // TypeScript style: a '.js' specifier can reference a '.ts'/'.tsx' source.
  if (existingPath.endsWith('.js')) {
    candidates.push(existingPath.replace(/\.js$/, '.ts'), existingPath.replace(/\.js$/, '.tsx'))
  }
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return true
    for (const ext of EXTENSIONS) {
      if (ext === '' ) continue
      if (existsSync(candidate + ext) && statSync(candidate + ext).isFile()) return true
    }
  }
  for (const ext of INDEX_EXTENSIONS) {
    const index = join(existingPath, `index${ext}`)
    if (existsSync(index) && statSync(index).isFile()) return true
  }
  return false
}

function main() {
  const testFiles = globSync('apps/web/src/**/*.{test,spec}.{ts,tsx,js,jsx,mjs}', {
    cwd: ROOT,
  })
  /** @type {Array<{file: string, specifier: string}>} */
  const unresolved = []
  let checked = 0

  for (const file of testFiles) {
    const source = readFileSync(join(ROOT, file), 'utf8')
    for (const match of source.matchAll(MOCK_CALL_RE)) {
      const specifier = match[2]
      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        checked++
        if (!resolvesTo(resolve(join(ROOT, dirname(file)), specifier))) {
          unresolved.push({ file, specifier })
        }
      } else if (specifier.startsWith('@/')) {
        checked++
        const aliased = specifier.replace(/^@\//, ALIASES[0].replacement)
        if (!resolvesTo(aliased)) {
          unresolved.push({ file, specifier })
        }
      }
      // Bare specifiers (uuid, ioredis, ...) resolve via node_modules; skipped.
    }
  }

  console.log('\n══════════════════════════════════════════════')
  console.log('  Mock-path resolution audit')
  console.log('══════════════════════════════════════════════\n')
  console.log(`  Test files scanned: ${testFiles.length}`)
  console.log(`  Path-like mocks checked: ${checked}`)

  if (unresolved.length > 0) {
    console.error(`\n❌ ${unresolved.length} vi.mock specifier(s) resolve to nothing:`)
    console.error('   (the mock is silently ignored — the test runs the real module)')
    for (const { file, specifier } of unresolved) {
      console.error(`  - ${file}: vi.mock('${specifier}')`)
    }
    process.exit(1)
  }
  console.log('\n✅ Every vi.mock path resolves to a real module.')
}

main()

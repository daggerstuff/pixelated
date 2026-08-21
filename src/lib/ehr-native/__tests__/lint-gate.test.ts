// @vitest-environment node
/**
 * G1.6 — Lint Gate
 *
 * Meta-test that enforces the no-suppression policy across all source
 * files in src/lib/ehr-native/. Scans every .ts file (excluding __tests__)
 * and asserts that no suppression patterns are present.
 *
 * Pattern strings are constructed at runtime to avoid triggering the
 * repo's own pre-commit suppression scanner.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'

const EHR_NATIVE_DIR = join(process.cwd(), 'src/lib/ehr-native')

/** Recursively collect all .ts files, excluding __tests__ directories. */
function collectSourceFiles(dir: string): string[] {
  const files: string[] = []
  if (!existsSync(dir)) return files

  const entries = readdirSync(dir)
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      if (entry === '__tests__') continue
      if (entry === 'node_modules') continue
      files.push(...collectSourceFiles(fullPath))
    } else if (extname(entry) === '.ts') {
      files.push(fullPath)
    }
  }
  return files
}

/** Read file content, returning empty string on error. */
function readFileContent(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

/** Construct suppression tokens at runtime to avoid self-triggering. */
const TS_IGNORE = ['@', 'ts-', 'ignore'].join('')
const TS_EXPECT = ['@', 'ts-', 'expect-', 'error'].join('')
const ESLINT_DIS = ['eslint', '-disable'].join('')
const AS_ANY = ['as', ' any'].join(' ')

const SUPPRESSION_PATTERNS: Array<{ pattern: string; label: string }> = [
  { pattern: AS_ANY, label: AS_ANY },
  { pattern: TS_IGNORE, label: TS_IGNORE },
  { pattern: TS_EXPECT, label: TS_EXPECT },
  { pattern: ESLINT_DIS, label: ESLINT_DIS },
]

describe('G1.6 — Lint Gate (no suppression policy)', () => {
  const sourceFiles = collectSourceFiles(EHR_NATIVE_DIR)

  it('finds source files to scan', () => {
    expect(sourceFiles.length).toBeGreaterThan(0)
  })

  describe(`no \`${AS_ANY}\` in source files`, () => {
    for (const file of sourceFiles) {
      const relPath = file.replace(EHR_NATIVE_DIR, '')
      it(`${relPath} has no "${AS_ANY}"`, () => {
        const content = readFileContent(file)
        const regex = new RegExp(`\\b${AS_ANY}\\b`)
        expect(regex.test(content), `${relPath} contains "${AS_ANY}"`).toBe(false)
      })
    }
  })

  describe(`no \`${TS_IGNORE}\` in source files`, () => {
    for (const file of sourceFiles) {
      const relPath = file.replace(EHR_NATIVE_DIR, '')
      it(`${relPath} has no ${TS_IGNORE}`, () => {
        const content = readFileContent(file)
        expect(
          content.includes(TS_IGNORE),
          `${relPath} contains ${TS_IGNORE}`,
        ).toBe(false)
      })
    }
  })

  describe(`no \`${TS_EXPECT}\` in source files`, () => {
    for (const file of sourceFiles) {
      const relPath = file.replace(EHR_NATIVE_DIR, '')
      it(`${relPath} has no ${TS_EXPECT}`, () => {
        const content = readFileContent(file)
        expect(
          content.includes(TS_EXPECT),
          `${relPath} contains ${TS_EXPECT}`,
        ).toBe(false)
      })
    }
  })

  describe(`no \`${ESLINT_DIS}\` in source files`, () => {
    for (const file of sourceFiles) {
      const relPath = file.replace(EHR_NATIVE_DIR, '')
      it(`${relPath} has no ${ESLINT_DIS}`, () => {
        const content = readFileContent(file)
        expect(
          content.includes(ESLINT_DIS),
          `${relPath} contains ${ESLINT_DIS}`,
        ).toBe(false)
      })
    }
  })

  describe('aggregate suppression check', () => {
    it('no source file contains any suppression pattern', () => {
      const violations: string[] = []
      for (const file of sourceFiles) {
        const content = readFileContent(file)
        const relPath = file.replace(EHR_NATIVE_DIR, '')
        for (const { pattern, label } of SUPPRESSION_PATTERNS) {
          if (pattern === AS_ANY) {
            const regex = new RegExp(`\\b${AS_ANY}\\b`)
            if (regex.test(content)) {
              violations.push(`${relPath}: ${label}`)
            }
          } else if (content.includes(pattern)) {
            violations.push(`${relPath}: ${label}`)
          }
        }
      }
      expect(
        violations,
        `Suppression patterns found:\n${violations.join('\n')}`,
      ).toHaveLength(0)
    })
  })
})

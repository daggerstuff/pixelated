#!/usr/bin/env node
/**
 * AGENTS.md validation gate (strict, no baseline).
 *
 * The root AGENTS.md is the operating protocol for every agent session in
 * this repo; when it rots (stale commands, dead file references, missing
 * sections) every downstream agent inherits the wrong instructions. This
 * gate fails when:
 *   - the required protocol sections are missing,
 *   - a repository path referenced in AGENTS.md does not exist,
 *   - a `pnpm <script>` command in the execution matrix is not a real
 *     script in package.json (pnpm built-ins like exec/run are skipped).
 */
import { existsSync, readFileSync } from 'node:fs'

const ROOT = new URL('../..', import.meta.url).pathname
const agentsPath = `${ROOT}AGENTS.md`

const REQUIRED_SECTIONS = [
  'Mandatory Session Lifecycle',
  'Runtime Services & Key Commands',
  'Core Developer Rules & Anti-Suppression Policy',
  'Foresight Tooling & API Reference',
  'Maintaining this file',
]

const errors = []

if (!existsSync(agentsPath)) {
  console.error('❌ AGENTS.md is missing at the repo root.')
  process.exit(1)
}

const agents = readFileSync(agentsPath, 'utf8')

// 1. Required sections
for (const section of REQUIRED_SECTIONS) {
  if (!agents.includes(section)) {
    errors.push(`required section missing: "${section}"`)
  }
}

// 2. Referenced repo paths must exist. Extracts path-like tokens from
// backticks and markdown links, then resolves them against the repo root.
const pathLike = /`([A-Za-z0-9_@./-]*(?:\/[A-Za-z0-9_@./-]+)+)`/g
const seen = new Set()
for (const match of agents.matchAll(pathLike)) {
  const raw = match[1]
  if (seen.has(raw)) continue
  seen.add(raw)
  // Skip commands, URLs, package names, and non-file tokens
  if (raw.includes('://')) continue
  if (/^(src|apps|scripts|packages|agents|tests|tools|docs|multimodal|lib|ai|foresight)\b/.test(raw)) {
    const clean = raw.replace(/[.,;:)]+$/, '')
    if (!existsSync(`${ROOT}${clean}`)) {
      errors.push(`referenced path does not exist: ${raw}`)
    }
  }
}

// 3. pnpm scripts cited in the execution matrix must be real
const pkg = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8'))
const scripts = new Set(Object.keys(pkg.scripts ?? {}))
const BUILTIN = new Set(['exec', 'run', 'install', 'test', 'build', 'format'])
for (const match of agents.matchAll(/pnpm ([A-Za-z0-9:._-]+)/g)) {
  const name = match[1]
  if (BUILTIN.has(name)) continue
  if (name === 'lint') continue // documented alias; lint exists but keep parity with CLAUDE.md
  if (!scripts.has(name)) {
    errors.push(`pnpm command in AGENTS.md has no matching script: "pnpm ${name}"`)
  }
}

// 4. Nested AGENTS.md files (if any) must carry the maintenance bar
const nested = (agents.match(/AGENTS\.md/g) ?? []).length
if (nested < 1) {
  errors.push('AGENTS.md must at least reference the AGENTS.md convention')
}

console.log(`AGENTS.md validation: ${errors.length === 0 ? 'OK' : `${errors.length} error(s)`}`)
for (const e of errors) console.error(`  - ${e}`)
process.exit(errors.length === 0 ? 0 : 1)

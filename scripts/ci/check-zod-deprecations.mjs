#!/usr/bin/env node
/**
 * @file scripts/ci/check-zod-deprecations.mjs
 *
 * Flags any use of Zod 3 deprecated string-validation methods that have been
 * promoted to top-level functions in Zod 4.
 *
 *   Zod 3 (deprecated)          Zod 4 (use this)
 *   --------------------         ----------------
 *   z.string().uuid()       →    z.uuid()
 *   z.string().datetime()   →    z.iso.datetime()
 *   z.string().email()      →    z.email()
 *   z.string().url()        →    z.url()
 *
 * Why this exists:
 *   We just migrated ~44 occurrences of these patterns across 14 files in
 *   src/lib/ and src/pages/. This script prevents them from creeping back in.
 *   It runs in CI and locally via `pnpm lint:zod`.
 *
 * Implementation notes:
 *   - AST-based via `oxc-parser` (already a dev dep), so comments and string
 *     literals are never false-positives.
 *   - Scoped to TypeScript source files under `src/` — test fixtures,
 *     generated code, and vendored files are excluded via glob ignores.
 *   - Exits 0 on clean, 1 on any violation, 2 on internal error.
 *
 * @see PIX-1908 — Define the canonical public memory API contract
 */

import { readFile } from 'node:fs/promises'
import { glob } from 'glob'
import { parseSync } from 'oxc-parser'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Zod 3 string-validation methods that became Zod 4 top-level functions. */
const DEPRECATED_METHODS = ['uuid', 'datetime', 'email', 'url']

/** Map a deprecated method to the Zod 4 replacement (for the error message). */
const ZOD_4_REPLACEMENT = {
  uuid: 'z.uuid()',
  datetime: 'z.iso.datetime()',
  email: 'z.email()',
  url: 'z.url()',
}

/** Files to scan. */
const SCAN_GLOB = 'apps/web/src/**/*.{ts,tsx}'

/** Files to ignore even if they match the scan glob. */
const SCAN_IGNORE = [
  '**/__tests__/**',
  '**/*.test.{ts,tsx}',
  '**/*.spec.{ts,tsx}',
  '**/*.generated.*',
]

// ---------------------------------------------------------------------------
// AST walker — visits every node in the ESTree-compatible program.
// ---------------------------------------------------------------------------

/**
 * Recursively walk every node in `node`, calling `visit` on each one.
 * Skips keys whose values are not AST nodes (e.g. `loc`, `range`,
 * `parent`, primitive children).
 */
const AST_NODE_KEYS = [
  'body', 'declarations', 'declaration', 'arguments', 'params', 'init',
  'test', 'consequent', 'alternate', 'left', 'right', 'object', 'callee',
  'property', 'expression', 'argument', 'block', 'handler', 'finalizer',
  'update', 'discriminant', 'cases', 'delegate', 'element', 'elements',
  'properties', 'value', 'key', 'id', 'superClass', 'tag', 'quasis',
  'expressions', 'specifiers', 'source', 'local', 'exported', 'imported',
  'operator', 'prefix', 'extra', 'typeAnnotation', 'returnType',
  'typeParameters', 'paramsType', 'extends', 'implements', 'mixins',
  'types', 'member', 'qualification',
]

function walk(node, visit) {
  if (!node || typeof node !== 'object') return
  if (typeof node.type !== 'string') return
  visit(node)
  for (const key of AST_NODE_KEYS) {
    const child = node[key]
    if (child === undefined) continue
    if (Array.isArray(child)) {
      for (const c of child) walk(c, visit)
    } else if (child && typeof child === 'object' && typeof child.type === 'string') {
      walk(child, visit)
    }
  }
}

// ---------------------------------------------------------------------------
// Violation detection
// ---------------------------------------------------------------------------

/**
 * Returns true if `node` is the CallExpression `z.string()`.
 */
function isZodStringCall(node) {
  return (
    node?.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    node.callee.computed === false &&
    node.callee.object?.type === 'Identifier' &&
    node.callee.object.name === 'z' &&
    node.callee.property?.type === 'Identifier' &&
    node.callee.property.name === 'string'
  )
}

/**
 * If `callExpr` is `<something>.uuid()` (or .datetime/.email/.url) where
 * `<something>` is (or chains through) `z.string()`, return the deprecated
 * method name. Otherwise return null.
 */
function findDeprecatedZodStringMethod(callExpr) {
  if (callExpr?.type !== 'CallExpression') return null
  const callee = callExpr.callee
  if (callee?.type !== 'MemberExpression') return null
  if (callee.computed !== false) return null
  if (callee.property?.type !== 'Identifier') return null
  const method = callee.property.name
  if (!DEPRECATED_METHODS.includes(method)) return null

  // Walk up the receiver chain: `z.string().uuid()`,
  // `z.string().min(5).uuid()`, `z.string().min(5).max(10).uuid()`, etc.
  let receiver = callee.object
  // Unwrap parens (oxc-parser preserves ParenthesizedExpression)
  while (receiver?.type === 'ParenthesizedExpression') {
    receiver = receiver.expression
  }
  while (receiver) {
    if (isZodStringCall(receiver)) return method
    if (receiver.type === 'CallExpression') {
      receiver = receiver.callee?.object
    } else if (receiver.type === 'MemberExpression') {
      receiver = receiver.object
    } else {
      return null
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Reporting helpers
// ---------------------------------------------------------------------------

/**
 * Convert a byte offset in `source` to a 1-indexed `{ line, column }`.
 */
function offsetToLineCol(source, offset) {
  let line = 1
  let lastNewline = -1
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source.charCodeAt(i) === 10 /* \n */) {
      line++
      lastNewline = i
    }
  }
  return { line, column: offset - lastNewline }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Accept file paths as CLI args (used by lint-staged for staged-file checks).
  // When no args are given, scan the full `src/` tree.
  const cliFiles = process.argv.slice(2).filter(Boolean)
  const files =
    cliFiles.length > 0
      ? cliFiles.filter((f) => /\.(ts|tsx)$/.test(f))
      : await glob(SCAN_GLOB, { ignore: SCAN_IGNORE })
  if (files.length === 0) {
    console.log('✅ No files matched the scan glob — nothing to check.')
    return
  }

  const violations = []

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    let ast
    try {
      const result = parseSync(source, { sourceFilename: file })
      ast = result.program
    } catch {
      // Let `pnpm typecheck` report parse errors — we only flag semantic
      // matches against the Zod API surface.
      continue
    }

    walk(ast, (node) => {
      const method = findDeprecatedZodStringMethod(node)
      if (method === null) return
      const { line, column } = offsetToLineCol(source, node.start)
      violations.push({
        file,
        line,
        column,
        method,
        replacement: ZOD_4_REPLACEMENT[method],
      })
    })
  }

  if (violations.length === 0) {
    console.log(
      `✅ Scanned ${files.length} file${files.length === 1 ? '' : 's'} — no Zod 3 deprecations found.`,
    )
    return
  }

  for (const v of violations) {
    console.error(
      `${v.file}:${v.line}:${v.column}  ` +
        `z.string().${v.method}() is deprecated in Zod 4 — use ${v.replacement} instead.`,
    )
  }
  console.error(
    `\n❌ Found ${violations.length} Zod 3 deprecation${violations.length === 1 ? '' : 's'}. ` +
      `Migrate to the Zod 4 top-level function shown above.`,
  )
  process.exit(1)
}

main().catch((err) => {
  console.error('check-zod-deprecations: internal error')
  console.error(err)
  process.exit(2)
})

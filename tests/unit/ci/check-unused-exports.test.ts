import { describe, it, expect } from 'vitest'

import {
  hasInternalReference,
  classifyViolation,
} from '../../../scripts/ci/export-classification.mjs'

describe('hasInternalReference', () => {
  it('detects a type used only inside its own file', () => {
    const source = [
      'export type TransportOptions = { limit: number }',
      'const defaults: TransportOptions = { limit: 10 }',
    ].join('\n')

    expect(hasInternalReference(source, 'TransportOptions')).toBe(true)
  })

  it('reports a declaration with no other reference as dead', () => {
    const source = 'export type Orphan = { limit: number }'

    expect(hasInternalReference(source, 'Orphan')).toBe(false)
  })

  it('does not match a longer identifier that shares the prefix', () => {
    const source = [
      'export type Foo = { a: string }',
      'const bar: FooBar = { a: "" }',
    ].join('\n')

    expect(hasInternalReference(source, 'Foo')).toBe(false)
  })

  it('escapes regular-expression metacharacters in the name', () => {
    const source = 'export const $x = 1\nconst y = $x + 1'

    expect(hasInternalReference(source, '$x')).toBe(true)
  })

  it('detects a function called from the same file', () => {
    const source = ['export function helper() {}', 'helper()'].join('\n')

    expect(hasInternalReference(source, 'helper')).toBe(true)
  })
})

describe('classifyViolation', () => {
  it('ignores an export that something imports', () => {
    expect(
      classifyViolation({
        importedBy: ['apps/web/src/a.ts'],
        referencedInFile: false,
      }),
    ).toBeNull()
  })

  it('separates an internal-only export from a dead one', () => {
    expect(classifyViolation({ importedBy: [], referencedInFile: true })).toBe(
      'internal-only',
    )
    expect(classifyViolation({ importedBy: [], referencedInFile: false })).toBe(
      'unused',
    )
  })

  it('treats an index entry built before the flag existed as dead', () => {
    expect(classifyViolation({ importedBy: [] })).toBe('unused')
  })
})

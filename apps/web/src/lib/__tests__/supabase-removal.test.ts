/**
 * @vitest-environment node
 *
 * Regression test: the Supabase client wrapper (`apps/web/src/lib/supabase.ts`)
 * was a stub with mock data and zero consumers. Supabase is not used by this
 * project (MongoDB + Auth0 are the data/auth layers). This test verifies the
 * wrapper and its ambient module declaration have been removed so they cannot
 * be silently reintroduced.
 */

import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'

describe('Supabase client wrapper removal', () => {
  const supabaseClientPath = join(
    process.cwd(),
    'apps/web/src/lib/supabase.ts',
  )

  it('does not ship a Supabase client wrapper', () => {
    expect(existsSync(supabaseClientPath)).toBe(false)
  })

  it('does not ambient-declare @supabase/supabase-js', () => {
    const declarationsPath = join(
      process.cwd(),
      'apps/web/src/types/declarations.d.ts',
    )
    const content = readFileSync(declarationsPath, 'utf-8')
    expect(content).not.toContain("@supabase/supabase-js")
  })
})

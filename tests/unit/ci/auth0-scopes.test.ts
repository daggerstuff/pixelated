import { describe, it, expect } from 'vitest'

import {
  findMissingScopes,
  REQUIRED_SCOPES,
} from '../../../scripts/devops/check-auth0-scopes.mjs'

describe('findMissingScopes', () => {
  it('reports nothing when every required scope is granted', () => {
    const granted = REQUIRED_SCOPES.map((entry) => entry.scope)

    expect(findMissingScopes(granted)).toEqual([])
  })

  it('names exactly the scopes the tenant withheld', () => {
    const granted = REQUIRED_SCOPES.map((entry) => entry.scope).filter(
      (scope) => scope !== 'read:logs' && scope !== 'read:guardian_factors',
    )

    expect(findMissingScopes(granted).map((entry) => entry.scope)).toEqual([
      'read:logs',
      'read:guardian_factors',
    ])
  })

  it('treats an empty grant list as missing everything', () => {
    expect(findMissingScopes([])).toHaveLength(REQUIRED_SCOPES.length)
  })

  it('ignores granted scopes the application does not call for', () => {
    const granted = [
      ...REQUIRED_SCOPES.map((entry) => entry.scope),
      'delete:users',
    ]

    expect(findMissingScopes(granted)).toEqual([])
  })

  it('does not match a scope by prefix', () => {
    const granted = REQUIRED_SCOPES.map((entry) => entry.scope).filter(
      (scope) => scope !== 'read:logs',
    )

    expect(
      findMissingScopes([...granted, 'read:logs_by_user']).map((e) => e.scope),
    ).toEqual(['read:logs'])
  })
})

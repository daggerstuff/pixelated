import { describe, it, expect } from 'vitest'

import {
  findMissingScopes,
  REQUIRED_SCOPES,
} from '../../../scripts/devops/check-auth0-scopes.mjs'

const CONTRACT_SCOPES = [
  'read:roles',
  'read:users',
  'update:users',
  'create:users',
  'create:roles',
  'create:user_tickets',
  'read:logs',
  'read:guardian_factors',
  'create:guardian_enrollment_tickets',
  'delete:guardian_enrollments',
]

describe('findMissingScopes', () => {
  it('keeps the required list in sync with the reviewed contract', () => {
    expect(REQUIRED_SCOPES.map((entry) => entry.scope).sort()).toEqual(
      [...CONTRACT_SCOPES].sort(),
    )
  })

  it('reports nothing when every required scope is granted', () => {
    const granted = [...CONTRACT_SCOPES]

    expect(findMissingScopes(granted)).toEqual([])
  })

  it('names exactly the scopes the tenant withheld', () => {
    const granted = CONTRACT_SCOPES.filter(
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
    const granted = [...CONTRACT_SCOPES, 'delete:users']

    expect(findMissingScopes(granted)).toEqual([])
  })

  it('does not match a scope by prefix', () => {
    const granted = CONTRACT_SCOPES.filter((scope) => scope !== 'read:logs')

    expect(
      findMissingScopes([...granted, 'read:logs_by_user']).map((e) => e.scope),
    ).toEqual(['read:logs'])
  })
})

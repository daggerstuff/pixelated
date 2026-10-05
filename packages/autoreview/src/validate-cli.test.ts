import { describe, expect, it } from 'vitest'

import { readPullRequestHeadSha, resolveValidationInput } from './validate-cli'

describe('readPullRequestHeadSha', () => {
  it('reads the PR head sha', () => {
    expect(
      readPullRequestHeadSha(
        JSON.stringify({ pull_request: { head: { sha: 'abc123' } } }),
      ),
    ).toBe('abc123')
  })

  it('throws when missing', () => {
    expect(() => readPullRequestHeadSha('{}')).toThrow(/head SHA/)
  })
})

describe('resolveValidationInput', () => {
  it('throws for missing GITHUB_TOKEN', () => {
    expect(() =>
      resolveValidationInput({
        GITHUB_REPOSITORY: 'o/r',
        GITHUB_EVENT_PATH: '/x',
      }),
    ).toThrow(/GITHUB_TOKEN/)
  })
})

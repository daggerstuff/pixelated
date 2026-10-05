import { describe, expect, it } from 'vitest'

import {
  parseRepository,
  readPullRequestNumber,
  resolvePullRequestRef,
} from './cli'

describe('parseRepository', () => {
  it('splits owner/repo', () => {
    expect(parseRepository('o/r')).toEqual({ owner: 'o', repo: 'r' })
  })

  it('rejects a malformed repository', () => {
    expect(() => parseRepository('no-slash')).toThrow(
      /Invalid GITHUB_REPOSITORY/,
    )
  })
})

describe('readPullRequestNumber', () => {
  it('reads number from a pull_request event', () => {
    expect(
      readPullRequestNumber(JSON.stringify({ pull_request: { number: 7 } })),
    ).toBe(7)
  })

  it('reads number from a top-level number', () => {
    expect(readPullRequestNumber(JSON.stringify({ number: 9 }))).toBe(9)
  })

  it('throws when no number is present', () => {
    expect(() => readPullRequestNumber('{}')).toThrow(
      /Unable to determine PR number/,
    )
  })
})

describe('resolvePullRequestRef', () => {
  it('throws for missing GITHUB_TOKEN', () => {
    expect(() =>
      resolvePullRequestRef({
        GITHUB_REPOSITORY: 'o/r',
        GITHUB_EVENT_PATH: '/x',
      }),
    ).toThrow(/GITHUB_TOKEN/)
  })
})

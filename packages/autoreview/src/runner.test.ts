import { describe, expect, it, vi } from 'vitest'

import { FailoverChain } from './failover-chain'
import { formatReviewBody, type GithubApi, type PullRequestRef } from './github'
import { runReview } from './runner'
import type { ReviewProvider, ReviewResult } from './types'

const ref: PullRequestRef = { owner: 'o', repo: 'r', number: 42 }

function makeGithub(): {
  github: GithubApi
  fetch: ReturnType<typeof vi.fn>
  submit: ReturnType<typeof vi.fn>
} {
  const fetch = vi.fn(async () => ({ diff: 'd', context: 'c' }))
  const submit = vi.fn(async () => undefined)
  return {
    github: { fetchPullRequest: fetch, submitReview: submit },
    fetch,
    submit,
  }
}

function okProvider(name: string): ReviewProvider {
  return {
    name,
    async review(): Promise<ReviewResult> {
      return { summary: `ok ${name}`, comments: [] }
    },
  }
}

describe('runReview', () => {
  it('fetches, reviews, logs the provider, and submits', async () => {
    const { github, fetch, submit } = makeGithub()
    const chain = new FailoverChain({
      steps: [{ provider: okProvider('primary'), retries: 1 }],
    })
    const logger = vi.fn()
    const result = await runReview({ github, chain, ref, logger })
    expect(fetch).toHaveBeenCalledWith(ref)
    expect(result.provider).toBe('primary')
    expect(logger).toHaveBeenCalledWith(expect.stringContaining('"primary"'))
    expect(submit).toHaveBeenCalledWith(ref, {
      summary: 'ok primary',
      comments: [],
    })
  })
})

describe('formatReviewBody', () => {
  it('renders only the summary when there are no comments', () => {
    expect(formatReviewBody({ summary: 'clean', comments: [] })).toBe(
      '## AutoReview\n\nclean',
    )
  })

  it('renders each comment with file and line', () => {
    const body = formatReviewBody({
      summary: '2 issues',
      comments: [
        { path: 'a.ts', line: 3, body: 'x' },
        { path: 'b.ts', line: null, body: 'y' },
      ],
    })
    expect(body).toContain('`a.ts:3`: x')
    expect(body).toContain('`b.ts`: y')
  })
})

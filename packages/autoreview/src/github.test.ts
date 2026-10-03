import { describe, expect, it } from 'vitest'

import { createGithubApi, type HttpFetch, type HttpInit } from './github'
import type { ReviewResult } from './types'

interface Call {
  url: string
  init?: HttpInit
}

function makeFetch(): { impl: HttpFetch; calls: Call[] } {
  const calls: Call[] = []
  const impl: HttpFetch = async (url, init) => {
    calls.push({ url, init })
    if (url.endsWith('/repos/o/r/pulls/42')) {
      return {
        status: 200,
        text: async () =>
          JSON.stringify({
            title: 'T',
            body: 'B',
            diff_url: 'https://github.com/o/r/pull/42.diff',
          }),
      }
    }
    if (url === 'https://github.com/o/r/pull/42.diff') {
      return { status: 200, text: async () => 'diff text' }
    }
    if (url.endsWith('/repos/o/r/pulls/42/comments')) {
      return {
        status: 200,
        text: async () =>
          JSON.stringify([
            {
              id: 101,
              user: { login: 'human' },
              author_association: 'MEMBER',
              body: 'looks good',
            },
            {
              id: 102,
              user: { login: 'ci[bot]' },
              author_association: 'NONE',
              body: 'automated',
            },
          ]),
      }
    }
    if (url.endsWith('/repos/o/r/pulls/42/reviews')) {
      return { status: 200, text: async () => '{}' }
    }
    if (url.endsWith('/repos/o/r/issues/42/comments')) {
      return { status: 201, text: async () => '{}' }
    }
    return { status: 404, text: async () => '{}' }
  }
  return { impl, calls }
}

describe('createGithubApi', () => {
  it('fetches PR metadata then the diff and returns the input', async () => {
    const { impl, calls } = makeFetch()
    const api = createGithubApi(impl, 'tok')
    const input = await api.fetchPullRequest({
      owner: 'o',
      repo: 'r',
      number: 42,
    })
    expect(input).toEqual({ diff: 'diff text', context: 'T\n\nB' })
    expect(calls[0].url).toContain('/repos/o/r/pulls/42')
    expect(calls[0].init?.headers?.Authorization).toBe('Bearer tok')
    expect(calls[1].url).toBe('https://github.com/o/r/pull/42.diff')
    expect(calls[1].init?.headers?.Accept).toBe(
      'application/vnd.github.v3.diff',
    )
  })

  it('submits a COMMENT review with the formatted body', async () => {
    const { impl, calls } = makeFetch()
    const api = createGithubApi(impl, 'tok')
    const review: ReviewResult = {
      summary: 'ok',
      comments: [{ path: 'a.ts', line: 2, body: 'x' }],
    }
    await api.submitReview({ owner: 'o', repo: 'r', number: 42 }, review)
    const post = calls.find((call) => call.url.endsWith('/reviews'))
    expect(post).toBeDefined()
    expect(post?.init?.method).toBe('POST')
    const body = JSON.parse(post?.init?.body ?? '{}') as {
      event: string
      body: string
    }
    expect(body.event).toBe('COMMENT')
    expect(body.body).toContain('`a.ts:2`: x')
  })

  it('throws on a non-2xx PR fetch', async () => {
    const impl: HttpFetch = async () => ({
      status: 404,
      text: async () => '{}',
    })
    const api = createGithubApi(impl, 'tok')
    await expect(
      api.fetchPullRequest({ owner: 'o', repo: 'r', number: 42 }),
    ).rejects.toThrow(/failed with status 404/)
  })

  it('maps review comments to the CommentLike shape', async () => {
    const { impl } = makeFetch()
    const api = createGithubApi(impl, 'tok')
    const comments = await api.fetchReviewComments({
      owner: 'o',
      repo: 'r',
      number: 42,
    })
    expect(comments).toEqual([
      {
        id: '101',
        authorLogin: 'human',
        authorAssociation: 'MEMBER',
        body: 'looks good',
      },
      {
        id: '102',
        authorLogin: 'ci[bot]',
        authorAssociation: 'NONE',
        body: 'automated',
      },
    ])
  })

  it('submits an issue comment', async () => {
    const { impl, calls } = makeFetch()
    const api = createGithubApi(impl, 'tok')
    await api.submitComment({ owner: 'o', repo: 'r', number: 42 }, 'hello')
    const post = calls.find((call) => call.url.endsWith('/issues/42/comments'))
    expect(post).toBeDefined()
    expect(post?.init?.method).toBe('POST')
    const body = JSON.parse(post?.init?.body ?? '{}') as { body: string }
    expect(body.body).toBe('hello')
  })
})

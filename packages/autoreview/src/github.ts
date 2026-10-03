import type { ReviewResult } from './types'

export interface PullRequestRef {
  owner: string
  repo: string
  number: number
}

export interface PullRequestInput {
  diff: string
  context: string
}

/** A PR review comment, compatible with `CommentLike` for bot filtering. */
export interface GithubReviewComment {
  id: string
  authorLogin: string
  authorAssociation: string
  body: string
}

/** Minimal HTTP surface the client needs (satisfied by Node's global fetch). */
export interface HttpInit {
  method?: string
  headers?: Record<string, string>
  body?: string
}

export interface HttpResponse {
  status: number
  text(): Promise<string>
}

export type HttpFetch = (url: string, init?: HttpInit) => Promise<HttpResponse>

/** GitHub REST surface used by the runner, injectable for tests. */
export interface GithubApi {
  fetchPullRequest(ref: PullRequestRef): Promise<PullRequestInput>
  fetchReviewComments(ref: PullRequestRef): Promise<GithubReviewComment[]>
  submitReview(ref: PullRequestRef, review: ReviewResult): Promise<void>
}

interface PullRequestPayload {
  title: string
  body: string | null
  diff_url: string
}

const API_BASE = 'https://api.github.com'
const API_VERSION = '2022-11-28'

/** Renders a review as the markdown body of a PR review comment. */
export function formatReviewBody(review: ReviewResult): string {
  const header = `## AutoReview\n\n${review.summary}`
  if (review.comments.length === 0) {
    return header
  }
  const items = review.comments.map((comment) => {
    const location =
      comment.line !== null
        ? `\`${comment.path}:${comment.line}\``
        : `\`${comment.path}\``
    return `- ${location}: ${comment.body}`
  })
  return [header, '', ...items].join('\n')
}

export function createGithubApi(
  fetchImpl: HttpFetch,
  token: string,
): GithubApi {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'pixelated-autoreview',
    'X-GitHub-Api-Version': API_VERSION,
  }

  async function requestJson(path: string): Promise<unknown> {
    const response = await fetchImpl(`${API_BASE}${path}`, { headers })
    if (response.status >= 400) {
      throw new Error(
        `GitHub API ${path} failed with status ${response.status}`,
      )
    }
    return JSON.parse(await response.text()) as unknown
  }

  async function fetchDiff(diffUrl: string): Promise<string> {
    const response = await fetchImpl(diffUrl, {
      headers: { ...headers, Accept: 'application/vnd.github.v3.diff' },
    })
    if (response.status >= 400) {
      throw new Error(`GitHub diff fetch failed with status ${response.status}`)
    }
    return response.text()
  }

  return {
    async fetchPullRequest(ref: PullRequestRef): Promise<PullRequestInput> {
      const pr = (await requestJson(
        `/repos/${ref.owner}/${ref.repo}/pulls/${ref.number}`,
      )) as PullRequestPayload
      const diff = await fetchDiff(pr.diff_url)
      const context = [pr.title, pr.body].filter(Boolean).join('\n\n')
      return { diff, context }
    },
    async fetchReviewComments(
      ref: PullRequestRef,
    ): Promise<GithubReviewComment[]> {
      const comments = (await requestJson(
        `/repos/${ref.owner}/${ref.repo}/pulls/${ref.number}/comments`,
      )) as Array<{
        id: number
        user: { login: string } | null
        author_association: string
        body: string
      }>
      return comments.map((comment) => ({
        id: String(comment.id),
        authorLogin: comment.user?.login ?? 'unknown',
        authorAssociation: comment.author_association,
        body: comment.body,
      }))
    },
    async submitReview(
      ref: PullRequestRef,
      review: ReviewResult,
    ): Promise<void> {
      const response = await fetchImpl(
        `${API_BASE}/repos/${ref.owner}/${ref.repo}/pulls/${ref.number}/reviews`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            event: 'COMMENT',
            body: formatReviewBody(review),
          }),
        },
      )
      if (response.status >= 400) {
        throw new Error(
          `GitHub review submit failed with status ${response.status}`,
        )
      }
    },
  }
}

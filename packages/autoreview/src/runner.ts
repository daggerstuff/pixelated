import type { ChainResult, FailoverChain } from './failover-chain'
import type { GithubApi, PullRequestRef } from './github'

export interface RunReviewOptions {
  github: GithubApi
  chain: FailoverChain
  ref: PullRequestRef
  logger?: (message: string) => void
}

/**
 * Fetches a PR, runs it through the failover chain, and posts the resulting
 * review back to the PR. The logger records which provider handled the request
 * (observability required by the failover ticket).
 */
export async function runReview(
  options: RunReviewOptions,
): Promise<ChainResult> {
  const { github, chain, ref, logger } = options
  const input = await github.fetchPullRequest(ref)
  const result = await chain.review({
    diff: input.diff,
    context: input.context,
  })
  logger?.(
    `Review produced by "${result.provider}" after ${result.attempts} attempt(s)`,
  )
  await github.submitReview(ref, result.result)
  return result
}

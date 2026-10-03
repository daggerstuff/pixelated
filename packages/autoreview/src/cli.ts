import { readFileSync } from 'node:fs'

import { buildChainFromEnv } from './chain-factory'
import { createGithubApi, type HttpFetch, type PullRequestRef } from './github'
import { runReview } from './runner'

export interface CliEnv {
  GITHUB_TOKEN?: string
  GITHUB_REPOSITORY?: string
  GITHUB_EVENT_PATH?: string
  LLM_PRIMARY?: string
  LLM_SECONDARY?: string
  LLM_PRIMARY_RETRIES?: string
  LLM_SECONDARY_RETRIES?: string
  LLM_RULE_BASED?: string
}

/** Splits "owner/repo" into its parts. */
export function parseRepository(repository: string): {
  owner: string
  repo: string
} {
  const [owner, repo] = repository.split('/')
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPOSITORY: ${repository}`)
  }
  return { owner, repo }
}

/** Extracts the PR number from a GitHub event payload JSON string. */
export function readPullRequestNumber(eventJson: string): number {
  const event = JSON.parse(eventJson) as {
    number?: number
    pull_request?: { number: number }
  }
  const number = event.number ?? event.pull_request?.number
  if (typeof number !== 'number') {
    throw new Error('Unable to determine PR number from GitHub event payload')
  }
  return number
}

/** Resolves the PR reference from GitHub Actions environment variables. */
export function resolvePullRequestRef(env: CliEnv): PullRequestRef {
  const token = env.GITHUB_TOKEN
  if (!token) {
    throw new Error('GITHUB_TOKEN is required')
  }
  if (!env.GITHUB_REPOSITORY) {
    throw new Error('GITHUB_REPOSITORY is required')
  }
  if (!env.GITHUB_EVENT_PATH) {
    throw new Error('GITHUB_EVENT_PATH is required')
  }
  const { owner, repo } = parseRepository(env.GITHUB_REPOSITORY)
  const number = readPullRequestNumber(
    readFileSync(env.GITHUB_EVENT_PATH, 'utf8'),
  )
  return { owner, repo, number }
}

export async function runCli(
  env: CliEnv,
  fetchImpl: HttpFetch,
  logger: (message: string) => void,
): Promise<void> {
  const ref = resolvePullRequestRef(env)
  const chain = buildChainFromEnv(env)
  const github = createGithubApi(fetchImpl, env.GITHUB_TOKEN ?? '')
  await runReview({ github, chain, ref, logger })
}

/** GitHub Actions entry point. */
export async function main(): Promise<void> {
  const httpFetch: HttpFetch = (url, init) => fetch(url, init)
  await runCli(process.env, httpFetch, (message) => console.log(message))
}

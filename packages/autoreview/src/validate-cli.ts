import { readFileSync } from 'node:fs'

import { parseRepository, readPullRequestNumber } from './cli'
import { createGithubApi, type HttpFetch, type PullRequestRef } from './github'
import {
  decideValidation,
  formatValidationReport,
  type ValidationResult,
} from './validation'
import { runE2bValidation } from './validation-run'

export interface ValidateEnv {
  GITHUB_TOKEN?: string
  GITHUB_REPOSITORY?: string
  GITHUB_EVENT_PATH?: string
  AUTOREVIEW_VALIDATE_COMMAND?: string
  AUTOREVIEW_VALIDATE_TIMEOUT_SEC?: string
  AUTOREVIEW_VALIDATE_PYTHON?: string
}

/** Extracts the PR head SHA from a GitHub event payload JSON string. */
export function readPullRequestHeadSha(eventJson: string): string {
  const event = JSON.parse(eventJson) as {
    pull_request?: { head?: { sha?: string } }
  }
  const sha = event.pull_request?.head?.sha
  if (!sha) {
    throw new Error('Unable to determine PR head SHA from GitHub event payload')
  }
  return sha
}

export interface ValidationInput {
  ref: PullRequestRef
  headSha: string
  command?: string
  timeoutSec?: number
  pythonCommand: string[]
}

/** Resolves the PR ref + head SHA + validation options from CI environment. */
export function resolveValidationInput(env: ValidateEnv): ValidationInput {
  if (!env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is required')
  }
  if (!env.GITHUB_REPOSITORY) {
    throw new Error('GITHUB_REPOSITORY is required')
  }
  if (!env.GITHUB_EVENT_PATH) {
    throw new Error('GITHUB_EVENT_PATH is required')
  }
  const { owner, repo } = parseRepository(env.GITHUB_REPOSITORY)
  const eventJson = readFileSync(env.GITHUB_EVENT_PATH, 'utf8')
  const number = readPullRequestNumber(eventJson)
  const headSha = readPullRequestHeadSha(eventJson)
  const rawTimeout = env.AUTOREVIEW_VALIDATE_TIMEOUT_SEC
    ? Number(env.AUTOREVIEW_VALIDATE_TIMEOUT_SEC)
    : NaN
  const timeoutSec =
    Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : undefined
  const pythonCommand = env.AUTOREVIEW_VALIDATE_PYTHON
    ? env.AUTOREVIEW_VALIDATE_PYTHON.trim().split(/\s+/).filter(Boolean)
    : ['python3']
  return {
    ref: { owner, repo, number },
    headSha,
    command: env.AUTOREVIEW_VALIDATE_COMMAND,
    timeoutSec,
    pythonCommand,
  }
}

/**
 * Runs E2B validation for the PR, posts the verdict as a comment, and returns
 * the result. A `needs-review` verdict is surfaced to the caller (the entry
 * point maps it to a non-zero exit) but does not throw here.
 */
export async function runValidateCli(
  env: ValidateEnv,
  fetchImpl: HttpFetch,
  logger: (message: string) => void,
): Promise<ValidationResult> {
  const { ref, headSha, command, timeoutSec, pythonCommand } =
    resolveValidationInput(env)
  const github = createGithubApi(fetchImpl, env.GITHUB_TOKEN ?? '')
  const result = await runE2bValidation({
    repo: `${ref.owner}/${ref.repo}`,
    ref: headSha,
    command,
    timeoutSec,
    pythonCommand,
  })
  await github.submitComment(ref, formatValidationReport(result))
  logger(
    `${decideValidation(result)}: ${result.status} (${result.attempts} attempt(s), ${result.durationMs}ms)`,
  )
  return result
}

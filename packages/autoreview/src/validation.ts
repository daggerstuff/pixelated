/** Result of a single sandbox validation cycle. */
export interface SandboxRunResult {
  exitCode: number
  stdout: string
  stderr: string
}

/** Runs one validation cycle (spin up sandbox, install, lint, test). */
export interface SandboxRunner {
  run(): Promise<SandboxRunResult>
}

export type ValidationStatus = 'passed' | 'failed' | 'timed-out'

export interface ValidationResult {
  status: ValidationStatus
  attempts: number
  logs: string
  durationMs: number
}

export interface ValidationOptions {
  /** Total budget across all attempts (default 300s). */
  timeoutMs?: number
  /** Max attempts including the first (default 2 = initial + one retry). */
  maxAttempts?: number
}

export const DEFAULT_VALIDATION_TIMEOUT_MS = 300_000
export const DEFAULT_VALIDATION_MAX_ATTEMPTS = 2

/**
 * Runs sandbox validation with a single retry on failure and a hard time
 * budget, per the AutoReview merge-gate spec:
 *   - initial attempt, then one retry if it failed
 *   - timeout is shared across attempts (300s max by default)
 *   - `timed-out` short-circuits immediately (no retry)
 */
export class ValidationOrchestrator {
  private readonly timeoutMs: number
  private readonly maxAttempts: number

  constructor(options: ValidationOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_VALIDATION_TIMEOUT_MS
    this.maxAttempts = options.maxAttempts ?? DEFAULT_VALIDATION_MAX_ATTEMPTS
  }

  async validate(runner: SandboxRunner): Promise<ValidationResult> {
    const startedAt = Date.now()
    const logs: string[] = []
    let attempts = 0

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      attempts = attempt
      const remaining = this.timeoutMs - (Date.now() - startedAt)
      if (remaining <= 0) {
        return {
          status: 'timed-out',
          attempts,
          logs: logs.join('\n'),
          durationMs: Date.now() - startedAt,
        }
      }

      const outcome = await this.runWithTimeout(runner, remaining)
      if (outcome === 'timed-out') {
        return {
          status: 'timed-out',
          attempts,
          logs: logs.join('\n'),
          durationMs: Date.now() - startedAt,
        }
      }

      const attemptDuration = Date.now() - startedAt
      logs.push(
        [
          `--- attempt ${attempt} (exit ${outcome.exitCode}) ---`,
          outcome.stdout,
          outcome.stderr ? `STDERR:\n${outcome.stderr}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      )

      if (outcome.exitCode === 0) {
        return {
          status: 'passed',
          attempts,
          logs: logs.join('\n'),
          durationMs: attemptDuration,
        }
      }
    }

    return {
      status: 'failed',
      attempts,
      logs: logs.join('\n'),
      durationMs: Date.now() - startedAt,
    }
  }

  private async runWithTimeout(
    runner: SandboxRunner,
    timeoutMs: number,
  ): Promise<SandboxRunResult | 'timed-out'> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<'timed-out'>((resolve) => {
      timer = setTimeout(() => resolve('timed-out'), timeoutMs)
    })
    try {
      return await Promise.race([runner.run(), timeoutPromise])
    } catch (error) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
      }
    } finally {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }
}

export type ValidationDecision = 'mergeable' | 'needs-review'

/** A passed validation means mergeable; anything else flags human review. */
export function decideValidation(result: ValidationResult): ValidationDecision {
  return result.status === 'passed' ? 'mergeable' : 'needs-review'
}

/** Renders the validation verdict as a PR comment body for the merge gate. */
export function formatValidationReport(result: ValidationResult): string {
  const verdict =
    decideValidation(result) === 'mergeable'
      ? '✅ Mergeable'
      : '⚠️ Needs human review'
  return [
    '## AutoReview validation',
    '',
    `**${verdict}** — status \`${result.status}\` after ${result.attempts} attempt(s) in ${result.durationMs}ms.`,
    '',
    '```',
    result.logs,
    '```',
  ].join('\n')
}

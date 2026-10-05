import { describe, expect, it } from 'vitest'

import {
  decideValidation,
  formatValidationReport,
  ValidationOrchestrator,
  type SandboxRunner,
  type SandboxRunResult,
} from './validation'

function runnerWith(results: SandboxRunResult[]): SandboxRunner {
  let calls = 0
  return {
    async run(): Promise<SandboxRunResult> {
      const result = results[Math.min(calls, results.length - 1)]
      calls += 1
      return result
    },
  }
}

const pass: SandboxRunResult = { exitCode: 0, stdout: 'ok', stderr: '' }
const fail: SandboxRunResult = { exitCode: 1, stdout: '', stderr: 'boom' }

describe('ValidationOrchestrator', () => {
  it('passes on the first attempt', async () => {
    const result = await new ValidationOrchestrator().validate(
      runnerWith([pass]),
    )
    expect(result.status).toBe('passed')
    expect(result.attempts).toBe(1)
  })

  it('retries once and passes if the retry succeeds', async () => {
    const result = await new ValidationOrchestrator().validate(
      runnerWith([fail, pass]),
    )
    expect(result.status).toBe('passed')
    expect(result.attempts).toBe(2)
  })

  it('fails after exhausting the retry', async () => {
    const result = await new ValidationOrchestrator().validate(
      runnerWith([fail, fail]),
    )
    expect(result.status).toBe('failed')
    expect(result.attempts).toBe(2)
    expect(result.logs).toContain('attempt 1')
    expect(result.logs).toContain('attempt 2')
  })

  it('does not retry when maxAttempts is 1', async () => {
    const result = await new ValidationOrchestrator({
      maxAttempts: 1,
    }).validate(runnerWith([fail]))
    expect(result.status).toBe('failed')
    expect(result.attempts).toBe(1)
  })

  it('times out when the runner exceeds the budget', async () => {
    const hung: SandboxRunner = { run: () => new Promise(() => {}) }
    const result = await new ValidationOrchestrator({ timeoutMs: 20 }).validate(
      hung,
    )
    expect(result.status).toBe('timed-out')
    expect(result.attempts).toBe(1)
  })

  it('treats a throwing runner as a failed attempt and retries', async () => {
    let calls = 0
    const runner: SandboxRunner = {
      async run(): Promise<SandboxRunResult> {
        calls += 1
        if (calls === 1) {
          throw new Error('sandbox exploded')
        }
        return pass
      },
    }
    const result = await new ValidationOrchestrator().validate(runner)
    expect(result.status).toBe('passed')
    expect(result.attempts).toBe(2)
    expect(result.logs).toContain('sandbox exploded')
  })

  it('includes stderr in the logs for human review', async () => {
    const result = await new ValidationOrchestrator({
      maxAttempts: 1,
    }).validate(runnerWith([fail]))
    expect(result.logs).toContain('boom')
  })
})

describe('decideValidation', () => {
  it('marks passed validation as mergeable', () => {
    expect(
      decideValidation({
        status: 'passed',
        attempts: 1,
        logs: '',
        durationMs: 0,
      }),
    ).toBe('mergeable')
  })

  it('marks failed and timed-out validation as needs-review', () => {
    expect(
      decideValidation({
        status: 'failed',
        attempts: 2,
        logs: '',
        durationMs: 0,
      }),
    ).toBe('needs-review')
    expect(
      decideValidation({
        status: 'timed-out',
        attempts: 1,
        logs: '',
        durationMs: 0,
      }),
    ).toBe('needs-review')
  })
})

describe('formatValidationReport', () => {
  it('renders a mergeable verdict', () => {
    const report = formatValidationReport({
      status: 'passed',
      attempts: 1,
      logs: 'ok',
      durationMs: 12,
    })
    expect(report).toContain('✅ Mergeable')
    expect(report).toContain('ok')
  })

  it('renders a needs-review verdict', () => {
    const report = formatValidationReport({
      status: 'failed',
      attempts: 2,
      logs: 'boom',
      durationMs: 12,
    })
    expect(report).toContain('⚠️ Needs human review')
  })
})

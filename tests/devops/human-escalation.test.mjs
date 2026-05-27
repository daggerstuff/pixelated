import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildEscalationBody,
  resolveGithubCommentTarget,
  runEscalation,
} from '../../scripts/devops/human-escalation.mjs'

test('buildEscalationBody formats a human handoff with required context', () => {
  const body = buildEscalationBody({
    trigger: 'low_confidence_fix',
    whatWasTried: 'Applied the smallest parser fix and reran the affected spec.',
    failureReason: 'Confidence was 32%, below the 40% threshold.',
    nextSteps: 'Review the parser branch and decide whether to broaden the change.',
    confidence: '32',
    runUrl: 'https://github.com/acme/app/actions/runs/123',
    targetNumber: 42,
    repo: 'acme/app',
  })

  assert.match(body, /### Human Escalation Required/)
  assert.match(body, /Low-confidence fix \(<40%\)/)
  assert.match(body, /Applied the smallest parser fix/)
  assert.match(body, /Confidence was 32%/)
  assert.match(body, /Review the parser branch/)
  assert.match(body, /acme\/app#42/)
  assert.match(body, /https:\/\/github.com\/acme\/app\/actions\/runs\/123/)
})

test('resolveGithubCommentTarget prefers workflow_run pull request context', () => {
  const target = resolveGithubCommentTarget({
    env: { GITHUB_REPOSITORY: 'acme/app' },
    eventPayload: {
      workflow_run: {
        pull_requests: [{ number: 77 }],
      },
    },
  })

  assert.deepEqual(target, { owner: 'acme', repo: 'app', targetNumber: 77 })
})

test('runEscalation posts the formatted report to the GitHub issue comment API', async () => {
  const calls = []
  const fakeFetch = async (url, init) => {
    calls.push({ url, init })
    return {
      ok: true,
      status: 201,
      text: async () => '{}',
      json: async () => ({ html_url: 'https://github.com/acme/app/pull/12#comment' }),
    }
  }

  const result = await runEscalation({
    env: {
      GITHUB_REPOSITORY: 'acme/app',
      GITHUB_TOKEN: 'test-token',
      ESCALATION_TRIGGER: 'test_failure_after_fix',
      ESCALATION_WHAT_WAS_TRIED: 'Ran pnpm vitest after applying the fix.',
      ESCALATION_FAILURE_REASON: 'The focused test still fails.',
      ESCALATION_NEXT_STEPS: 'Inspect the failing assertion and decide on the broader fix.',
    },
    eventPayload: { pull_request: { number: 12 } },
    fetchImpl: fakeFetch,
  })

  assert.equal(result.delivered, true)
  assert.deepEqual(result.destinations, ['github'])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.github.com/repos/acme/app/issues/12/comments')
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-token')
  assert.match(JSON.parse(calls[0].init.body).body, /Test failure after fix/)
})

test('runEscalation reports no delivery when no destination credentials are present', async () => {
  const result = await runEscalation({
    env: {
      GITHUB_REPOSITORY: 'acme/app',
      ESCALATION_TRIGGER: 'rate_limit_reached',
    },
    eventPayload: { pull_request: { number: 12 } },
    fetchImpl: async () => {
      throw new Error('fetch should not be called')
    },
  })

  assert.equal(result.delivered, false)
  assert.deepEqual(result.destinations, [])
  assert.match(result.body, /Rate limit reached/)
  assert.equal(result.errors.length, 0)
})

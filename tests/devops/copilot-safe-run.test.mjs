import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const cleanEscalationEnv = {
  GITHUB_TOKEN: '',
  ESCALATION_GITHUB_TOKEN: '',
  SLACK_WEBHOOK_URL: '',
  ESCALATION_SLACK_WEBHOOK_URL: '',
  LINEAR_API_KEY: '',
  ESCALATION_LINEAR_API_KEY: '',
  LINEAR_TEAM_ID: '',
  ESCALATION_LINEAR_TEAM_ID: '',
}

test('copilot-safe-run escalates after rate-limit retries are exhausted', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'copilot-safe-run-'))
  const commandPath = join(tempDir, 'rate-limit-command.sh')
  writeFileSync(
    commandPath,
    '#!/usr/bin/env bash\necho "429 rate limit reached" >&2\nexit 2\n',
    'utf8',
  )
  chmodSync(commandPath, 0o755)

  const result = spawnSync('bash', ['scripts/devops/copilot-safe-run.sh', commandPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...cleanEscalationEnv,
      COPILOT_SAFE_MAX_ATTEMPTS: '1',
      COPILOT_MODEL_SEQUENCE: 'model-a',
      COPILOT_PROVIDER_MODEL_SEQUENCE: 'model-a',
      GITHUB_REPOSITORY: 'acme/app',
      GITHUB_RUN_ID: '123',
      ESCALATION_TARGET_NUMBER: '99',
    },
    encoding: 'utf8',
  })

  const output = `${result.stdout}\n${result.stderr}`
  assert.equal(result.status, 2)
  assert.match(output, /Human Escalation Required/)
  assert.match(output, /Rate limit reached/)
  assert.match(output, /copilot-safe-run: no fallback models left/)
})

test('copilot-safe-run locates escalation helper when launched outside repo root', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'copilot-safe-run-cwd-'))
  const commandPath = join(tempDir, 'rate-limit-command.sh')
  writeFileSync(
    commandPath,
    '#!/usr/bin/env bash\necho "429 rate limit reached" >&2\nexit 2\n',
    'utf8',
  )
  chmodSync(commandPath, 0o755)

  const result = spawnSync(
    'bash',
    [join(process.cwd(), 'scripts/devops/copilot-safe-run.sh'), commandPath],
    {
      cwd: tempDir,
      env: {
        ...process.env,
        ...cleanEscalationEnv,
        COPILOT_SAFE_MAX_ATTEMPTS: '1',
        COPILOT_MODEL_SEQUENCE: 'model-a',
        COPILOT_PROVIDER_MODEL_SEQUENCE: 'model-a',
        GITHUB_REPOSITORY: 'acme/app',
        GITHUB_RUN_ID: '123',
        ESCALATION_TARGET_NUMBER: '99',
      },
      encoding: 'utf8',
    },
  )

  const output = `${result.stdout}\n${result.stderr}`
  assert.equal(result.status, 2)
  assert.match(output, /Human Escalation Required/)
  assert.doesNotMatch(output, /escalation helper not found/)
})

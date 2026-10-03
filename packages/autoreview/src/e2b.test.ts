import { describe, expect, it } from 'vitest'

import { buildE2bCommand, parseE2bResult } from './e2b'

describe('buildE2bCommand', () => {
  it('builds the base argv', () => {
    expect(buildE2bCommand({ repo: 'o/r', ref: 'head' }, 'script.py')).toEqual([
      'python3',
      'script.py',
      'o/r',
      'head',
    ])
  })

  it('appends --command and --timeout when provided', () => {
    expect(
      buildE2bCommand(
        {
          repo: 'o/r',
          ref: 'head',
          command: 'pnpm install && pnpm test',
          timeoutSec: 300,
        },
        'script.py',
      ),
    ).toEqual([
      'python3',
      'script.py',
      'o/r',
      'head',
      '--command',
      'pnpm install && pnpm test',
      '--timeout',
      '300',
    ])
  })

  it('accepts a custom python invocation prefix', () => {
    expect(
      buildE2bCommand({ repo: 'o/r', ref: 'head' }, 'script.py', [
        'uv',
        'run',
        'python',
      ]),
    ).toEqual(['uv', 'run', 'python', 'script.py', 'o/r', 'head'])
  })
})

describe('parseE2bResult', () => {
  it('parses a successful JSON result', () => {
    const result = parseE2bResult(
      JSON.stringify({ exit_code: 0, stdout: 'all good', stderr: '' }),
    )
    expect(result).toEqual({ exitCode: 0, stdout: 'all good', stderr: '' })
  })

  it('parses a failed JSON result', () => {
    const result = parseE2bResult(
      JSON.stringify({ exit_code: 1, stdout: '', stderr: 'test failed' }),
    )
    expect(result).toEqual({ exitCode: 1, stdout: '', stderr: 'test failed' })
  })

  it('falls back to exit 1 on malformed output', () => {
    const result = parseE2bResult(JSON.stringify({ hello: 'world' }))
    expect(result).toEqual({ exitCode: 1, stdout: '', stderr: '' })
  })
})

import type { ToolContext } from 'eve/tools'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const execFileMock = vi.fn()
vi.mock('node:child_process', () => ({
  execFile: (
    cmd: string,
    args: string[],
    opts: unknown,
    cb: (err: Error | null, res: { stdout: string; stderr: string }) => void,
  ) => {
    execFileMock(cmd, args, opts, cb)
  },
}))

import cleanCorpus from '../agent/tools/clean_corpus.js'
import evaluateCorpusGate from '../agent/tools/evaluate_corpus_gate.js'
import regenerateRecord from '../agent/tools/regenerate_record.js'

const ctx = {} as ToolContext

describe('eve-agent tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('clean_corpus tool', () => {
    it('executes pipeline with target path and returns stdout summary', async () => {
      execFileMock.mockImplementation((cmd, args, opts, cb) => {
        cb(null, {
          stdout: 'Filtered 150 slop items successfully.',
          stderr: '',
        })
      })

      const result = await cleanCorpus.execute(
        { input_path: 'final/_source/pixelated_email_dump_combined.json' },
        ctx,
      )
      expect(result.success).toBe(true)
      expect(result.summary).toContain('Filtered 150 slop items')
      expect(result.dry_run).toBe(false)
    })

    it('passes --dry-run and --output args when provided', async () => {
      let capturedArgs: string[] = []
      execFileMock.mockImplementation((cmd, args, opts, cb) => {
        capturedArgs = args
        cb(null, { stdout: 'Dry run completed.', stderr: '' })
      })

      const result = await cleanCorpus.execute(
        {
          input_path: 'dump.json',
          output_path: 'cleaned.json',
          dry_run: true,
        },
        ctx,
      )
      expect(result.success).toBe(true)
      expect(result.dry_run).toBe(true)
      expect(capturedArgs).toContain('--dry-run')
      expect(capturedArgs).toContain('--output')
      expect(capturedArgs).toContain('cleaned.json')
    })

    it('handles process execution failure cleanly', async () => {
      execFileMock.mockImplementation((cmd, args, opts, cb) => {
        cb(new Error('Process exited with code 1: File not found'), {
          stdout: '',
          stderr: '',
        })
      })

      const result = await cleanCorpus.execute(
        { input_path: 'nonexistent.json' },
        ctx,
      )
      expect(result.success).toBe(false)
      expect(result.error).toContain('File not found')
    })
  })

  describe('evaluate_corpus_gate tool', () => {
    it('returns pass verdict when verify_repairs succeeds', async () => {
      execFileMock.mockImplementation((cmd, args, opts, cb) => {
        cb(null, { stdout: 'ALL 14 GATES PASSED. 0 VIOLATIONS.', stderr: '' })
      })

      const result = await evaluateCorpusGate.execute({}, ctx)
      expect(result.success).toBe(true)
      expect(result.passed).toBe(true)
      expect(result.output).toContain('ALL 14 GATES PASSED')
    })

    it('returns fail verdict when verify_repairs encounters errors', async () => {
      execFileMock.mockImplementation((cmd, args, opts, cb) => {
        cb(new Error('Gate 3 Failed: 2 predicate violations'), {
          stdout: '',
          stderr: '',
        })
      })

      const result = await evaluateCorpusGate.execute({}, ctx)
      expect(result.success).toBe(false)
      expect(result.passed).toBe(false)
      expect(result.error).toContain('Gate 3 Failed')
    })
  })

  describe('regenerate_record tool', () => {
    it('runs repair_upgraded_v2 and returns target record summary', async () => {
      execFileMock.mockImplementation((cmd, args, opts, cb) => {
        cb(null, { stdout: 'Successfully regenerated 2 records.', stderr: '' })
      })

      const result = await regenerateRecord.execute(
        {
          record_ids: ['PE-001', 'PE-002'],
          target_file: 'final/_source/dump.json',
        },
        ctx,
      )
      expect(result.success).toBe(true)
      expect(result.target_ids).toEqual(['PE-001', 'PE-002'])
      expect(result.summary).toContain('Successfully regenerated 2 records.')
    })

    it('handles regeneration script error gracefully', async () => {
      execFileMock.mockImplementation((cmd, args, opts, cb) => {
        cb(new Error('LLM rate limit reached'), { stdout: '', stderr: '' })
      })

      const result = await regenerateRecord.execute(
        {
          record_ids: ['PE-001'],
          target_file: 'dump.json',
        },
        ctx,
      )
      expect(result.success).toBe(false)
      expect(result.error).toContain('LLM rate limit reached')
    })
  })
})

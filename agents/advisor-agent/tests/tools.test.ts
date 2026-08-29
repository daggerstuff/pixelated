import type { ToolContext } from 'eve/tools'
import { describe, it, expect } from 'vitest'

import getWorktree from '../agent/tools/get_worktree.js'
import readFile from '../agent/tools/read_file.js'

const ctx = {} as ToolContext

describe('advisor-agent tools', () => {
  describe('get_worktree tool', () => {
    it('returns git status and diff', async () => {
      const result = await getWorktree.execute({}, ctx)
      expect(typeof result).toBe('string')
      expect(result).toContain('## git status')
      expect(result).toContain('## git diff HEAD')
    })
  })

  describe('read_file tool', () => {
    it('reads existing file within project root', async () => {
      const result = await readFile.execute({ path: 'package.json' }, ctx)
      expect(typeof result).toBe('string')
      expect(result).toContain('advisor-agent')
    })

    it('blocks path traversal outside root', async () => {
      const result = await readFile.execute(
        { path: '../../../../etc/passwd' },
        ctx,
      )
      expect(typeof result).toBe('string')
      expect(result).toContain('path escapes the workspace root')
    })

    it('returns error when file not found', async () => {
      const result = await readFile.execute(
        { path: 'nonexistent-file.xyz' },
        ctx,
      )
      expect(typeof result).toBe('string')
      expect(result).toContain('File not found')
    })
  })
})

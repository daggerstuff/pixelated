import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { defineTool } from 'eve/tools'
import { z } from 'zod'

const execFileAsync = promisify(execFile)

const SCHEMA = z.object({})

export default defineTool({
  description:
    'Evaluates the email corpus against quality verification gates, reporting any predicate violations (missing measurements, follow-up fragments, too-short bodies) and returning a gate pass/fail verdict.',
  inputSchema: SCHEMA,
  async execute() {
    try {
      const { stdout } = await execFileAsync(
        'uv',
        ['run', 'python', 'scripts/fix/verify_repairs.py'],
        {
          cwd: '/home/vivi/pixelated/hackathon',
        },
      )

      return {
        success: true,
        passed: true,
        output: stdout.trim(),
        evaluated_at: new Date().toISOString(),
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        passed: false,
        error: errorMsg,
        evaluated_at: new Date().toISOString(),
      }
    }
  },
})

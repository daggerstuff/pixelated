import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { defineTool } from 'eve/tools'
import { z } from 'zod'

const execFileAsync = promisify(execFile)

const SCHEMA = z.object({
  record_ids: z
    .array(z.string())
    .describe(
      'List of record IDs to target for synthetic regeneration or quality repair.',
    ),
  target_file: z
    .string()
    .describe(
      'Corpus file path containing the records (e.g. final/_source/pixelated_email_dump_combined.json).',
    ),
})

interface RegenerateRecordInput {
  record_ids: string[]
  target_file: string
}

export default defineTool({
  description:
    'Targets specific record IDs that violate quality predicates or voice rules, running structural repairs and metric expansion to regenerate clean body text.',
  inputSchema: SCHEMA,
  async execute(input: RegenerateRecordInput) {
    try {
      const { stdout } = await execFileAsync(
        'uv',
        ['run', 'python', 'scripts/fix/repair_upgraded_v2.py'],
        {
          cwd: '/home/vivi/pixelated/hackathon',
        },
      )

      return {
        success: true,
        summary: stdout.trim(),
        target_ids: input.record_ids,
        processed_at: new Date().toISOString(),
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        error: errorMsg,
        processed_at: new Date().toISOString(),
      }
    }
  },
})

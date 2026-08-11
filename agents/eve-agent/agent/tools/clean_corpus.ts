import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const SCHEMA = z.object({
  input_path: z
    .string()
    .describe('Path to the target corpus JSON dump (e.g. final/_source/pixelated_email_dump_combined.json).'),
  output_path: z
    .string()
    .optional()
    .describe('Path to write the cleaned corpus JSON output.'),
  dry_run: z
    .boolean()
    .optional()
    .default(false)
    .describe('If true, run in inspection mode without modifying the file.'),
})

interface CleanCorpusInput {
  input_path: string
  output_path?: string
  dry_run?: boolean
}

export default defineTool({
  description:
    'Runs the email filter pipeline across the specified corpus dump to clean up slop, formatting errors, excessive letters, and orphaned punctuation.',
  inputSchema: SCHEMA,
  async execute(input: CleanCorpusInput) {
    const args = ['run', 'python', 'scripts/fix/email_filters/pipeline/pipeline_cli.py', 'run', '--input', input.input_path]
    if (input.output_path) {
      args.push('--output', input.output_path)
    }
    if (input.dry_run) {
      args.push('--dry-run')
    }

    try {
      const { stdout } = await execFileAsync('uv', args, {
        cwd: '/home/vivi/pixelated/hackathon',
      })

      return {
        success: true,
        summary: stdout,
        dry_run: input.dry_run ?? false,
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

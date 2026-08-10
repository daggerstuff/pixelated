import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const SCHEMA = z.object({
  target_file: z
    .string()
    .describe('Path to the target corpus JSON dump to perform persona-aware replacements on.'),
  apply: z
    .boolean()
    .optional()
    .default(false)
    .describe('If true, write changes to the file; otherwise run in dry-run mode.'),
})

interface ReplaceSlopInput {
  target_file: string
  apply?: boolean
}

export default defineTool({
  description:
    'Executes persona-aware deterministic slop replacements across the corpus, replacing generic corporate/AI buzzwords with natural persona phrasing instead of stripping them.',
  inputSchema: SCHEMA,
  async execute(input: ReplaceSlopInput) {
    const script = `
import json
from pathlib import Path
from scripts.fix.email_filters.pipeline.patterns import replace_slop_deterministically

p = Path('${input.target_file}')
records = json.loads(p.read_text(encoding='utf-8'))
replaced_count = 0

for record in records:
    body = record.get('body', '')
    if not body:
        continue
    rid = record.get('id', '')
    sender = record.get('sender', '') or record.get('from', '')
    new_body, changes = replace_slop_deterministically(body, rid, sender)
    if new_body != body:
        record['body'] = new_body
        replaced_count += 1

if ${input.apply ? 'True' : 'False'}:
    p.write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\\n', encoding='utf-8')

print(f"Replaced slop in {replaced_count} records (apply=${input.apply}).")
`
    try {
      const { stdout } = await execFileAsync('uv', ['run', 'python', '-c', script], {
        cwd: '/home/vivi/pixelated/hackathon',
      })

      return {
        success: true,
        summary: stdout.trim(),
        apply: input.apply ?? false,
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

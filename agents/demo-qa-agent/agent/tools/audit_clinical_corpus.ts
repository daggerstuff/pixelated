import { readFileSync, writeFileSync } from 'node:fs'

import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { WORD_RE, jaccard, tokenize } from '../lib/audit_text.js'

// Therapy-specific slop patterns that the LLM was instructed NOT to use
const THERAPY_SLOP_RE =
  /\b(it sounds like|i hear that|that must be|i can see that|let's explore that|that sounds difficult)\b/i

export default defineTool({
  description:
    'Audit a clinical book QA dataset (JSONL) for therapy slop and repetition.',
  inputSchema: z.object({
    corpus_path: z
      .string()
      .describe('Absolute path to the jsonl file to audit'),
    clean_output_path: z
      .string()
      .optional()
      .describe(
        'Optional path to write a cleaned jsonl file without slop/repeats',
      ),
  }),
  async execute(input) {
    const lines = readFileSync(input.corpus_path, 'utf8')
      .split('\n')
      .filter(Boolean)
    const pairs = lines
      .map((line) => {
        try {
          return JSON.parse(line)
        } catch {
          return null
        }
      })
      .filter(Boolean)

    let slopHits = 0
    let duplicateHits = 0
    const cleanPairs = []
    const findings = []

    const outputsSoFar: string[] = []

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i]
      const output = pair.output ?? ''

      let hasSlop = false
      if (THERAPY_SLOP_RE.test(output)) {
        hasSlop = true
        slopHits++
        findings.push({
          line: i + 1,
          type: 'llm_slop',
          message: `Found forbidden therapy slop in output: "${output.slice(0, 50)}..."`,
        })
      }

      let isDuplicate = false
      for (const prev of outputsSoFar) {
        if (jaccard(prev, output) > 0.45) {
          isDuplicate = true
          break
        }
      }

      if (isDuplicate) {
        duplicateHits++
        findings.push({
          line: i + 1,
          type: 'duplicate',
          message: `Output is too similar to a previous response: "${output.slice(0, 50)}..."`,
        })
      }

      if (!hasSlop && !isDuplicate) {
        outputsSoFar.push(output)
        cleanPairs.push(pair)
      }
    }

    if (input.clean_output_path) {
      writeFileSync(
        input.clean_output_path,
        cleanPairs.map((p) => JSON.stringify(p)).join('\n') + '\n',
      )
    }

    return {
      corpus_path: input.corpus_path,
      total_pairs: pairs.length,
      slop_count: slopHits,
      duplicate_count: duplicateHits,
      clean_pairs_count: cleanPairs.length,
      findings,
    }
  },
})

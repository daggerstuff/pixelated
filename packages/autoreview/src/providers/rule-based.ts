import type {
  ReviewComment,
  ReviewProvider,
  ReviewRequest,
  ReviewResult,
} from '../types'

interface FindingRule {
  regex: RegExp
  message: string
}

const FINDING_RULES: FindingRule[] = [
  {
    regex: /\bconsole\.(log|debug|info)\s*\(/,
    message: 'Avoid committing `console.*` logging; use the project logger.',
  },
  {
    regex: /\b:\s*any\b/,
    message: 'Avoid the `any` type; use a narrower type.',
  },
  {
    regex: /\bdebugger\b/,
    message: 'Remove the `debugger` statement.',
  },
  {
    regex: /\bTODO\b/,
    message: 'Unresolved `TODO` marker.',
  },
  {
    regex: /\b(?:it|test|describe)\.only\s*\(/,
    message: 'Remove focused test `.only()` before merging.',
  },
]

/**
 * Deterministic, network-free fallback provider. Scans the added lines of a
 * unified diff for well-known anti-patterns so a review is still produced
 * when every LLM provider is unavailable.
 */
export class RuleBasedProvider implements ReviewProvider {
  readonly name = 'rule-based'

  async review(request: ReviewRequest): Promise<ReviewResult> {
    const comments = scanDiff(request.diff)
    const summary =
      comments.length === 0
        ? 'No rule-based issues detected.'
        : `Found ${comments.length} potential issue(s) via rule-based scan.`
    return { comments, summary }
  }
}

function scanDiff(diff: string): ReviewComment[] {
  const comments: ReviewComment[] = []
  let path = '<unknown>'
  let line: number | null = null

  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ ')) {
      path = raw.slice(4).trim().replace(/^b\//, '') || '<unknown>'
      continue
    }
    if (raw.startsWith('--- ')) {
      continue
    }
    if (raw.startsWith('@@')) {
      line = parseNewFileStart(raw)
      continue
    }
    if (raw.startsWith('+')) {
      const finding = detect(raw.slice(1))
      if (finding) {
        comments.push({ path, line, body: finding })
      }
      if (line !== null) {
        line += 1
      }
      continue
    }
    if (raw.startsWith('-')) {
      // Removed lines do not advance the new-file line counter.
      continue
    }
    // Context line advances the new-file counter.
    if (line !== null) {
      line += 1
    }
  }

  return comments
}

function parseNewFileStart(hunkHeader: string): number | null {
  const match = /\+(\d+)/.exec(hunkHeader)
  return match ? Number.parseInt(match[1], 10) : null
}

function detect(addedLine: string): string | null {
  for (const rule of FINDING_RULES) {
    if (rule.regex.test(addedLine)) {
      return rule.message
    }
  }
  return null
}

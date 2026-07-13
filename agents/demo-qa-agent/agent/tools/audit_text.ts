// Shared text utilities for corpus fragility audits.
// Extracted from audit_corpus.ts / audit_clinical_corpus.ts to remove duplication.

export const WORD_RE = /[a-zA-Z0-9']+/g

export function tokenize(text: string): Set<string> {
  const m = text.toLowerCase().match(WORD_RE)
  return new Set(m ?? [])
}

export function jaccard(a: string, b: string): number {
  const ta = new Set([...tokenize(a)].filter((w) => w.length > 2))
  const tb = new Set([...tokenize(b)].filter((w) => w.length > 2))
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const w of ta) if (tb.has(w)) inter++
  const union = ta.size + tb.size - inter
  return union === 0 ? 0 : inter / union
}

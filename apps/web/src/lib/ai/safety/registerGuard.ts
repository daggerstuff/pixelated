/**
 * Generation-time register guard.
 *
 * Two training releases (v20, v21) failed to remove the sympathy-opener
 * register from the model: the phrase frame survives thousands of times in the
 * corpus, so deleting a few hundred rows only teaches the model a sibling
 * phrase. This module enforces the register deterministically at the app
 * boundary instead, where the rule is exact and cheap.
 *
 * The phrase list mirrors CODDLING in
 * `ai/qa/validation/therapy_bench/generate_crisis_capability_v1.py`. Keep them
 * in sync: the rubric is what the release is scored against.
 */

const REGISTER_BANNED_PHRASES = [
  "that's a lot to carry",
  'a lot to carry',
  "that's a lot to hold",
  'that sounds really hard',
  'that sounds incredibly hard',
  "i'm so sorry",
  "i'm sorry that happened",
  "i'm sorry you're",
  'thank you for sharing',
  'thank you for trusting me',
  'thank you for telling me',
  'thank you for telling',
  "you're not alone",
  'you are not alone',
  "i'm glad you told me",
  "i'm proud of you",
  'i hear you',
  "i'm here for you",
  "you're so brave",
  "i'm deeply concerned",
  "i'm not going to pretend",
  "let's slow down",
  "let's take a breath",
  'take a deep breath',
  'it makes sense that you',
  'you deserve',
] as const

/**
 * A sentence that names a concrete escalation is never removed, even when it
 * also carries banned filler. Dropping "That's a lot to carry, call 911" would
 * trade a register defect for a safety defect.
 */
const ESCALATION_TERMS = [
  '911',
  '988',
  '112',
  '999',
  'emergency',
  'ambulance',
  'poison control',
  'hospital',
  'crisis line',
  'crisis centre',
  'crisis center',
  'urgent care',
  'emergency department',
] as const

const SENTENCE_BOUNDARY = /(?<=[.!?])\s+/

export interface RegisterGuardResult {
  /** Reply text with banned, non-escalating sentences removed. */
  content: string
  /** Sentences that were dropped, in original order. */
  removed: string[]
  /** True when `content` differs from the input. */
  altered: boolean
}

function normalize(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function containsAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((needle) => haystack.includes(needle))
}

/**
 * True when the text carries a banned register phrase.
 *
 * Exposed so callers can log or count register hits without rewriting text.
 */
export function hasBannedRegister(text: string): boolean {
  return containsAny(normalize(text), REGISTER_BANNED_PHRASES)
}

/**
 * Remove sentences that answer a disclosure with reassurance instead of with
 * the thing that was said.
 *
 * Fail-open by design: if every sentence would be dropped the original reply is
 * returned untouched. An empty assistant turn is worse than a soft one.
 */
export function sanitizeTherapyRegister(text: string): RegisterGuardResult {
  const trimmed = text.trim()
  if (trimmed === '') {
    return { content: text, removed: [], altered: false }
  }

  const sentences = trimmed.split(SENTENCE_BOUNDARY)
  const kept: string[] = []
  const removed: string[] = []

  for (const sentence of sentences) {
    const normalized = normalize(sentence)
    const banned = containsAny(normalized, REGISTER_BANNED_PHRASES)
    const escalates = containsAny(normalized, ESCALATION_TERMS)

    if (banned && !escalates) {
      removed.push(sentence)
      continue
    }
    kept.push(sentence)
  }

  if (removed.length === 0 || kept.length === 0) {
    return { content: text, removed: [], altered: false }
  }

  return {
    content: kept.join(' '),
    removed,
    altered: true,
  }
}

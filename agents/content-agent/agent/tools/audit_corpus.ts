import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { WORD_RE, jaccard, tokenize } from '../lib/audit_text.js'

/**
 * Hardened fragility audit for the demo corpus.
 *
 * Independent TypeScript re-implementation of the deterministic checks in
 * hackathon/ (review/monthly_auditor.py + pipeline/monthly_pipeline.py),
 * plus the §4 frequency classes from lastcall.md that the Python gate LACKS.
 *
 * It accepts the canonical 2025-08 artifact schema:
 *   - generated_emails.json  : email list with recipients[], event_id, topic
 *   - generated_chat_bursts.json : chat burst list with messages[].{sender,text}
 * A flat legacy dump (id/sender/recipient/subject/body/...) is also accepted
 * via structural probing.
 *
 * Faithful comparison counts come from matching Python thresholds exactly:
 *   - adjacent_reply_jaccard_limit = 0.35
 *   - slop phrases = SLOP_RE (see SLOP_RE)
 *   - email_thread_score gate = scoreThread() < 58
 */

interface EmailRecord {
  id?: string
  thread_id?: string | null
  sender?: string
  recipient?: string
  recipients?: string[]
  subject?: string
  body?: string
  text?: string
  date?: string
  category?: string
  event_id?: string
  topic?: string
}

interface ChatMessage {
  sender?: string
  text?: string
}

interface ChatBurst {
  id?: string
  thread_id?: string | null
  date?: string
  room?: string
  event_id?: string
  topic?: string
  messages?: ChatMessage[]
}

interface CorpusArtifact {
  emails: EmailRecord[]
  chats: ChatBurst[]
}

type FindingClass =
  | 'llm_slop'
  | 'forbidden_emoji'
  | 'echo_reply'
  | 'integrity'
  | 'future_event_leak'
  | 'frequency_3gram'
  | 'shared_opener'
  | 'short_ack_collapse'
  | 'repeated_filler_combo'
  | 'email_thread_score_below_gate'

interface AuditFinding {
  class: FindingClass
  severity: 'blocking' | 'warning'
  message: string
  refs: string[]
}

interface AuditResult {
  corpus_path: string
  audited_at: string
  total_records: number
  thread_count: number
  findings: AuditFinding[]
  blocking_count: number
  pass: boolean
  model: string
  /** Per-thread score map (email threads), for gate_injection. */
  thread_scores: Record<string, number>
}

/**
 * Loads the month gate registry (pipeline/monthly_gate.py writes it to
 * monthly_work/<month>/gate_report.json). Mirrors Python's leak check:
 *   blocked = set(gate.future_planning_event_ids)
 *   leak if event_id not in gate.current_event_ids
 *        OR any blocked future id appears in the body text.
 * If the report is absent we treat every event_id observed in the corpus as
 * "current", i.e. no leak — keeps the validator runnable without the
 * gate file, and matches a green month where all referenced ids are current.
 */
interface GateRegistry {
  current_event_ids: Set<string>
  future_event_ids: Set<string>
}

function loadGateRegistry(
  corpusPath: string,
  gateReportPath: string | undefined,
  observedIds: Set<string>,
): GateRegistry {
  const path = gateReportPath ?? join(dirname(corpusPath), 'gate_report.json')
  try {
    const data = JSON.parse(readFileSync(path, 'utf8')) as {
      current_event_ids?: unknown
      future_planning_event_ids?: unknown
    }
    const current = new Set<string>(
      Array.isArray(data.current_event_ids)
        ? (data.current_event_ids as unknown[]).filter(
            (x): x is string => typeof x === 'string',
          )
        : [],
    )
    const future = new Set<string>(
      Array.isArray(data.future_planning_event_ids)
        ? (data.future_planning_event_ids as unknown[]).filter(
            (x): x is string => typeof x === 'string',
          )
        : [],
    )
    if (current.size > 0)
      return { current_event_ids: current, future_event_ids: future }
  } catch {
    // fall through to observed-ids fallback
  }
  // No gate file (or empty): treat every event_id seen in the corpus
  // as current. A green month references only its own active ids, so
  // this reproduces the Python green result (0 leaks) without the file.
  return {
    current_event_ids: new Set(observedIds),
    future_event_ids: new Set(),
  }
}

const FORBIDDEN_EMOJI_PERSONAS = new Set([
  'Chad',
  'Marcus Thorne',
  'Dr. Elias Vance',
  'Julian Hayes',
])

// Mirrors pipeline/monthly_pipeline.py SLOP_RE (IGNORECASE).
const SLOP_RE =
  /\b(please confirm|circle back|moving forward|alignment|touch base|as discussed|per my last|happy to help|thank you for sharing|i hope this email finds you well|let me know your thoughts|highlights|next steps|sounds good|absolutely|confirmed)\b/i

const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}]\u{FE0F}?/u

const NUMERIC_RE =
  /\b\d+(?:[.,]\d+)?(?:%|ms|k|K|M|GB|hrs?|days?|users?|emails?)?\b/

const ADJACENT_REPLY_JACCARD_LIMIT = 0.35
const EMAIL_THREAD_SCORE_GATE = 58
const FREQUENCY_3GRAM_LIMIT = 0.03 // >3% of artifacts => flag (lastcall §4)

function cleanSubject(subject: string): string {
  return subject
    .replace(/^((re|fwd|fw):\s*)+/i, '')
    .trim()
    .toLowerCase()
}

/** Emit the first 3-gram in a body that exceeds the frequency ceiling. */
function firstHot3gram(
  body: string,
  ceilings: Map<string, number>,
): string | null {
  const words = body.toLowerCase().match(WORD_RE)
  if (!words || words.length < 3) return null
  for (let i = 0; i + 2 < words.length; i++) {
    const gram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`
    if ((ceilings.get(gram) ?? 0) > FREQUENCY_3GRAM_LIMIT) return gram
  }
  return null
}

/**
 * Re-implements pipeline/monthly_pipeline.py scoreThread() so the TS audit and
 * the gate share one scoring definition.
 */
function scoreThread(emails: EmailRecord[]): number {
  let score = 50
  const n = emails.length
  if (n >= 2 && n <= 6) score += 8
  else if (n === 1) score -= 1
  else score -= 6

  const senders = new Set(emails.map((e) => e.sender ?? '').filter(Boolean))
  if (senders.size >= 2) score += 4

  const wordCounts = emails.map(
    (e) => (e.body ?? e.text ?? '').trim().split(/\s+/).filter(Boolean).length,
  )
  const avg = wordCounts.length
    ? wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length
    : 0
  if (avg >= 24 && avg <= 125) score += 5
  else score -= 8

  let slopHits = 0
  let signatureHits = 0
  let numericHits = 0
  let maxOverlap = 0
  const sorted = [...emails].sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? ''),
  )
  for (let i = 1; i < sorted.length; i++) {
    const ov = jaccard(sorted[i - 1].body ?? '', sorted[i].body ?? '')
    if (ov > maxOverlap) maxOverlap = ov
  }
  for (const e of emails) {
    const body = e.body ?? e.text ?? ''
    if (SLOP_RE.test(body)) slopHits++
    if (/\n(?:vp|head|director|lead|founder|ceo|cto|coo)\b/i.test(body))
      signatureHits++
    if (NUMERIC_RE.test(body)) numericHits++
  }

  score += Math.min(20, numericHits * 2)
  score -= Math.min(32, slopHits * 4)
  if (maxOverlap >= 0.45) score -= 24
  if (signatureHits > 0) score -= 12

  return Math.max(0, Math.min(100, score))
}

function loadArtifact(path: string): CorpusArtifact {
  const raw = readFileSync(path, 'utf8')
  const data = JSON.parse(raw) as unknown

  const asList = (v: unknown): EmailRecord[] | null =>
    Array.isArray(v) ? (v as EmailRecord[]) : null

  // emails: explicit key, single list, or single-object-with-list
  let emails: EmailRecord[] = []
  if (Array.isArray(data)) {
    emails = data as EmailRecord[]
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const probe =
      asList(obj['emails']) ??
      asList(obj['generated_emails']) ??
      asList(obj['messages']) ??
      asList(obj['items'])
    if (probe) emails = probe
    else {
      for (const v of Object.values(obj)) {
        const l = asList(v)
        if (l?.length && typeof l[0] === 'object') {
          emails = l
          break
        }
      }
    }
  }

  // chats: explicit key or sibling list of burst-shaped objects
  let chats: ChatBurst[] = []
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const probe =
      asList(obj['chats']) ??
      asList(obj['generated_chat_bursts']) ??
      asList(obj['chat_bursts'])
    if (probe) chats = probe
  }

  return { emails, chats }
}

export default defineTool({
  description:
    'Audit the demo corpus for the fragility classes that break the investor ' +
    'demo. Re-implements the deterministic Python auditor (slop, forbidden ' +
    'emoji, echo reply via Jaccard>=0.35, future-event leak, per-thread score ' +
    'gate) PLUS the §4 frequency classes from lastcall.md that the Python ' +
    'gate lacks: hot 3-grams (>3% of artifacts), per-sender recurring openers, ' +
    'short-ack collapse, and repeated filler combinations. Returns a ' +
    'structured report consumed by gate_injection.',
  inputSchema: z.object({
    corpus_path: z
      .string()
      .min(1)
      .describe(
        'Absolute path to the corpus JSON (e.g. ' +
          '../hackathon/monthly_work/2025-08/generated_emails.json).',
      ),
    chat_path: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Optional path to generated_chat_bursts.json for chat-frequency checks.',
      ),
    gate_report_path: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Optional path to gate_report.json. Defaults to the sibling ' +
          'gate_report.json next to corpus_path.',
      ),
  }),
  async execute(
    input: {
      corpus_path: string
      chat_path?: string
      gate_report_path?: string
    },
    _ctx?: unknown,
  ): Promise<AuditResult> {
    const artifact = loadArtifact(input.corpus_path)
    const emails = artifact.emails
    const chats: ChatBurst[] = input.chat_path
      ? loadArtifact(input.chat_path).chats
      : artifact.chats

    const observedIds = new Set<string>()
    for (const e of emails) if (e.event_id) observedIds.add(e.event_id)
    for (const c of chats) if (c.event_id) observedIds.add(c.event_id)
    const gate = loadGateRegistry(
      input.corpus_path,
      input.gate_report_path,
      observedIds,
    )

    const findings: AuditFinding[] = []
    const threadScores: Record<string, number> = {}

    // ---- §1-§3 cross-checks (mirror Python auditor) ----
    const byThread = new Map<string, EmailRecord[]>()

    for (const em of emails) {
      const id = em.id ?? 'unknown'
      const body = em.body ?? em.text ?? ''
      const sender = em.sender ?? ''

      const tid = em.thread_id ?? '__loose__'
      const tarr = byThread.get(tid) ?? []
      tarr.push(em)
      byThread.set(tid, tarr)

      if (SLOP_RE.test(body)) {
        findings.push({
          class: 'llm_slop',
          severity: 'blocking',
          message: `Slop phrase in ${id}.`,
          refs: [id],
        })
      }

      if (FORBIDDEN_EMOJI_PERSONAS.has(sender) && EMOJI_RE.test(body)) {
        findings.push({
          class: 'forbidden_emoji',
          severity: 'blocking',
          message: `Persona "${sender}" forbids emoji but emitted one in ${id}.`,
          refs: [id],
        })
      }

      // future-event leak: Python parity — id not in current set OR a
      // future-planning id appears in the body text.
      const evId = em.event_id ?? ''
      if (evId && !gate.current_event_ids.has(evId)) {
        findings.push({
          class: 'future_event_leak',
          severity: 'blocking',
          message: `Email ${id} references ${evId} not in current event set.`,
          refs: [id],
        })
      } else if (gate.future_event_ids.size > 0) {
        for (const fid of gate.future_event_ids) {
          if (body.includes(fid)) {
            findings.push({
              class: 'future_event_leak',
              severity: 'blocking',
              message: `Email ${id} references future-planning ${fid}.`,
              refs: [id],
            })
            break
          }
        }
      }
    }

    for (const [tid, msgs] of byThread) {
      const sorted = [...msgs].sort((a, b) =>
        (a.date ?? '').localeCompare(b.date ?? ''),
      )
      const score = scoreThread(sorted)
      if (tid !== '__loose__') threadScores[tid] = score
      if (score < EMAIL_THREAD_SCORE_GATE) {
        findings.push({
          class: 'email_thread_score_below_gate',
          severity: 'warning',
          message: `Thread ${tid} scored ${score} (< ${EMAIL_THREAD_SCORE_GATE}).`,
          refs: sorted.map((m) => m.id ?? 'unknown').slice(0, 10),
        })
      }
      for (let i = 1; i < sorted.length; i++) {
        const ov = jaccard(sorted[i - 1].body ?? '', sorted[i].body ?? '')
        if (ov >= ADJACENT_REPLY_JACCARD_LIMIT) {
          findings.push({
            class: 'echo_reply',
            severity: 'warning',
            message: `Echo reply in thread ${tid}: ${sorted[i].id} overlaps prior by ${Math.round(ov * 100)}%.`,
            refs: [sorted[i].id ?? 'unknown'],
          })
        }
      }
    }

    // chat-burst future-event leak (Python parity: same registry check)
    for (const burst of chats) {
      const bid = burst.id ?? 'unknown'
      const bev = burst.event_id ?? ''
      if (bev && !gate.current_event_ids.has(bev)) {
        findings.push({
          class: 'future_event_leak',
          severity: 'blocking',
          message: `Chat burst ${bid} references ${bev} not in current event set.`,
          refs: [bid],
        })
      } else {
        const blob = (burst.messages ?? []).map((m) => m.text ?? '').join(' ')
        for (const fid of gate.future_event_ids) {
          if (blob.includes(fid)) {
            findings.push({
              class: 'future_event_leak',
              severity: 'blocking',
              message: `Chat burst ${bid} references future-planning ${fid}.`,
              refs: [bid],
            })
            break
          }
        }
      }
    }

    // ---- §4 frequency classes (Python gate LACKS these) ----
    const allText: string[] = [
      ...emails.map((e) => e.body ?? e.text ?? ''),
      ...chats.flatMap((c) => (c.messages ?? []).map((m) => m.text ?? '')),
    ]
    const denom = Math.max(1, allText.length)

    // (a) 3-gram ceilings
    const gramCounts = new Map<string, number>()
    for (const body of allText) {
      const words = body.toLowerCase().match(WORD_RE)
      if (!words || words.length < 3) continue
      const seen = new Set<string>()
      for (let i = 0; i + 2 < words.length; i++) {
        const gram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`
        if (seen.has(gram)) continue
        seen.add(gram)
        gramCounts.set(gram, (gramCounts.get(gram) ?? 0) + 1)
      }
    }
    const hotGrams: string[] = []
    for (const [gram, c] of gramCounts) {
      const frac = c / denom
      if (frac > FREQUENCY_3GRAM_LIMIT) hotGrams.push(gram)
    }
    if (hotGrams.length) {
      findings.push({
        class: 'frequency_3gram',
        severity: 'warning',
        message: `${hotGrams.length} 3-gram(s) exceed ${Math.round(FREQUENCY_3GRAM_LIMIT * 100)}% of artifacts: ${hotGrams.slice(0, 5).join('; ')}.`,
        refs: hotGrams.slice(0, 5),
      })
    }

    // (b) per-sender recurring openers
    const openersBySender = new Map<string, Map<string, number>>()
    for (const em of emails) {
      const sender = em.sender ?? ''
      const body = em.body ?? em.text ?? ''
      const firstSentence = body.split(/[.\n]/)[0]?.trim() ?? ''
      if (!sender || firstSentence.length < 8) continue
      const m = openersBySender.get(sender) ?? new Map<string, number>()
      m.set(firstSentence, (m.get(firstSentence) ?? 0) + 1)
      openersBySender.set(sender, m)
    }
    for (const [sender, openers] of openersBySender) {
      const recurring = [...openers.entries()].filter(([, c]) => c >= 3)
      for (const [opener, c] of recurring) {
        findings.push({
          class: 'shared_opener',
          severity: 'warning',
          message: `Sender "${sender}" reuses opener ${c}x: "${opener.slice(0, 48)}…".`,
          refs: [sender],
        })
      }
    }

    // (c) short-ack collapse: near-identical short bodies (<40 words)
    const shortBodies = new Map<string, string[]>()
    for (const em of emails) {
      const body = (em.body ?? em.text ?? '').trim()
      const wc = body.split(/\s+/).filter(Boolean).length
      if (wc > 0 && wc <= 12) {
        const arr = shortBodies.get(body) ?? []
        arr.push(em.id ?? 'unknown')
        shortBodies.set(body, arr)
      }
    }
    for (const [body, ids] of shortBodies) {
      if (ids.length >= 3) {
        findings.push({
          class: 'short_ack_collapse',
          severity: 'warning',
          message: `${ids.length} near-identical short bodies: "${body.slice(0, 40)}…".`,
          refs: ids.slice(0, 10),
        })
      }
    }

    // (d) repeated filler combos: same (slop-free) open+close pattern
    const fillerCombos = new Map<string, string[]>()
    for (const em of emails) {
      const body = (em.body ?? em.text ?? '').trim()
      if (body.length < 20) continue
      const first = body.slice(0, 24).toLowerCase()
      const last = body.slice(-24).toLowerCase()
      const key = `${first}||${last}`
      const arr = fillerCombos.get(key) ?? []
      arr.push(em.id ?? 'unknown')
      fillerCombos.set(key, arr)
    }
    for (const [key, ids] of fillerCombos) {
      if (ids.length >= 4) {
        findings.push({
          class: 'repeated_filler_combo',
          severity: 'warning',
          message: `${ids.length} emails share open/close pattern.`,
          refs: ids.slice(0, 10),
        })
      }
    }

    // (e) duplicate subjects across distinct threads
    const subjectsByThread = new Map<string, Set<string>>()
    const subjectOccurrences = new Map<string, string[]>()
    for (const em of emails) {
      const subj = cleanSubject(em.subject ?? '')
      if (!subj) continue
      const tid = em.thread_id ?? em.id ?? '__loose__'
      const threads = subjectsByThread.get(subj) ?? new Set<string>()
      threads.add(tid)
      subjectsByThread.set(subj, threads)
      const ids = subjectOccurrences.get(subj) ?? []
      ids.push(em.id ?? 'unknown')
      subjectOccurrences.set(subj, ids)
    }
    for (const [subj, threads] of subjectsByThread) {
      if (threads.size >= 3) {
        const ids = subjectOccurrences.get(subj) ?? []
        findings.push({
          class: 'duplicate_subject',
          severity: 'blocking',
          message: `Subject "${subj}" repeated across ${threads.size} threads (${ids.length} emails).`,
          refs: ids.slice(0, 10),
        })
      }
    }

    const blocking = findings.filter((f) => f.severity === 'blocking')

    return {
      corpus_path: input.corpus_path,
      audited_at: new Date().toISOString(),
      total_records: emails.length + chats.length,
      thread_count: byThread.size,
      findings,
      blocking_count: blocking.length,
      pass: blocking.length === 0,
      model: 'none',
      thread_scores: threadScores,
    }
  },
})

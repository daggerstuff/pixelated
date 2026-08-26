/**
 * PIX-511: PII redaction gate for therapeutic memory ingestion.
 *
 * Mirrors ai/memory/gates/pii_redactor.py conservative behavior: redact only
 * high-confidence identifiers while preserving dates, addresses, and therapy
 * context that may be clinically meaningful.
 */

export interface PiiRedactionResult {
  scrubbedText: string
  piiTypesFound: string[]
  piiCounts: Record<string, number>
  confidence: number
  wasRedacted: boolean
}

export interface PiiGateEvaluation {
  gate: string
  decision: 'pass' | 'block' | 'escalate'
  reason: string
  confidence: number
}

interface PiiMatch {
  piiType: PiiType
  matchedText: string
  start: number
  end: number
  confidence: number
}

type PiiType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'dob'
  | 'medical_record_number'
  | 'ip_address'
  | 'credit_card'

const GATE_NAME = 'gate0_pii_redaction'

const CONSERVATIVE_PII_TYPES = new Set<PiiType>([
  'email',
  'phone',
  'ssn',
  'medical_record_number',
  'ip_address',
  'credit_card',
])

const PHI_TYPES = new Set<PiiType>(['ssn', 'medical_record_number'])

const THERAPY_ALLOWLIST = new Set([
  'therapist',
  'session',
  'client',
  'patient',
  'treatment',
  'diagnosis',
  'medication',
  'anxiety',
  'depression',
  'trauma',
  'coping',
  'boundaries',
  'trigger',
  'healing',
])

const PII_PATTERNS: Record<PiiType, RegExp[]> = {
  email: [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g],
  phone: [
    /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    /\b\+\d{1,3}[-.\s]\d{1,4}[-.\s]\d{3,4}[-.\s]\d{3,4}\b/g,
  ],
  ssn: [/\b\d{3}-?\d{2}-?\d{4}\b/g],
  dob: [
    /\b(?:DOB|D\.O\.B\.|date of birth)\s*:?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi,
    /\b(?:DOB|D\.O\.B\.|date of birth)\s*:?\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi,
  ],
  medical_record_number: [
    /\bMRN\s*:?\s*[A-Z0-9-]{5,}\b/gi,
    /\bMedical\s+Record\s*(?:Number|No\.?|#)?\s*:?\s*[A-Z0-9-]{5,}\b/gi,
  ],
  ip_address: [
    /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g,
    /\b(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b/gi,
  ],
  credit_card: [
    /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
    /\b\d{4}[\s-]?\d{6}[\s-]?\d{5}\b/g,
  ],
}

export class PiiRedactor {
  private readonly driftCounts: Record<string, number> = {}
  private readonly driftTypes = new Set<string>()

  redact(content: string): PiiRedactionResult {
    if (!content) {
      return {
        scrubbedText: content,
        piiTypesFound: [],
        piiCounts: {},
        confidence: 0,
        wasRedacted: false,
      }
    }

    const matches = this.detectConservativeMatches(content)
    const { scrubbedText, piiCounts } = this.applyMatches(content, matches)
    const confidence = Math.max(0, ...matches.map((match) => match.confidence))
    const piiTypesFound = Object.keys(piiCounts)

    this.recordDrift(piiCounts)

    return {
      scrubbedText,
      piiTypesFound,
      piiCounts,
      confidence,
      wasRedacted: piiTypesFound.length > 0,
    }
  }

  evaluate(content: string): PiiGateEvaluation {
    const result = this.redact(content)
    const totalPiiCount = Object.values(result.piiCounts).reduce(
      (total, count) => total + count,
      0,
    )

    if (this.hasHighConfidencePhi(result)) {
      return {
        gate: GATE_NAME,
        decision: 'block',
        reason: 'High-confidence PHI detected in memory content',
        confidence: result.confidence,
      }
    }

    if (totalPiiCount > 3) {
      return {
        gate: GATE_NAME,
        decision: 'escalate',
        reason: 'Multiple PII instances redacted; human review recommended',
        confidence: result.confidence,
      }
    }

    return {
      gate: GATE_NAME,
      decision: 'pass',
      reason:
        totalPiiCount === 0 ? 'No PII detected' : 'PII detected and scrubbed',
      confidence: result.confidence,
    }
  }

  getPiiDriftReport(): Record<string, unknown> {
    return {
      typesFound: [...this.driftTypes].sort(),
      counts: Object.fromEntries(
        Object.entries(this.driftCounts).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
      timestamp: new Date().toISOString(),
    }
  }

  private detectConservativeMatches(content: string): PiiMatch[] {
    const matches: PiiMatch[] = []

    for (const [piiType, patterns] of Object.entries(PII_PATTERNS) as [
      PiiType,
      RegExp[],
    ][]) {
      if (!CONSERVATIVE_PII_TYPES.has(piiType)) {
        continue
      }

      for (const pattern of patterns) {
        pattern.lastIndex = 0

        for (const match of content.matchAll(pattern)) {
          const matchedText = match[0]
          const start = match.index ?? 0

          if (this.isAllowlisted(matchedText)) {
            continue
          }

          matches.push({
            piiType,
            matchedText,
            start,
            end: start + matchedText.length,
            confidence: this.confidenceFor(piiType),
          })
        }
      }
    }

    return this.filterOverlaps(matches)
  }

  private applyMatches(
    content: string,
    matches: PiiMatch[],
  ): { scrubbedText: string; piiCounts: Record<string, number> } {
    let scrubbedText = content
    const piiCounts: Record<string, number> = {}

    for (const match of [...matches].reverse()) {
      const redaction = this.redactionFor(match.piiType)
      scrubbedText = `${scrubbedText.slice(0, match.start)}${redaction}${scrubbedText.slice(match.end)}`
      piiCounts[match.piiType] = (piiCounts[match.piiType] ?? 0) + 1
    }

    return { scrubbedText, piiCounts }
  }

  private recordDrift(piiCounts: Record<string, number>): void {
    for (const [piiType, count] of Object.entries(piiCounts)) {
      this.driftTypes.add(piiType)
      this.driftCounts[piiType] = (this.driftCounts[piiType] ?? 0) + count
    }
  }

  private hasHighConfidencePhi(result: PiiRedactionResult): boolean {
    return (
      result.confidence > 0.9 &&
      Object.keys(result.piiCounts).some((piiType) =>
        PHI_TYPES.has(piiType as PiiType),
      )
    )
  }

  private confidenceFor(piiType: PiiType): number {
    if (PHI_TYPES.has(piiType)) {
      return 0.98
    }

    if (CONSERVATIVE_PII_TYPES.has(piiType)) {
      return 0.95
    }

    return 0
  }

  private filterOverlaps(matches: PiiMatch[]): PiiMatch[] {
    const filteredMatches: PiiMatch[] = []
    let previousEnd = 0

    for (const match of [...matches].sort(
      (left, right) => left.start - right.start,
    )) {
      if (match.start >= previousEnd) {
        filteredMatches.push(match)
        previousEnd = match.end
        continue
      }

      const previous = filteredMatches.at(-1)
      if (!previous) {
        continue
      }

      if (match.end - match.start > previous.end - previous.start) {
        filteredMatches[filteredMatches.length - 1] = match
        previousEnd = match.end
      }
    }

    return filteredMatches
  }

  private isAllowlisted(text: string): boolean {
    return THERAPY_ALLOWLIST.has(text.trim().toLowerCase())
  }

  private redactionFor(piiType: PiiType): string {
    return `[${piiType.toUpperCase()}]`
  }
}

export const piiRedactor = new PiiRedactor()

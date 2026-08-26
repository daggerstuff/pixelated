import { ConsentGate, consentGate } from '../gates/consent-gate'
import { CrisisDetector, crisisDetector } from '../gates/crisis-detector'
import { PiiRedactor, piiRedactor } from '../gates/pii-redactor'
import { TraumaFilter, traumaFilter } from '../gates/trauma-filter'

// ─── PII Redactor ────────────────────────────────────────────────────────────

describe('PiiRedactor', () => {
  let redactor: PiiRedactor

  beforeEach(() => {
    redactor = new PiiRedactor()
  })

  it('passes clean content through unchanged', () => {
    const text = 'I feel anxious about my presentation tomorrow.'
    const result = redactor.redact(text)
    expect(result.wasRedacted).toBe(false)
    expect(result.scrubbedText).toBe(text)
    expect(result.piiTypesFound).toHaveLength(0)
  })

  it('redacts email addresses', () => {
    const text = 'My email is john.doe@example.com and I need help.'
    const result = redactor.redact(text)
    expect(result.wasRedacted).toBe(true)
    expect(result.piiTypesFound).toContain('email')
    expect(result.scrubbedText).toContain('[EMAIL]')
  })

  it('redacts phone numbers', () => {
    const text = 'Call me at 555-123-4567 please.'
    const result = redactor.redact(text)
    expect(result.wasRedacted).toBe(true)
    expect(result.piiTypesFound).toContain('phone')
    expect(result.scrubbedText).toContain('[PHONE]')
  })

  it('redacts SSNs', () => {
    const text = 'My SSN is 123-45-6789.'
    const result = redactor.redact(text)
    expect(result.wasRedacted).toBe(true)
    expect(result.piiTypesFound).toContain('ssn')
    expect(result.scrubbedText).toContain('[SSN]')
  })

  it('detects multiple PII types', () => {
    const text = 'Contact john@test.com or 555-123-4567.'
    const result = redactor.redact(text)
    expect(result.wasRedacted).toBe(true)
    expect(result.piiTypesFound.length).toBeGreaterThanOrEqual(2)
  })

  it('evaluate returns pass for clean content', () => {
    const text = 'I had a good therapy session today.'
    const evaluation = redactor.evaluate(text)
    expect(evaluation.decision).toBe('pass')
    expect(evaluation.gate).toBe('gate0_pii_redaction')
  })

  it('evaluate returns escalate for multiple PII', () => {
    const text =
      'Email: a@b.com, phone: 555-111-2222, email: c@d.com, phone: 555-333-4444'
    const evaluation = redactor.evaluate(text)
    expect(evaluation.decision).toBe('escalate')
  })

  it('tracks drift across calls', () => {
    redactor.redact('My email is a@b.com')
    const report = redactor.getPiiDriftReport()
    expect(report['typesFound']).toContain('email')
  })

  it('singleton export works', () => {
    expect(piiRedactor).toBeInstanceOf(PiiRedactor)
  })
})

// ─── Crisis Detector ─────────────────────────────────────────────────────────

describe('CrisisDetector', () => {
  let detector: CrisisDetector

  beforeEach(() => {
    detector = new CrisisDetector()
  })

  it('passes clean content', () => {
    const text = 'I had a productive session today.'
    const result = detector.detect(text)
    expect(result.tier).toBe('none')
    expect(result.crisisFlag).toBe(false)
  })

  it('detects self-harm language', () => {
    const text = 'I want to hurt myself.'
    const result = detector.detect(text)
    expect(result.tier).not.toBe('none')
    expect(result.crisisFlag).toBe(true)
  })

  it('detects suicide language as high/critical', () => {
    const text = 'I want to kill myself.'
    const result = detector.detect(text)
    expect(['high', 'critical']).toContain(result.tier)
  })

  it('evaluate returns pass for clean content', () => {
    const text = 'Everything is going well.'
    const evaluation = detector.evaluate(text)
    expect(evaluation.decision).toBe('pass')
  })

  it('evaluate returns escalate for crisis content', () => {
    const text = 'I want to kill myself right now.'
    const evaluation = detector.evaluate(text)
    expect(['escalate', 'block']).toContain(evaluation.decision)
  })

  it('singleton export works', () => {
    expect(crisisDetector).toBeInstanceOf(CrisisDetector)
  })
})

// ─── Trauma Filter ───────────────────────────────────────────────────────────

describe('TraumaFilter', () => {
  let filter: TraumaFilter

  beforeEach(() => {
    filter = new TraumaFilter()
  })

  it('passes clean content', () => {
    const text = 'I discussed my weekend plans with my friend.'
    const result = filter.filter(text)
    expect(result.severity).toBe('none')
    expect(result.indicators).toHaveLength(0)
  })

  it('matches trauma lexicon', () => {
    const text = 'I was abused and felt completely helpless.'
    const result = filter.filter(text)
    expect(result.indicators.length).toBeGreaterThan(0)
    expect(result.severity).not.toBe('none')
  })

  it('registers user-specific triggers', () => {
    const traumaFilter = new TraumaFilter()
    traumaFilter.registerUserTriggers('user-1', ['thunderstorms'])
    const result = traumaFilter.filter(
      'The thunderstorms triggered my anxiety.',
      'user-1',
    )
    expect(result.triggered).toBe(true)
    expect(result.userSpecificMatches.length).toBeGreaterThan(0)
  })

  it('evaluate returns pass for clean content', () => {
    const text = 'I had a pleasant conversation.'
    const evaluation = filter.evaluate(text)
    expect(evaluation.decision).toBe('pass')
  })

  it('singleton export works', () => {
    expect(traumaFilter).toBeInstanceOf(TraumaFilter)
  })
})

// ─── Consent Gate ────────────────────────────────────────────────────────────

describe('ConsentGate', () => {
  let gate: ConsentGate

  beforeEach(() => {
    gate = new ConsentGate()
  })

  it('grants and checks consent', () => {
    gate.grantConsent('user-1', 'open')
    const result = gate.checkConsent('user-1')
    expect(result.allowed).toBe(true)
  })

  it('grants restricted consent', () => {
    gate.grantConsent('user-2', 'restricted')
    const result = gate.checkConsent('user-2')
    expect(result.allowed).toBe(true)
    expect(result.consentTier).toBe('restricted')
  })

  it('revokes consent', () => {
    gate.grantConsent('user-3', 'open')
    gate.revokeConsent('user-3')
    const result = gate.checkConsent('user-3')
    expect(result.allowed).toBe(false)
  })

  it('maintains audit log', () => {
    gate.grantConsent('user-4', 'open')
    const audit = gate.getAuditLog('user-4')
    expect(audit.length).toBeGreaterThan(0)
  })

  it('evaluate returns pass for allowed consent', () => {
    gate.grantConsent('user-5', 'open')
    const evaluation = gate.evaluate('user-5')
    expect(evaluation.decision).toBe('pass')
  })

  it('evaluate returns block for revoked consent', () => {
    gate.grantConsent('user-6', 'open')
    gate.revokeConsent('user-6')
    const evaluation = gate.evaluate('user-6')
    expect(evaluation.decision).toBe('block')
  })

  it('singleton export works', () => {
    expect(consentGate).toBeInstanceOf(ConsentGate)
  })
})

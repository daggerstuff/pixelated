import {
  detectAndRedactPHI,
  detectAndRedactPHIAsync,
  PresidioPHIDetector,
  PHIEntityType,
} from '../phiDetection'

describe('detectAndRedactPHI', () => {
  it('redacts emails', () => {
    expect(detectAndRedactPHI('Contact: alice@example.com')).toBe(
      'Contact: [EMAIL]',
    )
  })

  it('redacts phone numbers', () => {
    expect(detectAndRedactPHI('Call me at 555-123-4567')).toBe(
      'Call me at [PHONE]',
    )
    expect(detectAndRedactPHI('My number is (555) 123-4567')).toBe(
      'My number is [PHONE]',
    )
    expect(detectAndRedactPHI('Intl: +1 555-123-4567')).toBe('Intl: [PHONE]')
  })

  it('redacts SSNs', () => {
    expect(detectAndRedactPHI('SSN: 123-45-6789')).toBe('SSN: [ID]')
    expect(detectAndRedactPHI('ID: 123456789')).toBe('ID: [ID]')
  })

  it('redacts full names', () => {
    expect(detectAndRedactPHI('Patient John Doe')).toBe('Patient [NAME]')
    expect(detectAndRedactPHI('Dr. Jane Smith')).toBe('Dr. [NAME]')
  })

  it('redacts mixed PHI/PII', () => {
    const input =
      'John Doe, SSN: 123-45-6789, email: john@example.com, phone: 555-123-4567'
    const expected = '[NAME], SSN: [ID], email: [EMAIL], phone: [PHONE]'
    expect(detectAndRedactPHI(input)).toBe(expected)
  })

  it('handles text with no PHI/PII', () => {
    expect(detectAndRedactPHI('No sensitive info here.')).toBe(
      'No sensitive info here.',
    )
  })
})

describe('detectAndRedactPHI edge cases (real regex implementation)', () => {
  it('redacts multiple email addresses in one pass', () => {
    const input = 'a@x.com and b@y.org and c@z.net'
    expect(detectAndRedactPHI(input)).toBe('[EMAIL] and [EMAIL] and [EMAIL]')
  })

  it('redacts emails regardless of case', () => {
    expect(detectAndRedactPHI('CONTACT ALICE@EXAMPLE.COM')).toBe(
      'CONTACT [EMAIL]',
    )
  })

  it('does not redact strings without a valid TLD (no false positives)', () => {
    expect(detectAndRedactPHI('notanemail@localhost')).toBe(
      'notanemail@localhost',
    )
  })

  it('redacts SSNs without dashes', () => {
    expect(detectAndRedactPHI('ID: 123456789')).toBe('ID: [ID]')
  })

  it('redacts phone numbers with extensions', () => {
    expect(detectAndRedactPHI('Call 555-123-4567 ext 890')).toBe('Call [PHONE]')
  })

  it('redacts multi-token full names but skips "Patient"', () => {
    expect(detectAndRedactPHI('Patient Jane Mary Smith')).toBe('Patient [NAME]')
  })

  it('leaves benign text unchanged', () => {
    expect(detectAndRedactPHI('The quick brown fox.')).toBe(
      'The quick brown fox.',
    )
  })

  it('handles empty input without throwing', () => {
    expect(detectAndRedactPHI('')).toBe('')
  })

  it('redacts a mix of PHI entities and strips the raw values', () => {
    const input =
      'Jane Doe reached at jane@clinic.org, phone 555.987.6543, SSN 987-65-4321'
    const result = detectAndRedactPHI(input)
    expect(result).toContain('[NAME]')
    expect(result).toContain('[EMAIL]')
    expect(result).toContain('[PHONE]')
    expect(result).toContain('[ID]')
    expect(result).not.toContain('jane@clinic.org')
    expect(result).not.toContain('987-65-4321')
  })

  it('preserves surrounding punctuation and delimiters', () => {
    const input = 'Name: John Doe; SSN: 123-45-6789.'
    expect(detectAndRedactPHI(input)).toBe('Name: [NAME]; SSN: [ID].')
  })

  it('is deterministic for the same input', () => {
    const input = 'Contact bob@test.com or 555-111-2222'
    expect(detectAndRedactPHI(input)).toBe(detectAndRedactPHI(input))
  })
})

describe('PresidioPHIDetector internals and detectPHI paths', () => {
  const detector = PresidioPHIDetector.getInstance()

  it('getInstance returns a shared singleton', () => {
    expect(PresidioPHIDetector.getInstance()).toBe(
      PresidioPHIDetector.getInstance(),
    )
  })

  it('detectPHI("") returns no PHI without initializing', async () => {
    const result = await detector.detectPHI('')
    expect(result.hasDetectedPHI).toBe(false)
    expect(result.entities).toEqual([])
    expect(result.redactedText).toBeUndefined()
  })

  it('detectPHI (initialized=true, Analyzer returns []) detects nothing', async () => {
    await detector.initialize()
    const result = await detector.detectPHI(
      'John Doe email john@x.com phone 555-123-4567',
    )
    expect(result.hasDetectedPHI).toBe(false)
    expect(result.entities).toEqual([])
    expect(result.redactedText).toBeUndefined()
  })

  it('detectPHI (initialized=false fallback) redacts via regex when Presidio is unavailable', async () => {
    const fresh = new PresidioPHIDetector()
    // Force Presidio initialization to fail so detectPHI falls back to regex.
    fresh.initialize = async () => {
      throw new Error('presidio unavailable')
    }

    const result = await fresh.detectPHI('Contact john@x.com')
    expect(result.hasDetectedPHI).toBe(true)
    expect(result.entities.length).toBeGreaterThan(0)
    expect(result.redactedText).toContain('[EMAIL]')
  })

  it('getPlaceholderForEntityType maps known types and defaults', () => {
    expect(
      detector['getPlaceholderForEntityType'](PHIEntityType.EMAIL_ADDRESS),
    ).toBe('[EMAIL]')
    expect(
      detector['getPlaceholderForEntityType'](PHIEntityType.PHONE_NUMBER),
    ).toBe('[PHONE]')
    expect(detector['getPlaceholderForEntityType'](PHIEntityType.US_SSN)).toBe(
      '[ID]',
    )
    expect(detector['getPlaceholderForEntityType'](PHIEntityType.PERSON)).toBe(
      '[NAME]',
    )
    expect(
      detector['getPlaceholderForEntityType'](
        'UNKNOWN' as unknown as PHIEntityType,
      ),
    ).toBe('[REDACTED]')
  })

  it('getPlaceholderForEntityType throws for unimplemented types', () => {
    expect(() =>
      detector['getPlaceholderForEntityType'](PHIEntityType.ADDRESS),
    ).toThrow(/Not implemented/)
    expect(() =>
      detector['getPlaceholderForEntityType'](PHIEntityType.LOCATION),
    ).toThrow(/Not implemented/)
  })

  it('fallbackDetection finds multiple entity types', () => {
    const entities = detector['fallbackDetection'](
      'John Doe email john@x.com phone 555-123-4567 SSN 123-45-6789',
    )
    const types = entities.map((e) => e.type)
    expect(types).toContain(PHIEntityType.PERSON)
    expect(types).toContain(PHIEntityType.EMAIL_ADDRESS)
    expect(types).toContain(PHIEntityType.PHONE_NUMBER)
    expect(types).toContain(PHIEntityType.US_SSN)
  })

  it('fallbackRedaction replaces entities by position', () => {
    const text = 'User a@b.com called'
    const entities = [
      {
        type: PHIEntityType.EMAIL_ADDRESS,
        start: 5,
        end: 12,
        score: 0.8,
        value: 'a@b.com',
      },
    ]
    expect(detector['fallbackRedaction'](text, entities)).toBe(
      'User [EMAIL] called',
    )
  })

  it('detectAndRedactPHIAsync resolves to a string', async () => {
    await expect(detectAndRedactPHIAsync('hello world')).resolves.toBe(
      'hello world',
    )
  })

  describe('getPlaceholderForEntityType remaining unimplemented entity types', () => {
    const detector = PresidioPHIDetector.getInstance()
    const unimplemented: PHIEntityType[] = [
      PHIEntityType.MEDICAL_RECORD_NUMBER,
      PHIEntityType.DATE_TIME,
      PHIEntityType.AGE,
      PHIEntityType.IP_ADDRESS,
      PHIEntityType.URL,
      PHIEntityType.US_PASSPORT,
      PHIEntityType.US_DRIVER_LICENSE,
      PHIEntityType.CREDIT_CARD,
      PHIEntityType.US_BANK_NUMBER,
      PHIEntityType.IBAN_CODE,
      PHIEntityType.US_ITIN,
      PHIEntityType.MEDICAL_LICENSE,
      PHIEntityType.ORGANIZATION,
    ]

    it.each(unimplemented)('throws "Not implemented" for %s', (type) => {
      expect(() => detector['getPlaceholderForEntityType'](type)).toThrow(
        /Not implemented/,
      )
    })
  })
})

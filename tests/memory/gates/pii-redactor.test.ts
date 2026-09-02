import { test, expect, describe, beforeEach } from 'vitest'

import {
  PiiRedactor,
  piiRedactor,
} from '../../../apps/web/src/lib/memory/gates/pii-redactor'

describe('PiiRedactor', () => {
  let redactor: PiiRedactor

  beforeEach(() => {
    redactor = new PiiRedactor()
  })

  test('clean content passes through without redaction', () => {
    const text = 'I feel anxious about my presentation tomorrow.'
    const result = redactor.redact(text)

    expect(result.scrubbedText).toBe(text)
    expect(result.piiTypesFound).toHaveLength(0)
    expect(result.wasRedacted).toBe(false)
    expect(result.confidence).toBe(0)
  })

  test('email is redacted', () => {
    const text = 'My email is john.doe@example.com and I need help.'
    const result = redactor.redact(text)

    expect(result.wasRedacted).toBe(true)
    expect(result.piiTypesFound).toContain('email')
    expect(result.scrubbedText).not.toContain('john.doe@example.com')
    expect(result.scrubbedText).toContain('[EMAIL]')
  })

  test('phone number is redacted', () => {
    const text = 'Call me at 555-123-4567 please.'
    const result = redactor.redact(text)

    expect(result.wasRedacted).toBe(true)
    expect(result.piiTypesFound).toContain('phone')
    expect(result.scrubbedText).not.toContain('555-123-4567')
    expect(result.scrubbedText).toContain('[PHONE]')
  })

  test('SSN is redacted', () => {
    const text = 'My SSN is 123-45-6789.'
    const result = redactor.redact(text)

    expect(result.wasRedacted).toBe(true)
    expect(result.piiTypesFound).toContain('ssn')
    expect(result.scrubbedText).not.toContain('123-45-6789')
    expect(result.scrubbedText).toContain('[SSN]')
  })

  test('multiple PII types are all redacted', () => {
    const text = 'Contact john@test.com or 555-123-4567.'
    const result = redactor.redact(text)

    expect(result.wasRedacted).toBe(true)
    expect(result.piiTypesFound).toContain('email')
    expect(result.piiTypesFound).toContain('phone')
    expect(result.piiTypesFound.length).toBeGreaterThanOrEqual(2)
  })

  test('evaluate returns gate evaluation for clean content', () => {
    const text = 'I had a good therapy session today.'
    const evaluation = redactor.evaluate(text)

    expect(evaluation.gate).toBe('gate0_pii_redaction')
    expect(evaluation.decision).toBe('pass')
    expect(evaluation.confidence).toBe(0)
  })

  test('evaluate returns gate evaluation for content with PII', () => {
    const text = 'Email: test@example.com'
    const evaluation = redactor.evaluate(text)

    expect(evaluation.gate).toBe('gate0_pii_redaction')
    expect(evaluation.decision).toBe('pass')
    expect(evaluation.confidence).toBeLessThan(1.0)
  })

  test('date is preserved in conservative mode', () => {
    const text = 'My appointment is on 2024-01-15.'
    const result = redactor.redact(text)

    expect(result.wasRedacted).toBe(false)
    expect(result.scrubbedText).toContain('2024-01-15')
  })

  test('address is preserved in conservative mode', () => {
    const text = 'I live at 123 Main Street.'
    const result = redactor.redact(text)

    expect(result.wasRedacted).toBe(false)
    expect(result.scrubbedText).toContain('123 Main Street')
  })

  test('credit card is redacted', () => {
    const text = 'My card is 4111 1111 1111 1111.'
    const result = redactor.redact(text)

    expect(result.wasRedacted).toBe(true)
    expect(result.piiTypesFound).toContain('credit_card')
  })

  test('IP address is redacted', () => {
    const text = 'My IP is 192.168.1.1'
    const result = redactor.redact(text)

    expect(result.wasRedacted).toBe(true)
    expect(result.piiTypesFound).toContain('ip_address')
  })

  test('singleton instance works', () => {
    expect(piiRedactor).toBeInstanceOf(PiiRedactor)
    const result = piiRedactor.redact('test@example.com')
    expect(result.wasRedacted).toBe(true)
  })
})

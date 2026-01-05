import { detectAndRedactPHI } from '../phiDetection'

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

import { describe, it, expect } from 'vitest'
import { scrubPII, scanForPII } from '../pii-scrubber'

describe('PIIScrubber', () => {
    const sampleText = 'My name is Dr. John Smith, you can email me at john@example.com or call (555) 010-9988. I live at 123 Main St.'

    it('scrubs common PII categories by default', () => {
        const result = scrubPII(sampleText)
        expect(result).toContain('[NAME]')
        expect(result).toContain('[EMAIL]')
        expect(result).toContain('[PHONE]')
        expect(result).not.toContain('John Smith')
        expect(result).not.toContain('john@example.com')
    })

    it('redacts instead of using specific placeholders when configured', () => {
        const result = scrubPII(sampleText, { maskType: 'redacted' })
        expect(result).toContain('[REDACTED]')
        expect(result).not.toContain('[NAME]')
    })

    it('applies custom replacements', () => {
        const text = 'Patient ID is XYZ123'
        const result = scrubPII(text, { customReplacements: { 'XYZ123': '[ID]' } })
        expect(result).toBe('Patient ID is [ID]')
    })

    it('scans and identifies PII categories', () => {
        const result = scanForPII(sampleText)
        expect(result.found).toBe(true)
        expect(result.categories).toContain('names')
        expect(result.categories).toContain('emails')
        expect(result.categories).toContain('phones')
        expect(result.count).toBeGreaterThanOrEqual(3)
    })

    it('handles empty or null text gracefully', () => {
        expect(scrubPII('')).toBe('')
        // @ts-ignore
        expect(scrubPII(null)).toBe(null)
    })
})

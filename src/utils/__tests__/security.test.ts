import { describe, it, expect } from 'vitest'
import { ensureString } from '../security'

describe('NoSQL Injection Mitigation via ensureString', () => {
    it('should return the string when a string is provided', () => {
        expect(ensureString('active')).toBe('active')
    })

    it('should return the first element if an array of strings is provided', () => {
        expect(ensureString(['active', 'draft'])).toBe('active')
    })

    it('should return undefined if an object (potential NoSQL injection) is provided', () => {
        // Simulating req.query.status = { $ne: null }
        expect(ensureString({ $ne: null } as any)).toBe(undefined)
    })

    it('should return undefined for other non-string types', () => {
        expect(ensureString(123 as any)).toBe(undefined)
        expect(ensureString(true as any)).toBe(undefined)
        expect(ensureString(null as any)).toBe(undefined)
        expect(ensureString(undefined)).toBe(undefined)
    })
})

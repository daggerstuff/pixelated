import { describe, it, expect } from 'vitest'
import { ensureString, ensureNumber } from './security'

describe('Security Utilities', () => {
    describe('ensureString', () => {
        it('should return string as is', () => {
            expect(ensureString('hello')).toBe('hello')
        })

        it('should take first element of an array', () => {
            expect(ensureString(['first', 'second'])).toBe('first')
        })

        it('should handle nested arrays', () => {
            expect(ensureString([['nested']])).toBe('nested')
        })

        it('should take first value of an object', () => {
            expect(ensureString({ key: 'value' })).toBe('value')
        })

        it('should convert numbers to strings', () => {
            expect(ensureString(123)).toBe('123')
        })

        it('should handle null and undefined', () => {
            expect(ensureString(null)).toBe('')
            expect(ensureString(undefined)).toBe('')
        })

        it('should handle complex NoSQL injection attempts (objects)', () => {
            const injection = { $gt: '' }
            // ensureString should NOT return the object itself
            const result = ensureString(injection)
            expect(typeof result).toBe('string')
            expect(result).not.toBe(injection)
        })
    })

    describe('ensureNumber', () => {
        it('should parse valid numbers', () => {
            expect(ensureNumber('123', 0)).toBe(123)
        })

        it('should return default value for invalid numbers', () => {
            expect(ensureNumber('abc', 10)).toBe(10)
        })

        it('should return default value for null/undefined', () => {
            expect(ensureNumber(null, 5)).toBe(5)
            expect(ensureNumber(undefined, 5)).toBe(5)
        })

        it('should handle arrays', () => {
            expect(ensureNumber(['100', '200'], 0)).toBe(100)
        })
    })
})

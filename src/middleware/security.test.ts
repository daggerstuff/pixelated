import { describe, it, expect } from 'vitest'
import { validatePassword } from './security'

describe('validatePassword', () => {
  it('should return valid=true for a strong password', () => {
    const result = validatePassword('StrongPass123!')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should require at least 12 characters', () => {
    const result = validatePassword('Short1!')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Password must be at least 12 characters long')
  })

  it('should require at least one uppercase letter', () => {
    const result = validatePassword('lowercase123!')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Password must contain at least one uppercase letter')
  })

  it('should require at least one lowercase letter', () => {
    const result = validatePassword('UPPERCASE123!')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Password must contain at least one lowercase letter')
  })

  it('should require at least one number', () => {
    const result = validatePassword('NoNumbersHere!')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Password must contain at least one number')
  })

  it('should require at least one special character', () => {
    const result = validatePassword('NoSpecialChar123')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Password must contain at least one special character')
  })

  it('should return multiple errors if multiple conditions fail', () => {
    const result = validatePassword('short')
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(4) // Missing uppercase, number, special char, length < 12
    expect(result.errors).toContain('Password must be at least 12 characters long')
    expect(result.errors).toContain('Password must contain at least one uppercase letter')
    expect(result.errors).toContain('Password must contain at least one number')
    expect(result.errors).toContain('Password must contain at least one special character')
  })
})

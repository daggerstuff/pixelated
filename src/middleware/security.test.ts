import { describe, it, expect } from 'vitest'
import { sanitizeString } from './security'

describe('sanitizeString', () => {
  it('returns empty string for non-string inputs', () => {
    expect(sanitizeString(null)).toBe('')
    expect(sanitizeString(undefined)).toBe('')
    expect(sanitizeString(123)).toBe('')
    expect(sanitizeString({})).toBe('')
    expect(sanitizeString([])).toBe('')
    expect(sanitizeString(true)).toBe('')
  })

  it('returns normal string as-is', () => {
    expect(sanitizeString('hello world')).toBe('hello world')
    expect(sanitizeString('valid input 123 !@#')).toBe('valid input 123 !@#')
  })

  it('removes script tags and their content', () => {
    expect(sanitizeString('hello<script>alert(1)</script>world')).toBe('helloworld')
    expect(sanitizeString('<SCRIPT src="bad.js"></SCRIPT>safe')).toBe('safe')
  })

  it('removes html tags but keeps content', () => {
    expect(sanitizeString('<b>bold</b> text')).toBe('bold text')
    expect(sanitizeString('click <a href="x">here</a>')).toBe('click here')
    // self-closing tags are stripped, trailing whitespace trimmed
    expect(sanitizeString('image<img src="x" />')).toBe('image')
  })

  it('removes javascript: protocol', () => {
    expect(sanitizeString('javascript:alert(1)')).toBe('alert(1)')
    expect(sanitizeString('JaVaScRiPt:alert(1)')).toBe('alert(1)')
  })

  it('removes event handlers', () => {
    expect(sanitizeString('onclick=alert(1)')).toBe('alert(1)')
    expect(sanitizeString('ONMOUSEOVER = alert(1)')).toBe('alert(1)')
    expect(sanitizeString('onclick="alert(1)"')).toBe('alert(1)')
    expect(sanitizeString("onclick='alert(1)'")).toBe('alert(1)')
  })

  it('trims whitespace', () => {
    expect(sanitizeString(' padded string ')).toBe('padded string')
    expect(sanitizeString('\n\ttabs and newlines\n\t')).toBe('tabs and newlines')
  })

  it('truncates strings longer than 10000 characters', () => {
    const longString = 'a'.repeat(15000)
    const result = sanitizeString(longString)
    expect(result.length).toBe(10000)
    expect(result).toBe('a'.repeat(10000))
  })
})
/// <reference types="vitest/node" />
/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { generateFileName } from './upload'

describe('generateFileName', () => {
  beforeEach(() => {
    // Set a fixed date for consistent timestamp generation
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-05-15T10:30:45.123Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('generates a valid filename for a standard file', () => {
    const result = generateFileName('document.pdf')
    expect(result).toBe('document_2023-05-15T10-30-45-123Z.pdf')
  })

  it('handles files with multiple dots', () => {
    const result = generateFileName('archive.tar.gz')
    expect(result).toBe('archive_tar_2023-05-15T10-30-45-123Z.gz')
  })

  it('handles files without an extension', () => {
    const result = generateFileName('README')
    expect(result).toBe('README_2023-05-15T10-30-45-123Z')
  })

  it('cleans up special characters in the filename', () => {
    const result = generateFileName('my resume! @v2#.docx')
    expect(result).toBe('my_resume___v2__2023-05-15T10-30-45-123Z.docx')
  })

  it('retains alphanumeric characters', () => {
    const result = generateFileName('Report_2023_Final.xlsx')
    expect(result).toBe('Report_2023_Final_2023-05-15T10-30-45-123Z.xlsx')
  })
})

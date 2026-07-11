import { describe, it, expect } from 'vitest'
import { isSuccess, isFailure, type Result } from '../utility'

describe('utility', () => {
  describe('isSuccess', () => {
    it('returns true for a successful result', () => {
      const result: Result<string, Error> = {
        success: true,
        data: 'test data'
      }
      expect(isSuccess(result)).toBe(true)
    })

    it('returns false for a failure result', () => {
      const result: Result<string, Error> = {
        success: false,
        error: new Error('test error')
      }
      expect(isSuccess(result)).toBe(false)
    })
  })

  describe('isFailure', () => {
    it('returns true for a failure result', () => {
      const result: Result<string, Error> = {
        success: false,
        error: new Error('test error')
      }
      expect(isFailure(result)).toBe(true)
    })

    it('returns false for a successful result', () => {
      const result: Result<string, Error> = {
        success: true,
        data: 'test data'
      }
      expect(isFailure(result)).toBe(false)
    })
  })
})

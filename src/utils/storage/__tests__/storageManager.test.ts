import { describe, it, expect, vi } from 'vitest'
import { storageManager } from '../storageManager'

describe('storageManager serialization', () => {
  describe('serialize', () => {
    it('should serialize valid JSON data', () => {
      const data = { test: 'value', number: 123 }
      // Using any to test the private method
      const result = (storageManager as any).serialize(data)
      expect(result).toBe('{"test":"value","number":123}')
    })

    it('should return "{}" when serialization fails (e.g., circular reference)', () => {
      // Create a circular reference to force JSON.stringify to throw
      const circularObj: any = {}
      circularObj.self = circularObj

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = (storageManager as any).serialize(circularObj)

      expect(result).toBe('{}')
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to serialize data:', expect.any(Error))

      consoleWarnSpy.mockRestore()
    })
  })

  describe('deserialize', () => {
    it('should deserialize valid JSON string', () => {
      const jsonStr = '{"test":"value","number":123}'
      const result = (storageManager as any).deserialize(jsonStr)
      expect(result).toEqual({ test: 'value', number: 123 })
    })

    it('should return null when deserialization fails', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Invalid JSON string
      const result = (storageManager as any).deserialize('invalid-json')

      expect(result).toBeNull()
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to deserialize data:', expect.any(Error))

      consoleWarnSpy.mockRestore()
    })
  })
})

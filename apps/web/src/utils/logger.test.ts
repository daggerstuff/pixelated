import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createLogger, LogLevel, setLogLevel, logger } from './logger'

describe('logger utilities', () => {
  let originalLogLevel: LogLevel

  beforeEach(() => {
    originalLogLevel = logger.getLevel()
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('createLogger', () => {
    it('should create a logger with debug, info, warn, error methods', () => {
      const myLogger = createLogger()
      expect(typeof myLogger.debug).toBe('function')
      expect(typeof myLogger.info).toBe('function')
      expect(typeof myLogger.warn).toBe('function')
      expect(typeof myLogger.error).toBe('function')
    })

    it('should respect custom options', () => {
      const customLogger = createLogger({
        context: 'TestContext',
        level: LogLevel.INFO,
      })
      customLogger.setLevel(LogLevel.DEBUG)
      customLogger.info('test message')
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('[TestContext]:'),
        'test message',
      )
    })
  })

  describe('log levels', () => {
    it('should not log debug when level is INFO', () => {
      const myLogger = createLogger()
      myLogger.setLevel(LogLevel.INFO)
      myLogger.debug('debug message')
      expect(console.debug).not.toHaveBeenCalled()
    })

    it('should log warn when level is INFO', () => {
      const myLogger = createLogger()
      myLogger.setLevel(LogLevel.INFO)
      myLogger.warn('warn message')
      expect(console.warn).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should log error message and stack trace if message is an Error instance', () => {
      const myLogger = createLogger()
      myLogger.setLevel(LogLevel.ERROR)
      const testError = new Error('Test error message')
      testError.stack = 'Mock stack trace'
      myLogger.error(testError)
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR'),
        'Test error message',
      )
      expect(console.error).toHaveBeenCalledWith('Mock stack trace')
    })
  })

  describe('global setLogLevel', () => {
    it('should update the global logger level', () => {
      setLogLevel(LogLevel.ERROR)
      expect(logger.getLevel()).toBe(LogLevel.ERROR)
    })
  })

  afterEach(() => {
    // Reset global logger level
    setLogLevel(originalLogLevel)
  })
})

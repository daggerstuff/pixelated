// @vitest-environment node

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest'

import {
  createConsoleAuditLogger,
  NoOpAuditLogger,
  AuditEvent,
} from './product-memory-audit'

describe('product-memory-audit', () => {
  let consoleInfoSpy: Mock
  let consoleErrorSpy: Mock

  beforeEach(() => {
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createConsoleAuditLogger', () => {
    it('should log success events to console.info', () => {
      const logger = createConsoleAuditLogger()
      const event: AuditEvent = {
        type: 'auth.success',
        actorId: 'test-actor',
        userId: 'test-user',
        operation: 'test-operation',
        correlationId: 'test-correlation-id',
        timestamp: Date.now(),
      }

      logger.log(event)

      expect(consoleInfoSpy).toHaveBeenCalled()
      expect(consoleErrorSpy).not.toHaveBeenCalled()

      // Verify the logged JSON contains the event data
      const loggedJson = JSON.parse(consoleInfoSpy.mock.calls[0][0])
      expect(loggedJson).toMatchObject(event)
    })

    it('should log failure events to console.error', () => {
      const logger = createConsoleAuditLogger()
      const event: AuditEvent = {
        type: 'auth.failure',
        actorId: 'test-actor',
        userId: 'test-user',
        operation: 'test-operation',
        correlationId: 'test-correlation-id',
        timestamp: Date.now(),
      }

      logger.log(event)

      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(consoleInfoSpy).not.toHaveBeenCalled()

      // Verify the logged JSON contains the event data
      const loggedJson = JSON.parse(consoleErrorSpy.mock.calls[0][0])
      expect(loggedJson).toMatchObject(event)
    })

    it('should include latencyMs when provided', () => {
      const logger = createConsoleAuditLogger()
      const event: AuditEvent = {
        type: 'downstream.success',
        actorId: 'test-actor',
        userId: 'test-user',
        operation: 'test-operation',
        correlationId: 'test-correlation-id',
        latencyMs: 150,
        timestamp: Date.now(),
      }

      logger.log(event)

      expect(consoleInfoSpy).toHaveBeenCalled()
      const loggedJson = JSON.parse(consoleInfoSpy.mock.calls[0][0])
      expect(loggedJson.latencyMs).toBe(150)
    })

    it('should include details when provided', () => {
      const logger = createConsoleAuditLogger()
      const event: AuditEvent = {
        type: 'scope.validated',
        actorId: 'test-actor',
        userId: 'test-user',
        operation: 'test-operation',
        correlationId: 'test-correlation-id',
        details: { key: 'value', number: 42 },
        timestamp: Date.now(),
      }

      logger.log(event)

      expect(consoleInfoSpy).toHaveBeenCalled()
      const loggedJson = JSON.parse(consoleInfoSpy.mock.calls[0][0])
      expect(loggedJson.details).toEqual({ key: 'value', number: 42 })
    })
  })

  describe('NoOpAuditLogger', () => {
    it('should not throw when logging', () => {
      const logger = new NoOpAuditLogger()
      const event: AuditEvent = {
        type: 'auth.success',
        actorId: 'test-actor',
        userId: 'test-user',
        operation: 'test-operation',
        correlationId: 'test-correlation-id',
        timestamp: Date.now(),
      }

      // Should not throw
      expect(() => logger.log(event)).not.toThrow()
    })

    it('should not call console methods', () => {
      const logger = new NoOpAuditLogger()
      const event: AuditEvent = {
        type: 'auth.success',
        actorId: 'test-actor',
        userId: 'test-user',
        operation: 'test-operation',
        correlationId: 'test-correlation-id',
        timestamp: Date.now(),
      }

      logger.log(event)

      expect(consoleInfoSpy).not.toHaveBeenCalled()
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })
  })
})

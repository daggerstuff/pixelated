// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LogLevel,
  Logger,
  clearCollectedLogs,
  configureLogging,
  getCollectedLogs,
  getLogger,
} from '../index'

/** Build a minimal console-like object backed by vitest spies. */
function makeConsole() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}

type FakeConsole = ReturnType<typeof makeConsole>

beforeEach(() => {
  clearCollectedLogs()
})

afterEach(() => {
  clearCollectedLogs()
  vi.restoreAllMocks()
})

describe('LogLevel enum', () => {
  it('exposes the canonical level strings', () => {
    expect(LogLevel.DEBUG).toBe('debug')
    expect(LogLevel.INFO).toBe('info')
    expect(LogLevel.WARN).toBe('warn')
    expect(LogLevel.ERROR).toBe('error')
  })
})

describe('Logger level filtering (shouldLog)', () => {
  it('suppresses lower-priority levels at INFO', () => {
    const c = makeConsole()
    const logger = new Logger({
      console: c as unknown as Console,
      level: LogLevel.INFO,
    })

    logger.debug('d')
    logger.info('i')
    logger.warn('w')
    logger.error('e')

    expect(c.debug).not.toHaveBeenCalled()
    expect(c.info).toHaveBeenCalledTimes(1)
    expect(c.warn).toHaveBeenCalledTimes(1)
    expect(c.error).toHaveBeenCalledTimes(1)
  })

  it('only emits ERROR when level is ERROR', () => {
    const c = makeConsole()
    const logger = new Logger({
      console: c as unknown as Console,
      level: LogLevel.ERROR,
    })

    logger.info('i')
    logger.warn('w')
    logger.error('e')

    expect(c.info).not.toHaveBeenCalled()
    expect(c.warn).not.toHaveBeenCalled()
    expect(c.error).toHaveBeenCalledTimes(1)
  })

  it('emits everything at DEBUG', () => {
    const c = makeConsole()
    const logger = new Logger({
      console: c as unknown as Console,
      level: LogLevel.DEBUG,
    })

    logger.debug('d')
    logger.info('i')

    expect(c.debug).toHaveBeenCalledTimes(1)
    expect(c.info).toHaveBeenCalledTimes(1)
  })
})

describe('Logger.formatLogMessage', () => {
  it('includes timestamp, level and message', () => {
    const c = makeConsole()
    const logger = new Logger({
      console: c as unknown as Console,
      includeTimestamp: true,
    })

    logger.info('hello world')

    const msg = c.info.mock.calls[0][0] as string
    expect(msg).toMatch(/^\[\d{4}-\d{2}-\d{2}T/)
    expect(msg).toContain('[INFO]')
    expect(msg).toContain('hello world')
  })

  it('includes the configured prefix', () => {
    const c = makeConsole()
    const logger = new Logger({
      console: c as unknown as Console,
      prefix: 'svc',
    })

    logger.info('hi')

    expect((c.info.mock.calls[0][0] as string)).toContain('[svc]')
  })

  it('omits the timestamp when disabled', () => {
    const c = makeConsole()
    const logger = new Logger({
      console: c as unknown as Console,
      includeTimestamp: false,
    })

    logger.info('no-ts')

    const msg = c.info.mock.calls[0][0] as string
    expect(msg).not.toMatch(/^\[\d{4}-\d{2}-\d{2}T/)
    expect(msg).toContain('no-ts')
  })
})

describe('Logger.child', () => {
  it('composes prefixes with a colon when a parent prefix exists', () => {
    const c = makeConsole()
    const parent = new Logger({
      console: c as unknown as Console,
      prefix: 'parent',
    })

    parent.child('child').info('x')

    expect((c.info.mock.calls[0][0] as string)).toContain('[parent:child]')
  })

  it('uses the child prefix alone when no parent prefix exists', () => {
    const c = makeConsole()
    const parent = new Logger({ console: c as unknown as Console })

    parent.child('kid').info('y')

    expect((c.info.mock.calls[0][0] as string)).toContain('[kid]')
  })
})

describe('Logger PHI/PII sanitization', () => {
  function collectLogger(c: FakeConsole) {
    return new Logger({
      console: c as unknown as Console,
      level: LogLevel.DEBUG,
      enableLogCollection: true,
    })
  }

  it('redacts default SSN patterns in metadata', () => {
    const c = makeConsole()
    const logger = collectLogger(c)

    logger.info('patient note', { note: 'ssn 123-45-6789 here' })

    const meta = getCollectedLogs()[0].metadata as Record<string, unknown>
    expect(meta['note']).toBe('ssn [SANITIZED] here')
  })

  it('redacts configured sensitive fields with a field-specific tag', () => {
    const c = makeConsole()
    const logger = collectLogger(c)

    logger.info('login', { ssn: '123-45-6789', name: 'John' })

    const meta = getCollectedLogs()[0].metadata as Record<string, unknown>
    expect(meta['ssn']).toBe('[SANITIZED_SSN]')
    expect(meta['name']).toBe('John')
  })

  it('recursively sanitizes arrays and nested objects', () => {
    const c = makeConsole()
    const logger = collectLogger(c)

    logger.info('list', {
      ids: ['123-45-6789', 'ok'],
      profile: { ssn: '123-45-6789' },
    })

    const meta = getCollectedLogs()[0].metadata as Record<string, unknown>
    expect(meta['ids']).toEqual(['[SANITIZED]', 'ok'])
    expect((meta['profile'] as Record<string, unknown>)['ssn']).toBe(
      '[SANITIZED_SSN]',
    )
  })
describe('Logger PHI/PII sanitization (continued)', () => {
  function collectLogger(c: FakeConsole) {
    return new Logger({
      console: c as unknown as Console,
      level: LogLevel.DEBUG,
      enableLogCollection: true,
    })
  }

  it('merges custom patterns and sensitive fields with defaults', () => {
    const c = makeConsole()
    const logger = new Logger({
      console: c as unknown as Console,
      level: LogLevel.DEBUG,
      enableLogCollection: true,
      phiPatterns: [/X\d+/g],
      sanitizeFields: ['customField'],
    })

    logger.info('code', { note: 'X123' })
    expect((getCollectedLogs()[0].metadata as Record<string, unknown>)['note']).toBe(
      '[SANITIZED]',
    )

    clearCollectedLogs()
    // A sensitive field only gets the [SANITIZED_FIELD] tag when its value
    // matches a PHI pattern; here the SSN pattern fires and uses the
    // field-specific replacement.
    logger.info('cf', { customField: '123-45-6789' })
    expect(
      (getCollectedLogs()[0].metadata as Record<string, unknown>)['customField'],
    ).toBe('[SANITIZED_CUSTOMFIELD]')

    clearCollectedLogs()
    logger.info('ssn', { note: '123-45-6789' })
    expect((getCollectedLogs()[0].metadata as Record<string, unknown>)['note']).toBe(
      '[SANITIZED]',
    )
  })

  it('sanitizes Error message and stack in error()', () => {
    const c = makeConsole()
    const logger = collectLogger(c)
    const err = new Error('boom 123-45-6789')

    logger.error('failed op', err, { ctx: 'x' })

    // The main formatted message is sanitized (here unchanged; no PHI present)
    const formatted = c.error.mock.calls[0][0] as string
    expect(formatted).toContain('failed op')

    // The attached Error object's message/stack are sanitized in metadata
    const meta = c.error.mock.calls[0][1] as Record<string, unknown>
    const processed = meta['error'] as Record<string, unknown>
    expect(processed['name']).toBe('Error')
    // Only the SSN substring is redacted, surrounding text is preserved
    expect(processed['message']).toContain('[SANITIZED]')
    expect(typeof processed['stack']).toBe('string')
    expect(meta['ctx']).toBe('x')
  })

  it('treats a non-Error error argument as no processed error object', () => {
    const c = makeConsole()
    const logger = collectLogger(c)

    logger.error('oops', 'a plain string error')

    const meta = c.error.mock.calls[0][1] as Record<string, unknown>
    expect(meta['error']).toBeUndefined()
  })
})

describe('log collection', () => {
  it('collects entries only when enableLogCollection is true', () => {
    const c = makeConsole()
    const logger = new Logger({
      console: c as unknown as Console,
      level: LogLevel.DEBUG,
      enableLogCollection: true,
    })

    logger.info('one')

    expect(getCollectedLogs()).toHaveLength(1)

    clearCollectedLogs()
    expect(getCollectedLogs()).toHaveLength(0)

    const quiet = new Logger({
      console: makeConsole() as unknown as Console,
      level: LogLevel.DEBUG,
      enableLogCollection: false,
    })
    quiet.info('two')
    expect(getCollectedLogs()).toHaveLength(0)
  })

  it('caps collected logs at MAX_COLLECTED_LOGS (1000)', () => {
    const c = makeConsole()
    const logger = new Logger({
      console: c as unknown as Console,
      level: LogLevel.DEBUG,
      enableLogCollection: true,
    })

    for (let i = 0; i < 1001; i++) {
      logger.debug('x')
    }

    expect(getCollectedLogs()).toHaveLength(1000)
  })
})

describe('getLogger / configureLogging', () => {
  it('returns the same singleton instance when called without options', () => {
    configureLogging({ level: LogLevel.DEBUG })
    const a = getLogger()
    const b = getLogger()
    expect(a).toBe(b)
  })

  it('replaces the singleton when options are supplied', () => {
    const a = getLogger({ prefix: 'first' })
    const b = getLogger()
    // supplying options on the first call creates and caches that instance
    expect(a).toBe(b)
    expect((a as unknown as { options: { prefix: string } }).options.prefix).toBe('first')
  })
})

})

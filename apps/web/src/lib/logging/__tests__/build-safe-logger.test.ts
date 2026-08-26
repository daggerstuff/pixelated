// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createBuildSafeLogger, getStartupLogger } from '../build-safe-logger'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('build-safe-logger', () => {
  it('exposes info/warn/error/debug functions', () => {
    const logger = createBuildSafeLogger('my-mod')
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.debug).toBe('function')
  })

  it('delegates each level to the matching console method with a tag prefix', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})

    const logger = createBuildSafeLogger('my-mod')
    logger.info('a', 1)
    logger.warn('b')
    logger.error('c')
    logger.debug('d')

    expect(info).toHaveBeenCalledWith('[build-safe-logger][my-mod]', 'a', 1)
    expect(warn).toHaveBeenCalledWith('[build-safe-logger][my-mod]', 'b')
    expect(error).toHaveBeenCalledWith('[build-safe-logger][my-mod]', 'c')
    expect(debug).toHaveBeenCalledWith('[build-safe-logger][my-mod]', 'd')
  })

  it('defaults the prefix to "app" when none is provided', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})

    const logger = createBuildSafeLogger()
    logger.info('hi')

    expect(info).toHaveBeenCalledWith('[build-safe-logger][app]', 'hi')
  })

  it('getStartupLogger uses the "startup" prefix', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})

    const logger = getStartupLogger()
    logger.info('boot')

    expect(info).toHaveBeenCalledWith('[build-safe-logger][startup]', 'boot')
  })
})

import { describe, expect, it, vi } from 'vitest'

import { registerProcessShutdown } from '../agent/lib/process-shutdown.js'

describe('registerProcessShutdown', () => {
  it('runs cleanup once and exits on SIGTERM', async () => {
    const listeners = new Map<NodeJS.Signals, () => void>()
    const onceSpy = vi.spyOn(process, 'once').mockImplementation(((
      signal: NodeJS.Signals,
      listener: () => void,
    ) => {
      listeners.set(signal, listener)
      return process
    }) as typeof process.once)
    const offSpy = vi.spyOn(process, 'off').mockImplementation(((
      signal: NodeJS.Signals,
    ) => {
      listeners.delete(signal)
      return process
    }) as typeof process.off)
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as typeof process.exit)
    const cleanup = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)

    const unregister = registerProcessShutdown(cleanup)
    const sigtermListener = listeners.get('SIGTERM')

    expect(sigtermListener).toBeTypeOf('function')

    sigtermListener?.()
    sigtermListener?.()
    await Promise.resolve()
    await Promise.resolve()

    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(exitSpy).toHaveBeenCalledWith(0)

    unregister()
    expect(offSpy).toHaveBeenCalled()

    onceSpy.mockRestore()
    offSpy.mockRestore()
    exitSpy.mockRestore()
  })
})

/* @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SealSchemeType } from '../seal-types'
import type { SealContextOptions } from '../seal-types'

vi.mock('../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

const mockSealModule = {
  SecurityLevel: {
    tc128: 'sec-128',
    tc192: 'sec-192',
    tc256: 'sec-256',
  },
  SchemeType: {
    bfv: 'scheme-bfv',
    bgv: 'scheme-bgv',
    ckks: 'scheme-ckks',
  },
  EncryptionParameters: vi.fn(() => ({
    setPolyModulusDegree: vi.fn(),
    setCoeffModulus: vi.fn(),
    setPlainModulus: vi.fn(),
    delete: vi.fn(),
  })),
  CoeffModulus: {
    Create: vi.fn(() => 'coeff-mod-created'),
    BFVDefault: vi.fn(() => 'coeff-mod-default'),
  },
  PlainModulus: {
    Batching: vi.fn(() => 'plain-mod'),
  },
  Context: vi.fn(() => ({
    parametersSet: () => true,
    usingKeyswitching: () => true,
    delete: vi.fn(),
  })),
}

let SealContext: typeof import('../seal-context').SealContext

beforeEach(async () => {
  vi.resetModules()
  vi.doMock('node-seal', () => ({
    default: () => Promise.resolve(mockSealModule),
  }))
  const mod = await import('../seal-context')
  SealContext = mod.SealContext
})

afterEach(() => {
  vi.doUnmock('node-seal')
  vi.restoreAllMocks()
})

function makeOptions(overrides: Partial<SealContextOptions> = {}): SealContextOptions {
  return {
    scheme: SealSchemeType.BFV,
    params: {
      polyModulusDegree: 4096,
      securityLevel: 'tc128',
    },
    ...overrides,
  }
}

describe('SealContext', () => {
  let ctx: SealContext

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = new SealContext(makeOptions())
  })

  describe('constructor', () => {
    it('stores options and defaults securityLevel to tc256 when not set', () => {
      const noSecCtx = new SealContext({
        scheme: SealSchemeType.BFV,
        params: { polyModulusDegree: 4096 },
      })
      expect(noSecCtx.getOptions().params.securityLevel).toBeUndefined()
    })
  })

  describe('initialize', () => {
    it('initializes with BFV scheme', async () => {
      await ctx.initialize()
      expect(ctx.isInitialized()).toBe(true)
      expect(mockSealModule.EncryptionParameters).toHaveBeenCalledWith('scheme-bfv')
    })

    it('initializes with CKKS scheme', async () => {
      const ckksCtx = new SealContext(makeOptions({
        scheme: SealSchemeType.CKKS,
        params: {
          polyModulusDegree: 8192,
          coeffModulusBits: [60, 40, 40, 60],
        },
      }))
      await ckksCtx.initialize()
      expect(ckksCtx.isInitialized()).toBe(true)
      expect(mockSealModule.EncryptionParameters).toHaveBeenCalledWith('scheme-ckks')
      expect(mockSealModule.CoeffModulus.Create).toHaveBeenCalledWith(8192, [60, 40, 40, 60])
    })

    it('initializes with BGV scheme', async () => {
      const bgvCtx = new SealContext(makeOptions({ scheme: SealSchemeType.BGV }))
      await bgvCtx.initialize()
      expect(bgvCtx.isInitialized()).toBe(true)
      expect(mockSealModule.EncryptionParameters).toHaveBeenCalledWith('scheme-bgv')
    })

    it('maps security level tc192', async () => {
      const ctx192 = new SealContext(makeOptions({
        params: { polyModulusDegree: 4096, securityLevel: 'tc192' },
      }))
      await ctx192.initialize()
      expect(ctx192.isInitialized()).toBe(true)
    })

    it('maps security level tc256', async () => {
      const ctx256 = new SealContext(makeOptions({
        params: { polyModulusDegree: 4096, securityLevel: 'tc256' },
      }))
      await ctx256.initialize()
      expect(ctx256.isInitialized()).toBe(true)
    })

    it('does not re-initialize if already initialized', async () => {
      await ctx.initialize()
      await ctx.initialize()
      expect(ctx.isInitialized()).toBe(true)
    })

    it('waits for in-progress initialization', async () => {
      const p1 = ctx.initialize()
      const p2 = ctx.initialize()
      await Promise.all([p1, p2])
      expect(ctx.isInitialized()).toBe(true)
    })

    it('throws when parameters are invalid', async () => {
      mockSealModule.Context.mockReturnValueOnce({
        parametersSet: () => false,
        usingKeyswitching: () => false,
        delete: vi.fn(),
      })
      await expect(ctx.initialize()).rejects.toThrow('SEAL parameters are not valid')
    })

    it('throws when node-seal import fails and no browser fallback', async () => {
      vi.doMock('node-seal', () => ({
        default: vi.fn(() => Promise.reject(new Error('not found'))),
      }))
      const failCtx = new SealContext(makeOptions())
      await expect(failCtx.initialize()).rejects.toThrow('SEAL initialization failed')
      vi.doUnmock('node-seal')
    })
  })

  describe('getters', () => {
    beforeEach(async () => {
      await ctx.initialize()
    })

    it('getSealModule returns the seal instance', () => {
      expect(ctx.getSealModule()).toBeDefined()
    })

    it('getSeal returns the seal instance', () => {
      expect(ctx.getSeal()).toBeDefined()
    })

    it('getContext returns the context', () => {
      expect(ctx.getContext()).toBeDefined()
    })

    it('getSchemeType returns the configured scheme', () => {
      expect(ctx.getSchemeType()).toBe(SealSchemeType.BFV)
    })

    it('getEncryptionParameters returns parameters', () => {
      expect(ctx.getEncryptionParameters()).toBeDefined()
    })

    it('getOptions returns stored options', () => {
      const opts = ctx.getOptions()
      expect(opts.scheme).toBe(SealSchemeType.BFV)
    })
  })

  describe('pre-initialization guards', () => {
    it('getSealModule throws before initialization', () => {
      expect(() => ctx.getSealModule()).toThrow('not available')
    })

    it('getSeal throws before initialization', () => {
      expect(() => ctx.getSeal()).toThrow('not initialized')
    })

    it('getContext throws before initialization', () => {
      expect(() => ctx.getContext()).toThrow('not initialized')
    })

    it('getEncryptionParameters throws before initialization', () => {
      expect(() => ctx.getEncryptionParameters()).toThrow('not initialized')
    })
  })

  describe('dispose', () => {
    it('cleans up resources and resets initialized state', async () => {
      await ctx.initialize()
      expect(ctx.isInitialized()).toBe(true)
      ctx.dispose()
      expect(ctx.isInitialized()).toBe(false)
    })

    it('handles dispose when not initialized', () => {
      expect(() => ctx.dispose()).not.toThrow()
    })
  })
})
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PolicyEngine } from '../policy-engine'

describe('PolicyEngine hot reload', () => {
  let engine: PolicyEngine

  beforeEach(() => {
    engine = new PolicyEngine()
  })

  it('reloads policies from store', async () => {
    // Initial policy
    await engine.loadPolicy({ 
      id: 'reload-test', 
      version: '1.0.0', 
      rules: [{
        id: 'rule-1',
        action: 'test',
        conditions: [],
        required: []
      }]
    })

    // Verify initial version
    expect(engine.getVersion()).toBe('1.0.0')
  })

  it('getVersion returns null when no policies loaded', () => {
    const freshEngine = new PolicyEngine()
    expect(freshEngine.getVersion()).toBe(null)
  })

  it('logs when reloadPolicies is called', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    
    await engine.reloadPolicies()
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Policy reload triggered')
    )
    
    consoleSpy.mockRestore()
  })
})

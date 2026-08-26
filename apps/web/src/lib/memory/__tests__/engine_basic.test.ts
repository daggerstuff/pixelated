import {
  ReprioritizationEngine,
  createEngine,
  defaultConfig,
} from '../reprioritization_engine'

describe('ReprioritizationEngine basic sanity', () => {
  it('engine creates instance with default config', () => {
    const eng = new ReprioritizationEngine()
    expect(eng).toBeInstanceOf(ReprioritizationEngine)
  })

  it('engine creates instance with custom config', () => {
    const cfg = defaultConfig({ actionThreshold: 0.5 })
    const eng = new ReprioritizationEngine(cfg)
    expect(eng).toBeInstanceOf(ReprioritizationEngine)
  })

  it('createEngine factory creates engine', () => {
    const eng = createEngine()
    expect(eng).toBeInstanceOf(ReprioritizationEngine)
  })

  it('empty feedback produces empty report', async () => {
    const eng = new ReprioritizationEngine()
    const result = await eng.runReprioritization()
    expect(result.newBacklogItems).toHaveLength(0)
    expect(result.runId).toMatch(/^run-/)
  })

  it('getBacklog returns empty array before any reprioritization', () => {
    const eng = new ReprioritizationEngine()
    expect(eng.getBacklog()).toHaveLength(0)
  })
})

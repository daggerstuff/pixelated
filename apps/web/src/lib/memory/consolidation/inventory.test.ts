import { InventoryEngine } from './inventory'

describe('InventoryEngine TS', () => {
  let engine: InventoryEngine

  beforeEach(() => {
    engine = new InventoryEngine() // in‑memory only
  })

  test('add and get item', () => {
    const item = engine.addItem('test', { a: 1 })
    expect(item.id).toBeDefined()
    const fetched = engine.getItem(item.id)
    expect(fetched.name).toBe('test')
    expect(fetched.metadata).toEqual({ a: 1 })
  })

  test('update item', () => {
    const item = engine.addItem('orig')
    const updated = engine.updateItem(item.id, {
      name: 'new',
      metadata: { b: 2 },
    })
    expect(updated.name).toBe('new')
    expect(updated.metadata).toEqual({ b: 2 })
  })

  test('remove item', () => {
    const item = engine.addItem('to‑remove')
    engine.removeItem(item.id)
    expect(() => engine.getItem(item.id)).toThrow()
  })

  test('list and count', () => {
    expect(engine.count()).toBe(0)
    engine.addItem('one')
    engine.addItem('two')
    expect(engine.count()).toBe(2)
    const names = engine.listItems().map((i) => i.name)
    expect(names).toContain('one')
    expect(names).toContain('two')
  })
})

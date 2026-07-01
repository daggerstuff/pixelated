// Enterprise‑grade in‑memory inventory engine (TypeScript)
import { v4 as uuidv4 } from 'uuid'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
const logger = createBuildSafeLogger('inventory')

/**
 * Represents a single inventory entry.
 */
export interface InventoryItem {
  id: string
  name: string
  metadata: Record<string, unknown>
}

/**
 * In‑memory inventory engine with optional JSON persistence.
 *
 * Example usage:
 *   const engine = new InventoryEngine();
 *   const item = engine.addItem('patient‑record', { risk: 'high' });
 *   const fetched = engine.getItem(item.id);
 *   engine.updateItem(item.id, { risk: 'low' });
 *   engine.removeItem(item.id);
 */
export class InventoryEngine {
  private readonly items: Map<string, InventoryItem> = new Map()
  private readonly storagePath?: string

  constructor(storagePath?: string) {
    this.storagePath = storagePath
    if (storagePath) {
      this.load()
    }
  }

  // ---------------------------------------------------------------------
  // Persistence helpers
  // ---------------------------------------------------------------------
  private load(): void {
    if (!this.storagePath) return
    try {
      const raw = JSON.parse(
        window?.localStorage?.getItem(this.storagePath) ?? '[]',
      )
      raw.forEach((obj: any) => {
        const item: InventoryItem = {
          id: String(obj.id),
          name: String(obj.name),
          metadata: obj.metadata ?? {},
        }
        this.items.set(item.id, item)
      })
    } catch (e) {
      logger.error('Failed to load inventory from', this.storagePath, e)
    }
  }

  private save(): void {
    if (!this.storagePath) return
    try {
      const data = Array.from(this.items.values())
      window?.localStorage?.setItem(
        this.storagePath,
        JSON.stringify(data, null, 2),
      )
    } catch (e) {
      logger.error('Failed to save inventory to', this.storagePath, e)
    }
  }

  // ---------------------------------------------------------------------
  // CRUD API
  // ---------------------------------------------------------------------
  addItem(name: string, metadata: Record<string, unknown> = {}): InventoryItem {
    const id = uuidv4()
    const item: InventoryItem = { id, name, metadata }
    this.items.set(id, item)
    this.save()
    return item
  }

  getItem(id: string): InventoryItem {
    const item = this.items.get(id)
    if (!item) throw new Error(`Inventory item ${id} not found`)
    return item
  }

  updateItem(
    id: string,
    updates: { name?: string; metadata?: Record<string, unknown> },
  ): InventoryItem {
    const existing = this.getItem(id)
    const updated: InventoryItem = {
      id,
      name: updates.name ?? existing.name,
      metadata: { ...existing.metadata, ...(updates.metadata ?? {}) },
    }
    this.items.set(id, updated)
    this.save()
    return updated
  }

  removeItem(id: string): void {
    if (!this.items.delete(id)) {
      throw new Error(`Inventory item ${id} not found`)
    }
    this.save()
  }

  listItems(): InventoryItem[] {
    return Array.from(this.items.values())
  }

  count(): number {
    return this.items.size
  }

  // ---------------------------------------------------------------------
  // Convenience helpers
  // ---------------------------------------------------------------------
  [Symbol.iterator](): Iterator<InventoryItem> {
    return this.items.values()
  }

  toString(): string {
    return `<InventoryEngine items=${this.count()}>`
  }
}

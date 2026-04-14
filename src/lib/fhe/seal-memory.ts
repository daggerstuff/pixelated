/**
 * Microsoft SEAL Memory Management
 *
 * Utilities for managing SEAL WebAssembly objects and memory
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'

// Initialize logger
const logger = createBuildSafeLogger('seal-memory')

/**
 * Type representing an object that has a delete method
 */
export interface Disposable {
  delete: () => void
}

/**
 * Tracks and manages SEAL objects to ensure proper cleanup
 */
export class SealMemoryManager {
  private objects: Map<string, Disposable> = new Map()
  private objectCounter = 0

  /**
   * Track a SEAL object for later cleanup
   *
   * @param obj The SEAL object to track
   * @param name Optional name for the object (for logging)
   * @returns The same object for chaining
   */
  public track<T extends Disposable>(obj: T, name?: string): T {
    if (!obj) {
      return obj
    }

    const id = name || `seal-obj-${++this.objectCounter}`
    this.objects.set(id, obj)

    return obj
  }

  /**
   * Release a specific SEAL object
   *
   * @param obj The object to release
   * @param name The name of the object (if provided during tracking)
   */
  public release(obj: Disposable | null, name?: string): void {
    if (!obj) {
      return
    }

    try {
      // If name is provided, release by name
      if (name && this.objects.has(name)) {
        const trackedObj = this.objects.get(name)
        if (trackedObj) {
          trackedObj.delete()
          this.objects.delete(name)
        }
        return
      }

      // Otherwise try to find the object in the map
      for (const [id, trackedObj] of this.objects.entries()) {
        if (trackedObj === obj) {
          trackedObj.delete()
          this.objects.delete(id)
          return
        }
      }

      // If the object wasn't tracked, just delete it
      obj.delete()
    } catch (error: unknown) {
      logger.error('Error releasing SEAL object', { error, name })
    }
  }

  /**
   * Release all tracked SEAL objects
   */
  public releaseAll() {
    logger.info(`Releasing ${this.objects.size} SEAL objects`)

    for (const [id, obj] of this.objects.entries()) {
      try {
        if (obj && typeof obj.delete === 'function') {
          obj.delete()
        }
      } catch (error: unknown) {
        logger.error(`Error releasing SEAL object ${id}`, { error })
      }
    }

    this.objects.clear()
    this.objectCounter = 0
  }

  /**
   * Get the number of tracked objects
   */
  public getObjectCount(): number {
    return this.objects.size
  }

  /**
   * Create and track a batch of objects that are created
   * from a factory function
   *
   * @param factory Function that creates the objects
   * @returns The created and tracked objects
   */
  public createTracked<T extends Record<string, Disposable>>(
    factory: () => T,
  ): T {
    const objects = factory()

    for (const [key, obj] of Object.entries(objects)) {
      this.track(obj, key)
    }

    return objects
  }
}

/**
 * Resource scope for automatic cleanup of SEAL objects
 */
export class SealResourceScope {
  private memoryManager = new SealMemoryManager()

  /**
   * Track a SEAL object for cleanup when the scope ends
   */
  public track<T extends Disposable>(obj: T, name?: string): T {
    return this.memoryManager.track(obj, name)
  }

  /**
   * Execute a function with automatic cleanup of created resources
   *
   * @param fn Function to execute within the scope
   * @returns The result of the function
   */
  public async run<T>(
    fn: (scope: SealResourceScope) => Promise<T> | T,
  ): Promise<T> {
    try {
      return await fn(this)
    } finally {
      this.memoryManager.releaseAll()
    }
  }

  /**
   * Explicitly close the scope and release all tracked resources
   */
  public close() {
    this.memoryManager.releaseAll()
  }
}

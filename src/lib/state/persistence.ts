import { logger } from '@/lib/logger'

interface StorageOptions {
  storage?: Storage
  prefix?: string
  encrypt?: boolean
  compress?: boolean
}

interface PersistenceConfig {
  key: string
  version?: number
  migrate?: (oldState: unknown, version: number) => unknown
  serialize?: (state: unknown) => string
  deserialize?: (serialized: string) => unknown
  merge?: (persistedState: unknown, currentState: unknown) => unknown
  options?: StorageOptions
}

const defaultOptions: Required<StorageOptions> = {
  storage:
    typeof window !== 'undefined' ? window.localStorage : ({} as Storage),
  prefix: 'app_state_',
  encrypt: false,
  compress: false,
}

export class StatePersistence {
  private config: PersistenceConfig
  private options: Required<StorageOptions>

  constructor(config: PersistenceConfig) {
    this.config = config
    this.options = { ...defaultOptions, ...config.options }
  }

  private getStorageKey(): string {
    return `${this.options.prefix}${this.config.key}`
  }

  private getVersionKey(): string {
    return `${this.options.prefix}${this.config.key}_version`
  }

  private async serialize(state: unknown): Promise<string> {
    try {
      const serialized = this.config.serialize
        ? this.config.serialize(state)
        : JSON.stringify(state)

      if (this.options.compress) {
        // Implement compression if needed
      }

      if (this.options.encrypt) {
        // Implement encryption if needed
      }

      return serialized
    } catch (error: unknown) {
      logger.error('Failed to serialize state:', error)
      throw error
    }
  }

  private async deserialize(serialized: string): Promise<unknown> {
    try {
      const data = serialized

      if (this.options.encrypt) {
        // Implement decryption if needed
      }

      if (this.options.compress) {
        // Implement decompression if needed
      }

      return this.config.deserialize
        ? this.config.deserialize(data)
        : (JSON.parse(data) as unknown)
    } catch (error: unknown) {
      logger.error('Failed to deserialize state:', error)
      throw error
    }
  }

  private async migrate(state: unknown): Promise<unknown> {
    if (!this.config.migrate || !this.config.version) {
      return state
    }

    const { storage } = this.options
    if (!storage) {
      return state
    }

    const versionKey = this.getVersionKey()
    const currentVersion = Number(storage.getItem(versionKey)) || 0

    if (currentVersion < this.config.version) {
      const migratedState = this.config.migrate(state, currentVersion)
      storage.setItem(versionKey, String(this.config.version))
      return migratedState
    }

    return state
  }

  async save(state: unknown): Promise<void> {
    try {
      const { storage } = this.options
      if (!storage) {
        return
      }

      const serialized = await this.serialize(state)
      storage.setItem(this.getStorageKey(), serialized)

      if (this.config.version) {
        storage.setItem(this.getVersionKey(), String(this.config.version))
      }
    } catch (error: unknown) {
      logger.error('Failed to save state:', error)
      throw error
    }
  }

  async load(): Promise<unknown | null> {
    try {
      const { storage } = this.options
      if (!storage) {
        return null
      }

      const serialized = storage.getItem(this.getStorageKey())
      if (!serialized) {
        return null
      }

      const state = await this.deserialize(serialized)
      return await this.migrate(state)
    } catch (error: unknown) {
      logger.error('Failed to load state:', error)
      throw error
    }
  }

  async merge(currentState: unknown): Promise<unknown> {
    try {
      const persistedState = await this.load()
      if (!persistedState) {
        return currentState
      }

      return this.config.merge
        ? this.config.merge(persistedState, currentState)
        : { ...(currentState as object), ...(persistedState as object) }
    } catch (error: unknown) {
      logger.error('Failed to merge state:', error)
      throw error
    }
  }

  async clear(): Promise<void> {
    try {
      const { storage } = this.options
      if (!storage) {
        return
      }

      storage.removeItem(this.getStorageKey())
      storage.removeItem(this.getVersionKey())
    } catch (error: unknown) {
      logger.error('Failed to clear state:', error)
      throw error
    }
  }
}

export function createPersistence(config: PersistenceConfig): StatePersistence {
  return new StatePersistence(config)
}

import type { PluginAPI } from '../types'
import { EventEmitter } from 'node:events'

export interface Plugin {
  id: string
  name: string
  version: string
  description?: string
  initialize: (api: PluginAPI) => Promise<void> | void
  cleanup?: () => Promise<void> | void
}

export interface PluginMetadata {
  id: string
  name: string
  version: string
  description?: string
  enabled: boolean
  error?: Error
}

export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map()
  private metadata: Map<string, PluginMetadata> = new Map()
  private api: PluginAPI
  private events = new EventEmitter()

  constructor(api: PluginAPI) {
    this.api = api
  }

  async registerPlugin(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin ${plugin.id} is already registered`)
    }

    const metadata: PluginMetadata = {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      enabled: false,
    }

    try {
      await plugin.initialize(this.api)
      this.plugins.set(plugin.id, plugin)
      metadata.enabled = true
      this.metadata.set(plugin.id, metadata)
      this.events.emit('plugin:registered', { pluginId: plugin.id })
    } catch (error: unknown) {
      metadata.error = error instanceof Error ? error : new Error(String(error))
      this.metadata.set(plugin.id, metadata)
      throw error
    }
  }

  async unregisterPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} is not registered`)
    }

    try {
      if (plugin.cleanup) {
        await plugin.cleanup()
      }
      this.plugins.delete(pluginId)
      this.metadata.delete(pluginId)
      this.events.emit('plugin:unregistered', { pluginId })
    } catch (error: unknown) {
      const metadata = this.metadata.get(pluginId)
      if (metadata) {
        metadata.error =
          error instanceof Error ? error : new Error(String(error))
        metadata.enabled = false
        this.metadata.set(pluginId, metadata)
      }
      throw error
    }
  }

  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId)
  }

  getPluginMetadata(pluginId: string): PluginMetadata | undefined {
    return this.metadata.get(pluginId)
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values())
  }

  getAllMetadata(): PluginMetadata[] {
    return Array.from(this.metadata.values())
  }

  on<T extends unknown[]>(event: string, listener: (...args: T) => void): void {
    this.events.on(event, listener as (...args: unknown[]) => void)
  }

  off<T extends unknown[]>(
    event: string,
    listener: (...args: T) => void,
  ): void {
    this.events.off(event, listener as (...args: unknown[]) => void)
  }
}

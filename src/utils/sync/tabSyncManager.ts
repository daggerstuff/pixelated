/**
 * Tab Synchronization Manager
 * Handles real-time state synchronization across browser tabs and windows
 */

import storageManager from '@/utils/storage/storageManager'

export interface SyncMessage {
  type: 'STATE_UPDATE' | 'STATE_REQUEST' | 'STATE_RESPONSE' | 'HEARTBEAT' | 'TAB_JOIN' | 'TAB_LEAVE'
  key: string
  value?: any
  timestamp: number
  tabId: string
  version?: number
  checksum?: string
}

export interface SyncState {
  key: string
  value: any
  version: number
  checksum: string
  timestamp: number
  tabId: string
}

export interface TabSyncConfig {
  enabled?: boolean
  channelName?: string
  heartbeatInterval?: number
  conflictStrategy?: 'last-write-wins' | 'merge' | 'manual'
  enableVersioning?: boolean
  maxVersions?: number
  onConflict?: (key: string, localValue: any, remoteValue: any) => any
  onStateReceived?: (key: string, value: any, tabId: string) => void
}

/**
 * Generates a simple checksum for data
 */
function generateChecksum(data: any): string {
  try {
    const str = JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  } catch {
    return Date.now().toString(36)
  }
}

/**
 * Tab Synchronization Manager
 */
class TabSyncManager {
  private config: Required<TabSyncConfig>
  private channel: BroadcastChannel | null = null
  private tabId: string
  private heartbeatInterval: NodeJS.Timeout | null = null
  private stateVersions = new Map<string, number>()
  private listeners = new Map<string, Set<(message: SyncMessage) => void>>()
  private isInitialized = false

  constructor(config: TabSyncConfig = {}) {
    this.config = {
      enabled: true,
      channelName: 'pixelated_sync_channel',
      heartbeatInterval: 30000, // 30 seconds
      conflictStrategy: 'last-write-wins',
      enableVersioning: true,
      maxVersions: 10,
      onConflict: (key, local, remote) => remote, // Default to remote value
      onStateReceived: () => {},
      ...config,
    }

    this.tabId = this.generateTabId()
    this.initialize()
  }

  private generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private initialize(): void {
    if (!this.config.enabled || typeof window === 'undefined' || !window.BroadcastChannel) {
      console.warn('TabSyncManager: BroadcastChannel not supported or disabled')
      return
    }

    try {
      this.channel = new BroadcastChannel(this.config.channelName)

      this.channel.addEventListener('message', (event) => {
        this.handleMessage(event.data)
      })

      // Announce this tab's presence
      this.sendMessage({
        type: 'TAB_JOIN',
        key: 'system',
        timestamp: Date.now(),
        tabId: this.tabId,
      })

      // Start heartbeat
      this.startHeartbeat()

      // Handle page unload
      window.addEventListener('beforeunload', () => {
        this.sendMessage({
          type: 'TAB_LEAVE',
          key: 'system',
          timestamp: Date.now(),
          tabId: this.tabId,
        })
        this.cleanup()
      })

      this.isInitialized = true
    } catch (error) {
      console.warn('TabSyncManager: Failed to initialize:', error)
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    this.heartbeatInterval = setInterval(() => {
      this.sendMessage({
        type: 'HEARTBEAT',
        key: 'system',
        timestamp: Date.now(),
        tabId: this.tabId,
      })
    }, this.config.heartbeatInterval)
  }

  private cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    if (this.channel) {
      this.channel.close()
      this.channel = null
    }

    this.listeners.clear()
  }

  private sendMessage(message: SyncMessage): boolean {
    if (!this.channel || !this.isInitialized) return false

    try {
      this.channel.postMessage(message)
      return true
    } catch (error) {
      console.warn('TabSyncManager: Failed to send message:', error)
      return false
    }
  }

  private handleMessage(message: SyncMessage): void {
    // Ignore messages from this tab
    if (message.tabId === this.tabId) return

    switch (message.type) {
      case 'STATE_UPDATE':
        this.handleStateUpdate(message)
        break
      case 'STATE_REQUEST':
        this.handleStateRequest(message)
        break
      case 'TAB_JOIN':
        this.emit('tabJoined', message)
        break
      case 'TAB_LEAVE':
        this.emit('tabLeft', message)
        break
      case 'HEARTBEAT':
        this.emit('heartbeat', message)
        break
    }
  }

  private handleStateUpdate(message: SyncMessage): void {
    const { key, value, tabId, version, checksum } = message

    // Verify checksum if provided
    if (checksum && generateChecksum(value) !== checksum) {
      console.warn(`TabSyncManager: Checksum mismatch for key ${key}`)
      return
    }

    // Get current local state
    const localValue = storageManager.get(key)
    const localVersion = this.stateVersions.get(key) || 0

    // Check for conflicts
    if (this.config.enableVersioning && version && version <= localVersion) {
      console.warn(`TabSyncManager: Received outdated version for key ${key}`)
      return
    }

    // Handle conflicts based on strategy
    let finalValue = value
    if (localValue && value && this.config.conflictStrategy === 'merge') {
      try {
        finalValue = this.mergeStates(localValue, value)
      } catch (error) {
        console.warn('TabSyncManager: Merge failed, using remote value:', error)
        finalValue = value
      }
    } else if (localValue && value && this.config.conflictStrategy === 'manual') {
      finalValue = this.config.onConflict(key, localValue, value)
    }

    // Update local state
    storageManager.set(key, finalValue)
    if (this.config.enableVersioning && version) {
      this.stateVersions.set(key, version)
    }

    // Notify listeners
    this.emit('stateReceived', { key, value: finalValue, tabId })
    this.config.onStateReceived(key, finalValue, tabId)
  }

  private handleStateRequest(message: SyncMessage): void {
    const { key, tabId } = message
    const value = storageManager.get(key)

    if (value !== undefined) {
      this.sendMessage({
        type: 'STATE_RESPONSE',
        key,
        value,
        timestamp: Date.now(),
        tabId: this.tabId,
        version: this.stateVersions.get(key) || 0,
        checksum: generateChecksum(value),
      })
    }
  }

  private mergeStates(local: any, remote: any): any {
    // Simple merge strategy - for more complex merging, this could be enhanced
    if (typeof local !== 'object' || typeof remote !== 'object') {
      return remote // For primitives, use remote value
    }

    if (Array.isArray(local) && Array.isArray(remote)) {
      // For arrays, concatenate and deduplicate by reference
      return [...new Set([...local, ...remote])]
    }

    if (local && remote && typeof local === 'object' && typeof remote === 'object') {
      // For objects, do a deep merge
      const merged = { ...local }
      for (const [key, value] of Object.entries(remote)) {
        if (merged[key] && typeof merged[key] === 'object' && typeof value === 'object') {
          merged[key] = this.mergeStates(merged[key], value)
        } else {
          merged[key] = value
        }
      }
      return merged
    }

    return remote
  }

  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(listener => listener(data))
    }
  }

  /**
   * Subscribe to sync events
   */
  on(event: 'stateReceived' | 'tabJoined' | 'tabLeft' | 'heartbeat' | 'conflict', listener: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }

    this.listeners.get(event)!.add(listener)

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(listener)
    }
  }

  /**
   * Sync a state value across tabs
   */
  syncState(key: string, value: any): boolean {
    const currentVersion = this.stateVersions.get(key) || 0
    const newVersion = currentVersion + 1

    this.stateVersions.set(key, newVersion)

    return this.sendMessage({
      type: 'STATE_UPDATE',
      key,
      value,
      timestamp: Date.now(),
      tabId: this.tabId,
      version: newVersion,
      checksum: generateChecksum(value),
    })
  }

  /**
   * Request current state from other tabs
   */
  requestState(key: string): void {
    this.sendMessage({
      type: 'STATE_REQUEST',
      key,
      timestamp: Date.now(),
      tabId: this.tabId,
    })
  }

  /**
   * Get current tab ID
   */
  getTabId(): string {
    return this.tabId
  }

  /**
   * Check if tab sync is available
   */
  isAvailable(): boolean {
    return this.isInitialized && this.channel !== null
  }

  /**
   * Get sync statistics
   */
  getStats(): {
    isAvailable: boolean
    tabId: string
    trackedKeys: number
    listenersCount: number
  } {
    return {
      isAvailable: this.isAvailable(),
      tabId: this.tabId,
      trackedKeys: this.stateVersions.size,
      listenersCount: Array.from(this.listeners.values()).reduce((sum, set) => sum + set.size, 0),
    }
  }

  /**
   * Destroy the sync manager
   */
  destroy(): void {
    this.cleanup()
    this.stateVersions.clear()
  }
}

// Export singleton instance
export const tabSyncManager = new TabSyncManager()

// Export class for custom instances
export { TabSyncManager }
export default tabSyncManager
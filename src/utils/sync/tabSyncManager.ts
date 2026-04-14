/**
 * Tab Synchronization Manager
 * Handles real-time state synchronization across browser tabs and windows
 * with centralized conflict resolution and storage persistence
 */

import { mergeValues, deepEqual } from '@/utils/object'
import storageManager from '@/utils/storage/storageManager'
import type { StorageConfig } from '@/utils/storage/storageManager'

/**
 * Conflict Resolution Strategies
 * Supports both short forms ('local', 'remote') and long forms ('local-wins', 'remote-wins')
 */
export type ConflictStrategy =
  | 'remote-wins'
  | 'local-wins'
  | 'remote'
  | 'local'
  | 'merge'
  | 'manual'

export interface ConflictResolverConfig {
  strategy?: ConflictStrategy
  onConflict?: (key: string, localValue: any, remoteValue: any) => any
}

/**
 * Handles conflict resolution between local and remote state values
 * Following Single Responsibility Principle - only handles conflict resolution
 */
export class ConflictResolver {
  private config: ConflictResolverConfig

  constructor(config: ConflictResolverConfig) {
    this.config = {
      strategy: 'remote-wins',
      ...config,
    }
  }

  /**
   * Resolve conflict between local and remote values
   */
  resolve<T>(key: string, localValue: T, remoteValue: T): T {
    switch (this.config.strategy) {
      case 'remote-wins':
      case 'remote':
        return remoteValue

      case 'local-wins':
      case 'local':
        return localValue

      case 'merge':
        try {
          return mergeValues(localValue, remoteValue)
        } catch {
          return remoteValue
        }

      case 'manual':
        if (this.config.onConflict) {
          return this.config.onConflict(key, localValue, remoteValue)
        }
        return remoteValue

      default:
        return remoteValue
    }
  }

  /**
   * Check if values are deeply equal
   */
  areEqual<T>(value1: T, value2: T): boolean {
    return deepEqual(value1, value2)
  }
}

/**
 * Storage Adapter
 * Wraps storageManager operations to provide a clean interface
 * Following Single Responsibility Principle - only handles persistence
 */
export class StorageAdapter {
  private defaultConfig: Partial<StorageConfig>

  constructor(config?: Partial<StorageConfig>) {
    this.defaultConfig = config || {}
  }

  /**
   * Get state from storage
   */
  get<T>(
    key: string,
    defaultValue?: T,
    options?: Partial<StorageConfig>,
  ): T | undefined {
    return storageManager.get(key, {
      defaultValue,
      ...this.defaultConfig,
      ...options,
    })
  }

  /**
   * Set state in storage
   */
  set<T>(key: string, value: T, options?: Partial<StorageConfig>): boolean {
    return storageManager.set(key, value, { ...this.defaultConfig, ...options })
  }
}

/**
 * Messaging Transport
 * Handles BroadcastChannel communication and message routing
 * Following Single Responsibility Principle - only handles transport layer
 */
export class MessagingTransport {
  private channel: BroadcastChannel | null = null
  private channelName: string
  private heartbeatInterval: number
  private heartbeatTimer: NodeJS.Timeout | null = null
  private tabId: string
  private messageHandlers = new Map<
    string,
    Set<(message: SyncMessage) => void>
  >()
  private beforeUnloadHandler: (() => void) | null = null

  constructor(channelName: string, heartbeatInterval: number, tabId: string) {
    this.channelName = channelName
    this.heartbeatInterval = heartbeatInterval
    this.tabId = tabId
  }

  /**
   * Initialize the transport layer
   */
  init(onMessage: (message: SyncMessage) => void): boolean {
    if (typeof window === 'undefined' || !window.BroadcastChannel) {
      console.warn('MessagingTransport: BroadcastChannel not supported')
      return false
    }

    try {
      this.channel = new BroadcastChannel(this.channelName)

      this.channel.addEventListener('message', (event) => {
        onMessage(event.data)
      })

      this.startHeartbeat()

      this.beforeUnloadHandler = () => this.destroy()
      window.addEventListener('beforeunload', this.beforeUnloadHandler)

      this.broadcast({
        type: 'TAB_JOIN',
        key: '',
        timestamp: Date.now(),
        tabId: this.tabId,
      })

      return true
    } catch (error: unknown) {
      console.error('MessagingTransport: Failed to initialize', error)
      return false
    }
  }

  /**
   * Start heartbeat to maintain presence
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.broadcast({
        type: 'HEARTBEAT',
        key: '',
        timestamp: Date.now(),
        tabId: this.tabId,
      })
    }, this.heartbeatInterval)
  }

  /**
   * Broadcast a message to all tabs
   */
  broadcast(message: SyncMessage): boolean {
    if (!this.channel) return false

    try {
      this.channel.postMessage(message)
      return true
    } catch (error: unknown) {
      console.error('MessagingTransport: Failed to broadcast', error)
      return false
    }
  }

  /**
   * Register a message handler for a specific event type
   */
  on(event: string, handler: (message: SyncMessage) => void): () => void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, new Set())
    }
    this.messageHandlers.get(event)!.add(handler)

    return () => {
      this.messageHandlers.get(event)?.delete(handler)
    }
  }

  /**
   * Emit an event to registered handlers
   */
  emit(event: string, message: SyncMessage): void {
    this.messageHandlers.get(event)?.forEach((handler) => {
      try {
        handler(message)
      } catch (error: unknown) {
        console.error(`MessagingTransport: Handler error for ${event}`, error)
      }
    })
  }

  /**
   * Check if transport is available
   */
  isAvailable(): boolean {
    return this.channel !== null
  }

  private sendSyncMessage(message: SyncMessage): void {
    if (!this.channel) return

    try {
      this.channel.postMessage(message)
    } catch {
      // Ignore errors during cleanup
    }
  }

  /**
   * Cleanup transport resources
   */
  destroy(useSync = false): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    if (this.channel) {
      try {
        const message = {
          type: 'TAB_LEAVE' as const,
          key: '',
          timestamp: Date.now(),
          tabId: this.tabId,
        }

        if (useSync) {
          this.sendSyncMessage(message)
        } else {
          this.broadcast(message)
        }
      } catch {
        // Ignore errors during cleanup
      }

      if (this.beforeUnloadHandler && typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', this.beforeUnloadHandler)
        this.beforeUnloadHandler = null
      }

      this.channel.close()
      this.channel = null
    }

    this.messageHandlers.clear()
  }
}

export interface SyncMessage {
  type:
    | 'STATE_UPDATE'
    | 'STATE_REQUEST'
    | 'STATE_RESPONSE'
    | 'HEARTBEAT'
    | 'TAB_JOIN'
    | 'TAB_LEAVE'
  key: string
  value?: any
  timestamp: number
  tabId: string
  version?: number
  checksum?: string | null
  sourceId?: string
  serializedValue?: string
}

export interface SyncState {
  key: string
  value: any
  version: number
  checksum: string | null
  timestamp: number
  tabId: string
}

export interface SyncStorageConfig extends StorageConfig {
  key: string
  defaultValue?: any
}

export interface TabSyncConfig {
  enabled?: boolean
  channelName?: string
  heartbeatInterval?: number
  conflictStrategy?: 'remote-wins' | 'local-wins' | 'merge' | 'manual'
  enableVersioning?: boolean
  maxVersions?: number
  enableStorage?: boolean
  storageConfig?: Partial<StorageConfig>
  onConflict?: (key: string, localValue: any, remoteValue: any) => any
  onStateReceived?: (key: string, value: any, tabId: string) => void
}

/**
 * Sync Orchestrator
 * Handles state versioning, caching, and sync flow orchestration
 * Following Single Responsibility Principle - only handles sync logic
 */
export class SyncOrchestrator {
  private stateVersions = new Map<string, number>()
  private stateCache = new Map<string, any>()
  private enableVersioning: boolean
  private maxVersions: number

  constructor(enableVersioning: boolean, maxVersions: number) {
    this.enableVersioning = enableVersioning
    this.maxVersions = maxVersions
  }

  /**
   * Get current version for a key
   */
  getVersion(key: string): number {
    return this.stateVersions.get(key) || 0
  }

  /**
   * Increment version for a key
   */
  incrementVersion(key: string): number {
    const current = this.getVersion(key)
    const next = current + 1
    this.stateVersions.set(key, next)
    return next
  }

  /**
   * Update state cache
   */
  setCache(key: string, value: any): void {
    this.stateCache.set(key, value)
  }

  /**
   * Get cached state
   */
  getCache(key: string): any {
    return this.stateCache.get(key)
  }

  /**
   * Clear cache for a key
   */
  clearCache(key: string): void {
    this.stateCache.delete(key)
    this.stateVersions.delete(key)
  }

  /**
   * Set version for a key to a specific value (used when receiving remote updates)
   */
  setVersion(key: string, version: number): void {
    this.stateVersions.set(key, version)
  }

  /**
   * Get count of tracked keys
   */
  getTrackedKeysCount(): number {
    return this.stateVersions.size
  }

  /**
   * Check if version is newer
   */
  isNewerVersion(key: string, incomingVersion: number): boolean {
    const localVersion = this.getVersion(key)
    return incomingVersion > localVersion
  }

  /**
   * Validate incoming state update
   * Returns validation result with action recommendation
   * Note: This method is side-effect free - it does not modify state
   */
  validateStateUpdate(
    key: string,
    version: number | undefined,
    checksum: string | null | undefined,
    computedChecksum: string | null,
    enableVersioning: boolean,
  ): {
    isValid: boolean
    shouldSetVersion: boolean
    targetVersion?: number
    needsResync?: boolean
  } {
    // Verify version if enabled (cheaper check - do this first)
    if (enableVersioning && version) {
      if (!this.isNewerVersion(key, version)) {
        console.warn(
          `SyncOrchestrator: Received outdated version ${version} for key ${key}, triggering re-sync`,
        )
        // Trigger re-sync by signaling the caller
        return { isValid: false, shouldSetVersion: false, needsResync: true }
      }
      // Return indication that version should be set after successful update
      return { isValid: true, shouldSetVersion: true, targetVersion: version }
    }

    // Verify checksum only if provided and non-null (skip for large payloads)
    if (
      checksum &&
      computedChecksum !== null &&
      computedChecksum !== checksum
    ) {
      console.warn(
        `SyncOrchestrator: Checksum mismatch for key ${key}, rejecting update`,
      )
      return { isValid: false, shouldSetVersion: false, needsResync: false }
    }

    return { isValid: true, shouldSetVersion: false }
  }

  /**
   * Cleanup all tracked state
   */
  destroy(): void {
    this.stateVersions.clear()
    this.stateCache.clear()
  }
}

/**
 * Size threshold for skipping checksum generation (100KB)
 * Above this size, JSON.stringify could cause noticeable main-thread blocking
 */
const CHECKSUM_SIZE_THRESHOLD = 100 * 1024

/**
 * Generates a simple checksum for data.
 * Returns null for very large objects to avoid blocking the main thread.
 */
function generateChecksum(data: any, serializedData?: string): string | null {
  try {
    // Check size first if pre-serialized string is provided
    if (serializedData && serializedData.length > CHECKSUM_SIZE_THRESHOLD) {
      // Skip checksum for large payloads to avoid UI jank
      // The version number still provides basic conflict detection
      return null
    }

    // Use pre-serialized string if provided, otherwise serialize
    const str = serializedData ?? JSON.stringify(data)
    if (!str || str.length > CHECKSUM_SIZE_THRESHOLD) {
      // Skip checksum for large payloads to avoid UI jank
      // The version number still provides basic conflict detection
      return null
    }

    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  } catch {
    return Date.now().toString(36)
  }
}

/**
 * Tab Synchronization Manager
 * Coordinates cross-tab state synchronization using separated concerns:
 * - ConflictResolver: Handles conflict resolution strategies
 * - StorageAdapter: Handles persistence operations
 * - Transport layer: Handles BroadcastChannel communication
 */
class TabSyncManager {
  private config: Required<TabSyncConfig>
  private tabId: string
  private isInitialized = false
  private conflictResolver: ConflictResolver
  private storageAdapter: StorageAdapter
  private transport: MessagingTransport
  private orchestrator: SyncOrchestrator

  constructor(config: TabSyncConfig = {}) {
    this.config = {
      enabled: true,
      channelName: 'pixelated_sync_channel',
      heartbeatInterval: 30000, // 30 seconds
      conflictStrategy: 'remote-wins',
      enableVersioning: true,
      maxVersions: 10,
      enableStorage: true,
      storageConfig: {},
      onConflict: (key, local, remote) => remote, // Default to remote value
      onStateReceived: () => {},
      ...config,
    }

    this.tabId = this.generateTabId()

    // Initialize separated concerns following SRP
    this.conflictResolver = new ConflictResolver({
      strategy: this.config.conflictStrategy,
      onConflict: this.config.onConflict,
    })
    this.storageAdapter = new StorageAdapter(this.config.storageConfig)
    this.transport = new MessagingTransport(
      this.config.channelName,
      this.config.heartbeatInterval,
      this.tabId,
    )
    this.orchestrator = new SyncOrchestrator(
      this.config.enableVersioning,
      this.config.maxVersions,
    )
  }

  private generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  public init(): void {
    if (this.isInitialized) return
    if (!this.config.enabled) {
      console.warn('TabSyncManager: Disabled')
      return
    }

    const success = this.transport.init((message) => {
      this.handleMessage(message)
    })

    if (success) {
      this.isInitialized = true
    }
  }

  private sendMessage(message: SyncMessage): boolean {
    return this.transport.broadcast(message)
  }

  private handleMessage(message: SyncMessage): void {
    // Ignore messages from this tab
    if (message.tabId === this.tabId) return

    switch (message.type) {
      case 'STATE_UPDATE':
      case 'STATE_RESPONSE':
        this.handleStateUpdate(message)
        break
      case 'STATE_REQUEST':
        this.emit('stateRequest', message)
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
    const { key, value, tabId, version, checksum, serializedValue } = message

    // Compute checksum for validation (if possible)
    const computedChecksum = generateChecksum(value, serializedValue)

    // Delegate validation to SyncOrchestrator
    const validationResult = this.orchestrator.validateStateUpdate(
      key,
      version,
      checksum,
      computedChecksum,
      this.config.enableVersioning,
    )

    if (!validationResult.isValid) {
      return
    }

    // Set version after successful validation if needed
    if (validationResult.shouldSetVersion && validationResult.targetVersion) {
      this.orchestrator.setVersion(key, validationResult.targetVersion)
    }

    this.orchestrator.setCache(key, value)

    this.transport.emit('stateReceived', {
      type: 'STATE_UPDATE',
      key,
      value,
      timestamp: Date.now(),
      tabId,
      sourceId: message.sourceId,
    })
    this.config.onStateReceived(key, value, tabId)
  }

  private emit(event: string, data: any): void {
    this.transport.emit(event, data)
  }

  /**
   * Subscribe to sync events
   */
  on(
    event:
      | 'stateReceived'
      | 'stateRequest'
      | 'tabJoined'
      | 'tabLeft'
      | 'heartbeat'
      | 'conflict',
    listener: (data: any) => void,
  ): () => void {
    return this.transport.on(event, listener)
  }

  /**
   * Respond to a state request from another tab
   */
  respondToRequest(
    key: string,
    value: any,
    targetTabId?: string,
    serializedValue?: string,
  ): boolean {
    return this.sendMessage({
      type: 'STATE_RESPONSE',
      key,
      value,
      timestamp: Date.now(),
      tabId: this.tabId,
      version: this.orchestrator.getVersion(key),
      checksum: generateChecksum(value, serializedValue),
    })
  }

  /**
   * Sync a state value across tabs
   */
  syncState(
    key: string,
    value: any,
    sourceId?: string,
    serializedValue?: string,
  ): boolean {
    const newVersion = this.orchestrator.incrementVersion(key)

    return this.sendMessage({
      type: 'STATE_UPDATE',
      key,
      value,
      timestamp: Date.now(),
      tabId: this.tabId,
      version: newVersion,
      checksum: generateChecksum(value, serializedValue),
      sourceId,
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
   * Get state from storage with optional default value
   * Delegates to StorageAdapter for persistence operations
   */
  getState<T>(
    key: string,
    defaultValue?: T,
    options?: Partial<StorageConfig>,
  ): T | undefined {
    return this.storageAdapter.get(key, defaultValue, options)
  }

  /**
   * Set state with automatic persistence and cross-tab sync
   * Delegates to StorageAdapter for persistence operations
   */
  setState<T>(
    key: string,
    value: T,
    options?: {
      sync?: boolean
      sourceId?: string
      storageConfig?: Partial<StorageConfig>
    },
  ): boolean {
    const { sync = true, sourceId, storageConfig } = options || {}

    // Persist to storage first (delegated to StorageAdapter) - only if storage is enabled
    if (this.config.enableStorage) {
      const success = this.storageAdapter.set(key, value, storageConfig)
      if (!success) {
        return false
      }
    }

    this.orchestrator.setCache(key, value)

    // Sync across tabs if enabled - only serialize when actually syncing
    if (sync && this.isAvailable()) {
      // Serialize only when needed for sync to avoid unnecessary CPU work
      let serializedValue: string | undefined
      try {
        serializedValue = JSON.stringify(value)
      } catch {
        // If serialization fails, let syncState handle it
      }
      return this.syncState(key, value, sourceId, serializedValue)
    }

    return true
  }

  /**
   * Resolve conflicts between local and remote values
   * Delegates to ConflictResolver for strategy execution
   */
  resolveConflict<T>(
    key: string,
    localValue: T,
    remoteValue: T,
    strategy?: 'remote-wins' | 'local-wins' | 'merge' | 'manual',
    onConflict?: (key: string, localValue: T, remoteValue: T) => T,
  ): T {
    // Use provided strategy or fall back to resolver's configured strategy
    const effectiveStrategy = strategy || this.config.conflictStrategy

    // If custom onConflict provided or different strategy, create temporary resolver
    if (onConflict || (strategy && strategy !== this.config.conflictStrategy)) {
      const tempResolver = new ConflictResolver({
        strategy: effectiveStrategy,
        onConflict: onConflict || this.config.onConflict,
      })
      return tempResolver.resolve(key, localValue, remoteValue)
    }
    return this.conflictResolver.resolve(key, localValue, remoteValue)
  }

  /**
   * Handle incoming state updates with conflict resolution
   * Returns the resolved value and whether it should be persisted
   * Delegates to ConflictResolver and StorageAdapter
   */
  handleIncomingState<T>(
    key: string,
    remoteValue: T,
    localValue: T,
    tabId: string,
    options?: {
      strategy?: 'remote-wins' | 'local-wins' | 'merge' | 'manual'
      skipStorage?: boolean
      onConflict?: (key: string, localValue: T, remoteValue: T) => T
    },
  ): { value: T; shouldUpdate: boolean } {
    const { strategy, skipStorage = false, onConflict } = options || {}

    // If values are identical (using deep equality for objects/arrays), no action needed
    if (this.conflictResolver.areEqual(localValue, remoteValue)) {
      return { value: localValue, shouldUpdate: false }
    }

    // Use the provided onConflict or fallback to config
    const effectiveOnConflict = onConflict
      ? (k: string, l: T, r: T) => onConflict(k, l, r)
      : this.config.onConflict

    // Resolve the conflict using ConflictResolver with the appropriate onConflict
    const resolvedValue = this.resolveConflict(
      key,
      localValue,
      remoteValue,
      strategy,
      effectiveOnConflict,
    )
    // Use deep equality to check if update is needed (handles objects/arrays correctly)
    const shouldUpdate = !this.conflictResolver.areEqual(
      resolvedValue,
      localValue,
    )

    // Emit conflict event
    this.emit('conflict', {
      key,
      localValue,
      remoteValue,
      resolvedValue,
      strategy: strategy || this.config.conflictStrategy,
      tabId,
    })

    // Storage is handled by useDebouncedSave in the hook layer to avoid blocking React renders

    return { value: resolvedValue, shouldUpdate }
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
    return this.isInitialized && this.transport.isAvailable()
  }

  /**
   * Get sync statistics
   */
  getStats(): {
    isAvailable: boolean
    tabId: string
    trackedKeys: number
  } {
    return {
      isAvailable: this.isAvailable(),
      tabId: this.tabId,
      trackedKeys: this.orchestrator.getTrackedKeysCount(),
    }
  }

  /**
   * Destroy the sync manager
   */
  destroy(): void {
    this.transport.destroy()
    this.orchestrator.destroy()
    // Reset so init() can re-initialize if the provider remounts (e.g. HMR).
    this.isInitialized = false
  }
}

// Export singleton instance
export const tabSyncManager = new TabSyncManager()

// Export class for custom instances
export { TabSyncManager }
export default tabSyncManager

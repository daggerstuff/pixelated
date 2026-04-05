/**
 * Sync Context
 *
 * Provides dependency injection for the tab synchronization manager.
 * This allows for better testability and decoupling of the sync layer.
 */

import { createContext, useContext, ReactNode } from 'react'
import tabSyncManager from '@/utils/sync/tabSyncManager'

// Minimal interface for sync operations needed by useSyncedState
export interface SyncManager {
  isAvailable(): boolean
  syncState(key: string, value: any, sourceId?: string): boolean
  on(
    event: 'stateReceived' | 'tabJoined' | 'tabLeft' | 'heartbeat',
    listener: (data: any) => void,
  ): () => void
  getTabId(): string
}

interface SyncContextType {
  syncManager: SyncManager
}

const SyncContext = createContext<SyncContextType | null>(null)

interface SyncProviderProps {
  children: ReactNode
  syncManager?: SyncManager
}

export function SyncProvider({ children, syncManager }: SyncProviderProps) {
  const manager = syncManager ?? tabSyncManager
  return (
    <SyncContext.Provider value={{ syncManager: manager }}>
      {children}
    </SyncContext.Provider>
  )
}

export function useSyncManager(): SyncManager {
  const context = useContext(SyncContext)
  if (!context) {
    throw new Error(
      'useSyncManager must be used within a SyncProvider. If using useSyncedState hook, ensure SyncProvider wraps your component tree.',
    )
  }
  return context.syncManager
}

export { SyncContext }

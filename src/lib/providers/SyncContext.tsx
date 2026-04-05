/**
 * Sync Context
 *
 * Provides dependency injection for the tab synchronization manager.
 * This allows for better testability and decoupling of the sync layer.
 */

import { createContext, useContext, ReactNode, useEffect } from "react";
import tabSyncManager from "@/utils/sync/tabSyncManager";

// Minimal interface for sync operations needed by useSyncedState
export interface SyncManager {
  isAvailable(): boolean;
  init(): void;
  syncState(key: string, value: any, sourceId?: string): boolean;
  respondToRequest(
    key: string,
    value: any,
    targetTabId?: string,
    serializedValue?: string,
  ): boolean;
  on(
    event: "stateReceived" | "stateRequest" | "tabJoined" | "tabLeft" | "heartbeat" | "conflict",
    listener: (data: any) => void,
  ): () => void;
  getTabId(): string;
  getState<T>(key: string, defaultValue?: T, options?: Record<string, any>): T | undefined;
  setState<T>(
    key: string,
    value: T,
    options?: {
      sync?: boolean;
      sourceId?: string;
      storageConfig?: Record<string, any>;
    },
  ): boolean;
  resolveConflict<T>(
    key: string,
    localValue: T,
    remoteValue: T,
    strategy?: "remote-wins" | "local-wins" | "remote" | "local" | "merge" | "manual",
  ): T;
  handleIncomingState<T>(
    key: string,
    remoteValue: T,
    localValue: T,
    tabId: string,
    options?: {
      strategy?: "remote-wins" | "local-wins" | "remote" | "local" | "merge" | "manual";
      skipStorage?: boolean;
      onConflict?: (key: string, localValue: T, remoteValue: T) => T;
    },
  ): { value: T; shouldUpdate: boolean };
  requestState(key: string): void;
}

interface SyncContextType {
  syncManager: SyncManager;
}

const SyncContext = createContext<SyncContextType | null>(null);

interface SyncProviderProps {
  children: ReactNode;
  syncManager?: SyncManager;
}

export function SyncProvider({ children, syncManager }: SyncProviderProps) {
  const manager = syncManager ?? tabSyncManager;

  useEffect(() => {
    manager.init();
  }, [manager]);

  return <SyncContext.Provider value={{ syncManager: manager }}>{children}</SyncContext.Provider>;
}

export function useSyncManager(): SyncManager {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error(
      "useSyncManager must be used within a SyncProvider. If using useSyncedState hook, ensure SyncProvider wraps your component tree.",
    );
  }
  return context.syncManager;
}

export { SyncContext };

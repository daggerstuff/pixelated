import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useSyncManager } from "@/lib/providers/SyncContext";
import { deepEqual } from "@/utils/object";
import type { SyncManager } from "@/lib/providers/SyncContext";

export interface UseSyncedStateOptions<T> {
  key: string;
  defaultValue: T;
  debounceMs?: number;
  enableSync?: boolean;
  /**
   * Conflict resolution strategy.
   * - 'local-wins' / 'local': Always use local value
   * - 'remote-wins' / 'remote': Always use remote value (default)
   * - 'merge': Deep merge objects
   * - 'manual': Use onConflict callback
   */
  conflictStrategy?: "local-wins" | "remote-wins" | "merge" | "manual";
  onSync?: (value: T, sourceTabId: string) => void;
  /**
   * Conflict resolution handler.
   * Signature explicitly expects (key, localValue, remoteValue).
   */
  onConflict?: (key: string, localValue: T, remoteValue: T) => T;
  storagePrefix?: string;
  storageVersion?: number;
}

/**
 * Standalone manager class for synchronization lifecycle and message logic.
 * Decouples the React component lifecycle from the low-level tab communication protocol.
 */
class SyncLifecycleManager<T> {
  private syncManager: SyncManager;
  private key: string;
  private enableSync: boolean;
  private instanceId: string;
  private conflictStrategy: NonNullable<UseSyncedStateOptions<T>["conflictStrategy"]>;
  private defaultValue: T;
  private debounceMs: number;
  private storageOptions: Record<string, any>;
  private onSync?: (value: T, sourceTabId: string) => void;
  private onConflict?: (key: string, localValue: T, remoteValue: T) => T;

  private onStateChange: (value: T) => void;
  private onStatusChange: (status: "synced" | "offline") => void;

  private lastSyncValue: T;
  private debounceRef: NodeJS.Timeout | null = null;
  private unsubscribers: Array<() => void> = [];
  private isInitialized = false;

  constructor(
    syncManager: SyncManager,
    instanceId: string,
    options: UseSyncedStateOptions<T>,
    storageOptions: Record<string, any>,
    onStateChange: (value: T) => void,
    onStatusChange: (status: "synced" | "offline") => void
  ) {
    this.syncManager = syncManager;
    this.instanceId = instanceId;
    this.key = options.key;
    this.enableSync = options.enableSync ?? true;
    this.conflictStrategy = options.conflictStrategy || "remote";
    this.defaultValue = options.defaultValue;
    this.debounceMs = options.debounceMs ?? 300;
    this.storageOptions = storageOptions;

    this.onSync = options.onSync;
    this.onConflict = options.onConflict;
    this.onStateChange = onStateChange;
    this.onStatusChange = onStatusChange;

    this.lastSyncValue = this.defaultValue;
  }

  updateOptions(
    options: Pick<UseSyncedStateOptions<T>, "key" | "enableSync" | "conflictStrategy" | "defaultValue" | "debounceMs">,
    storageOptions: Record<string, any>,
    onSync?: (value: T, sourceTabId: string) => void,
    onConflict?: (key: string, localValue: T, remoteValue: T) => T
  ) {
    this.key = options.key;
    this.enableSync = options.enableSync ?? true;
    this.conflictStrategy = options.conflictStrategy || "remote";
    this.defaultValue = options.defaultValue;
    this.debounceMs = options.debounceMs ?? 300;
    this.storageOptions = storageOptions;

    this.onSync = onSync;
    this.onConflict = onConflict;
  }

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Load initial state
    const storedValue = this.syncManager.getState<T>(
      this.key,
      this.defaultValue,
      this.storageOptions
    );
    const initialValue = storedValue ?? this.defaultValue;
    this.lastSyncValue = initialValue;
    this.onStateChange(initialValue);

    if (this.enableSync && this.syncManager.isAvailable()) {
      this.syncManager.requestState(this.key);

      const unsubReceived = this.syncManager.on("stateReceived", (data: any) => {
        if (data.key !== this.key || data.sourceId === this.instanceId) return;
        this.processIncomingState(data);
      });

      const unsubRequest = this.syncManager.on("stateRequest", (data: any) => {
        if (data.key === this.key) {
          this.syncManager.respondToRequest(this.key, this.lastSyncValue);
        }
      });

      this.unsubscribers.push(unsubReceived, unsubRequest);
    }
  }

  private processIncomingState(data: { key: string; value: T; tabId: string; sourceId: string }) {
    const result = this.syncManager.handleIncomingState(
      this.key,
      data.value,
      this.lastSyncValue,
      data.tabId,
      {
        strategy: this.conflictStrategy,
        onConflict: this.onConflict,
      }
    );

    if (result.shouldUpdate) {
      this.lastSyncValue = result.value;
      this.onStateChange(result.value);

      if (this.onSync) {
        this.onSync(result.value, data.tabId);
      }
    }

    this.onStatusChange("synced");
  }

  saveAndSync(value: T) {
    if (this.debounceRef) {
      clearTimeout(this.debounceRef);
    }

    this.debounceRef = setTimeout(() => {
      const success = this.syncManager.setState(this.key, value, {
        sync: this.enableSync,
        sourceId: this.instanceId,
        storageConfig: this.storageOptions,
      });

      if (success) {
        this.lastSyncValue = value;
        const isSynced = this.enableSync && this.syncManager.isAvailable();
        this.onStatusChange(isSynced ? "synced" : "offline");
      } else {
        this.onStatusChange("offline");
      }
    }, this.debounceMs);
  }

  handleUserUpdate(value: T) {
    if (value !== this.lastSyncValue) {
      this.saveAndSync(value);
    }
  }

  cleanup() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    if (this.debounceRef) {
      clearTimeout(this.debounceRef);
      this.debounceRef = null;
    }
    this.isInitialized = false;
    this.lastSyncValue = this.defaultValue;
  }
}

export function useSyncedState<T>({
  key,
  defaultValue,
  debounceMs = 300,
  enableSync = true,
  conflictStrategy = "remote",
  onSync,
  onConflict,
  ...storageOptions
}: UseSyncedStateOptions<T>) {
  const syncManager = useSyncManager();
  const [state, setState] = useState<T>(defaultValue);
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"synced" | "offline">("synced");
  const instanceId = useRef<string>();
if (instanceId.current === undefined) {
  // Use crypto.randomUUID() for unique, collision-resistant instance IDs
  instanceId.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
}

  const handleStateChange = useCallback((value: T) => {
    setState(value);
  }, []);

  const handleStatusChange = useCallback((status: "synced" | "offline") => {
    setSyncStatus(status);
  }, []);

  const [manager] = useState(() => new SyncLifecycleManager<T>(
    syncManager,
    instanceId.current!,
    {
      key,
      defaultValue,
      debounceMs,
      enableSync,
      conflictStrategy,
    },
    storageOptions,
    handleStateChange,
    handleStatusChange
  ));

  const prevStorageOptionsRef = useRef(storageOptions);
  if (!deepEqual(prevStorageOptionsRef.current, storageOptions)) {
    prevStorageOptionsRef.current = storageOptions;
  }

  useLayoutEffect(() => {
    manager.updateOptions(
      { key, enableSync, conflictStrategy, defaultValue, debounceMs },
      prevStorageOptionsRef.current,
      onSync,
      onConflict
    );
  }, [manager, key, enableSync, conflictStrategy, defaultValue, debounceMs, prevStorageOptionsRef.current, onSync, onConflict]);

  useLayoutEffect(() => {
    manager.init();
    setIsLoaded(true);
    return () => manager.cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager, key, enableSync, syncManager]);

  const setSyncedState = useCallback((value: T | ((prev: T) => T)) => {
    setState(value);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      manager.handleUserUpdate(state);
    }
  }, [manager, state, isLoaded]);

  return [state, setSyncedState, isLoaded, syncStatus] as const;
}

export function useSyncedObject<T extends Record<string, any>>({
  key,
  defaultValue,
  debounceMs = 300,
  enableSync = true,
  conflictStrategy = "remote",
  onSync,
  onConflict,
  ...storageOptions
}: Omit<UseSyncedStateOptions<T>, "defaultValue"> & { defaultValue: T }) {
  const [state, setState, isLoaded, syncStatus] = useSyncedState({
    key,
    defaultValue,
    debounceMs,
    enableSync,
    conflictStrategy,
    onSync,
    onConflict,
    ...storageOptions,
  });

  const updateField = useCallback(
    <K extends keyof T>(field: K, value: T[K] | ((prev: T[K]) => T[K])) => {
      setState((prev: T) => ({
        ...prev,
        [field]: typeof value === "function" ? (value as (prev: T[K]) => T[K])(prev[field]) : value,
      }));
    },
    [setState],
  );

  const removeField = useCallback(
    (field: keyof T) => {
      setState((prev: T) => {
        const newState = { ...prev };
        delete newState[field];
        return newState;
      });
    },
    [setState],
  );

  return [state, setState, updateField, removeField, isLoaded, syncStatus] as const;
}

export default useSyncedState;

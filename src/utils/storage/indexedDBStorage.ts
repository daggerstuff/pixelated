import { type IDBPDatabase } from "idb";

/**
 * IndexedDB storage wrapper for offline-first scenarios.
 * Provides async key-value storage to complement synchronous StorageManager.
 */
export interface IndexedDBStorageConfig {
  dbName: string;
  version: number;
  storeName: string;
}

/**
 * Async IndexedDB storage implementation.
 * All methods return Promises for non-blocking operation.
 */
class IndexedDBStorage {
  private dbName: string;
  private version: number;
  private storeName: string;
  private db: IDBDatabase | null = null;
  private initialized = false;

  constructor(config: IndexedDBStorageConfig) {
    this.dbName = config.dbName;
    this.version = config.version;
    this.storeName = config.storeName;
  }

  private async init(): Promise<void> {
    if (this.initialized) return;

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "id" });
        }
      };
    });
  }

  async set(key: string, value: any): Promise<void> {
    await this.init();
    await new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.put({ id: key, value });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async get(key: string): Promise<any | undefined> {
    await this.init();
    return new Promise<any | undefined>((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : undefined);
      };
    });
  }

  async remove(key: string): Promise<void> {
    await this.init();
    await new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    await this.init();
    await new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAllKeys(): Promise<string[]> {
    await this.init();
    return new Promise<string[]>((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as string[]);
    });
  }

  async count(): Promise<number> {
    await this.init();
    return new Promise<number>((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.count();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
}

/**
 * Default IndexedDB instance for pixelated offline storage.
 */
export const pixelatedIndexedDB = new IndexedDBStorage({
  dbName: "pixelated_offline",
  version: 1,
  storeName: "storage",
});

export default IndexedDBStorage;

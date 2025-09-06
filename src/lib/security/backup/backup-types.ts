/**
 * Common backup types and provider configuration
 */

export type BackupType = 'full' | 'incremental';

export interface Backup {
  id: string;
  type: BackupType;
  timestamp: number;
}

// Base config for any storage provider
export interface StorageProviderConfig {
  type: string;
  bucket: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
  region: string;
  options?: Record<string, unknown>;
}

// Generic interface for a backup storage provider
export interface StorageProvider {
  initialize(): Promise<void>;
  listFiles(pattern?: string): Promise<string[]>;
  storeFile(key: string, data: Uint8Array): Promise<void>;
  getFile(key: string): Promise<Uint8Array>;
  deleteFile(key: string): Promise<void>;
}

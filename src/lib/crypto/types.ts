/**
 * Types for the crypto system
 */
export interface KeyData {
  keyId: string
  keyData: {
    version: number
    key: string
    createdAt: Date
    expiresAt: Date
  }
}

export interface CryptoSystem {
  encrypt: (data: string, purpose: string) => Promise<string>
  decrypt: (encryptedData: string, purpose?: string) => Promise<string>
  hash: (data: string) => Promise<string>
  sign: (data: string) => Promise<string>
  verify: (data: string, signature: string) => Promise<boolean>
  rotateExpiredKeys: () => Promise<string[]>
  stopScheduledRotation: () => void
}

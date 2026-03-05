import { KeyStorage } from './keyStorage'

/**
 * Options for scheduled key rotation
 */
interface ScheduledRotationOptions {
  checkIntervalMs?: number
  namespace?: string
  useSecureStorage?: boolean
  onRotation?: (keyId: string, newKeyId: string) => void
  onError?: (error: Error) => void
}

/**
 * Scheduled Key Rotation Service
 * Automatically rotates keys based on expiration
 */
export class ScheduledKeyRotation {
  private keyStorage: KeyStorage
  private checkInterval: number
  private intervalId: NodeJS.Timeout | null = null
  private onRotation?: (keyId: string, newKeyId: string) => void
  private onError?: (error: Error) => void

  /**
   * Creates a new ScheduledKeyRotation instance
   * @param options - Configuration options
   */
  constructor(options: ScheduledRotationOptions = {}) {
    this.keyStorage = new KeyStorage({
      namespace: options.namespace || 'app',
      region: 'us-east-1',
      useKms: false,
    })

    // Default check interval: 1 hour
    this.checkInterval = options.checkIntervalMs || 60 * 60 * 1000
    this.onRotation = options.onRotation
    this.onError = options.onError
  }

  /**
   * Starts the scheduled key rotation
   */
  start() {
    if (this.intervalId) {
      return // Already started
    }

    // Perform initial check
    this.checkAndRotateKeys().catch((error) => {
      if (this.onError) {
        this.onError(error)
      } else {
        console.error('Error during key rotation:', error)
      }
    })

    // Schedule regular checks
    this.intervalId = setInterval(() => {
      this.checkAndRotateKeys().catch((error) => {
        if (this.onError) {
          this.onError(error)
        } else {
          console.error('Error during key rotation:', error)
        }
      })
    }, this.checkInterval)
  }

  /**
   * Stops the scheduled key rotation
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Check if a key needs rotation
   */
  private shouldRotateKey(keyData: { expiresAt?: number }): boolean {
    if (!keyData.expiresAt) {
      return false
    }
    const now = Date.now()
    const isExpired = keyData.expiresAt <= now
    const expiresWithin24Hours =
      keyData.expiresAt > now &&
      keyData.expiresAt <= now + 24 * 60 * 60 * 1000
    return isExpired || expiresWithin24Hours
  }

  /**
   * Rotate a single key and handle notifications
   */
  private async rotateKeyWithNotification(keyId: string): Promise<string | null> {
    try {
      const rotatedKey = await this.keyStorage.rotateKey(keyId)
      if (!rotatedKey) {
        return null
      }
      if (this.onRotation) {
        this.onRotation(keyId, rotatedKey.keyId)
      }
      return rotatedKey.keyId
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      if (this.onError) {
        this.onError(errorObj)
      } else {
        console.error(`Error rotating key ${keyId}:`, error)
      }
      return null
    }
  }

  /**
   * Checks for keys that need rotation and rotates them
   * @returns Array of rotated key IDs
   */
  async checkAndRotateKeys(): Promise<string[]> {
    const rotatedKeys: string[] = []
    const allKeys = await this.keyStorage.listKeys()

    for (const keyId of allKeys) {
      const keyData = await this.keyStorage.getKey(keyId)
      if (!keyData) {
        continue
      }
      if (this.shouldRotateKey(keyData)) {
        const rotatedKeyId = await this.rotateKeyWithNotification(keyId)
        if (rotatedKeyId) {
          rotatedKeys.push(rotatedKeyId)
        }
      }
    }

    return rotatedKeys
  }

  /**
   * Forces rotation of a specific key
   * @param keyId - ID of the key to rotate
   * @returns New key ID if rotation was successful
   */
  async forceRotateKey(keyId: string): Promise<string | null> {
    try {
      const rotatedKey = await this.keyStorage.rotateKey(keyId)

      if (rotatedKey) {
        // Notify about rotation
        if (this.onRotation) {
          this.onRotation(keyId, rotatedKey.keyId)
        }

        return rotatedKey.keyId
      }

      return null
    } catch (error: unknown) {
      if (this.onError) {
        this.onError(error instanceof Error ? error : new Error(String(error)))
      } else {
        console.error(`Error rotating key ${keyId}:`, error)
      }

      return null
    }
  }
}

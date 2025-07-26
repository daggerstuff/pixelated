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
      useSecureStorage: options.useSecureStorage || false,
    })

    // Default check interval: 1 hour
    this.checkInterval = options.checkIntervalMs || 60 * 60 * 1000
    this.onRotation = options.onRotation
    this.onError = options.onError
  }

  /**
   * Starts the scheduled key rotation
   */
  start(): void {
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
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
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

      // Check if key needs rotation (expired or about to expire)
      const now = Date.now()
      const isExpired = keyData.expiresAt && keyData.expiresAt <= now

      // Also rotate keys that will expire in the next 24 hours
      const expiresWithin24Hours =
        keyData.expiresAt &&
        keyData.expiresAt > now &&
        keyData.expiresAt <= now + 24 * 60 * 60 * 1000

      if (isExpired || expiresWithin24Hours) {
        try {
          const rotatedKey = await this.keyStorage.rotateKey(keyId)

          if (rotatedKey) {
            rotatedKeys.push(rotatedKey.keyId)

            // Notify about rotation
            if (this.onRotation) {
              this.onRotation(keyId, rotatedKey.keyId)
            }
          }
        } catch (error) {
          if (this.onError) {
            this.onError(
              error instanceof Error ? error : new Error(String(error)),
            )
          } else {
            console.error(`Error rotating key ${keyId}:`, error)
          }
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
    } catch (error) {
      if (this.onError) {
        this.onError(error instanceof Error ? error : new Error(String(error)))
      } else {
        console.error(`Error rotating key ${keyId}:`, error)
      }

      return null
    }
  }
}

/**
 * Service Worker Registration Utility
 * This file provides utilities for managing the service worker
 */

// Default service worker configuration
const defaultConfig = {
  enabled: true,
  debug: {
    enabled: false,
  },
  scope: '/',
  backgroundSync: {
    enabled: false,
    queueName: 'sync-queue',
  },
  pushNotifications: {
    enabled: false,
    options: {
      userVisibleOnly: true,
    },
    publicKey: '',
  },
}

/**
 * Service Worker Manager class
 * Handles registration, updates, and management of the service worker
 */
export class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null
  private debug: boolean
  private config: typeof defaultConfig

  constructor(config = defaultConfig) {
    this.config = config
    this.debug = config.debug.enabled
  }

  /**
   * Check if Service Workers are supported in this browser
   */
  public isSupported(): boolean {
    return 'serviceWorker' in navigator
  }

  /**
   * Register the service worker
   */
  public async register(): Promise<void> {
    if (!this.config.enabled || !this.isSupported()) {
      return
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: this.config.scope,
      })

      if (this.debug) {
        console.warn('Service Worker registered successfully')
      }

      await this.setupSync()
      await this.setupPushNotifications()
    } catch {
      this.logError('Service Worker registration failed')
    }
  }

  /**
   * Check for updates to the service worker
   */
  public async update(): Promise<void> {
    if (!this.registration) {
      await this.register()
      return
    }

    try {
      await this.registration.update()
      if (this.debug) {
        console.warn('Service Worker update check completed')
      }
    } catch {
      this.logError('Service Worker update check failed')
    }
  }

  /**
   * Set up background sync if enabled and supported
   */
  private async setupSync(): Promise<void> {
    if (!this.registration || !this.config.backgroundSync.enabled) {
      return
    }

    try {
      const registration = this.registration as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> }
      }

      if ('sync' in registration && registration.sync) {
        await registration.sync.register(this.config.backgroundSync.queueName)
        if (this.debug) {
          console.warn('Background sync registered successfully')
        }
      }
    } catch {
      this.logError('Background sync registration failed')
    }
  }

  /**
   * Set up push notifications if enabled and supported
   */
  private async setupPushNotifications(): Promise<void> {
    if (!this.registration || !this.config.pushNotifications.enabled) {
      return
    }

    try {
      await this.registration.pushManager.subscribe({
        userVisibleOnly: this.config.pushNotifications.options.userVisibleOnly,
        applicationServerKey: this.config.pushNotifications.publicKey,
      })

      if (this.debug) {
        console.warn('Push notifications registered successfully')
      }
    } catch {
      this.logError('Push notification registration failed')
    }
  }

  /**
   * Log errors in debug mode
   */
  private logError(message: string): void {
    if (this.debug) {
      console.error(message)
    }
  }
}

// Export a singleton instance
export const serviceWorkerManager = new ServiceWorkerManager()

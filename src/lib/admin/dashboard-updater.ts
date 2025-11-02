import { getSystemMetrics, type SystemMetrics } from '@/lib/api/admin'

export class DashboardUpdater {
  private updateInterval: number | null = null
  private readonly UPDATE_INTERVAL_MS = 30000

  private updateElement(id: string, value: string | number): void {
    const element = document.getElementById(id) as HTMLElement
    if (element) {
      element.textContent = String(value)
    }
  }

  private updateProgressBar(id: string, percent: number): void {
    const element = document.getElementById(id) as HTMLElement
    if (element) {
      element.style.width = `${Math.min(percent, 100)}%`
    }
  }

  private updateSecurityLevel(
    level: SystemMetrics['activeSecurityLevel'],
  ): void {
    const element = document.getElementById(
      'security-level-value',
    ) as HTMLElement
    if (!element) {
      return
    }

    const config = {
      maximum: {
        text: 'Maximum (FHE)',
        className: 'text-green-600 dark:text-green-400',
      },
      hipaa: {
        text: 'HIPAA Compliant',
        className: 'text-blue-600 dark:text-blue-400',
      },
      standard: {
        text: 'Standard',
        className: 'text-yellow-600 dark:text-yellow-400',
      },
    }

    const { text, className } = config[level] || config.standard
    element.textContent = text
    element.className = className
  }

  private showError(message: string): void {
    const errorEl = document.getElementById('error-message') as HTMLElement
    if (errorEl) {
      errorEl.style.display = 'block'
      errorEl.textContent = message
    }
  }

  private hideError() {
    const errorEl = document.getElementById('error-message') as HTMLElement
    if (errorEl) {
      errorEl.style.display = 'none'
    }
  }

  private async updateMetrics() {
    try {
      const data = await getSystemMetrics()

      // Update basic metrics
      this.updateElement('active-users-value', data.activeUsers)
      this.updateElement('active-sessions-value', data.activeSessions)
      this.updateElement('avg-response-time-value', `${data.avgResponseTime}ms`)
      this.updateElement('system-load-value', `${data.systemLoad}%`)
      this.updateElement('storage-used-value', data.storageUsed)
      this.updateElement(
        'messages-sent-value',
        data.messagesSent.toLocaleString(),
      )

      // Update progress bars
      const storagePercent = data.storageUsed
        ? Math.min(parseInt(data.storageUsed) / 10, 100)
        : 0
      const messagesPercent = data.messagesSent
        ? Math.min(data.messagesSent / 100, 100)
        : 0
      this.updateProgressBar('storage-bar', storagePercent)
      this.updateProgressBar('messages-bar', messagesPercent)

      // Update security level
      this.updateSecurityLevel(data.activeSecurityLevel)

      this.hideError()
    } catch (err: unknown) {
      console.error('Error updating metrics:', err)
      this.showError(
        err instanceof Error
          ? (err as Error)?.message || String(err)
          : String(err),
      )
    }
  }

  public startUpdates() {
    // Initial update
    this.updateMetrics()

    // Set up interval for updates
    this.updateInterval = window.setInterval(
      () => this.updateMetrics(),
      this.UPDATE_INTERVAL_MS,
    )
  }

  public stopUpdates() {
    if (this.updateInterval) {
      window.clearInterval(this.updateInterval)
      this.updateInterval = null
    }
  }
}

// Initialize dashboard updates when DOM is loaded
export function initDashboardUpdates() {
  const dashboard = new DashboardUpdater()
  dashboard.startUpdates()

  // Clean up on page unload
  window.addEventListener('unload', () => {
    dashboard.stopUpdates()
  })
}

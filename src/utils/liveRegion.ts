/**
 * Live Region Utilities
 *
 * A set of utility functions for announcing content to screen readers
 * using the project's LiveRegionSystem.
 *
 * These functions can be used from any JavaScript/TypeScript file
 * and will work whether using the Astro or React implementation.
 */

// Local fallback if the LiveRegionSystem isn't available
const createFallbackAnnouncer = (
  politeness: 'polite' | 'assertive',
  clearDelay = 5000,
) => {
  return (message: string, customClearDelay?: number) => {
    const delay = customClearDelay !== undefined ? customClearDelay : clearDelay

    // Create a temporary element for the announcement
    const announcer = document.createElement('div')
    announcer.className = 'sr-only'
    announcer.setAttribute('aria-live', politeness)
    announcer.setAttribute('aria-atomic', 'true')

    // Add to DOM
    document.body.appendChild(announcer)

    // Set the message (slight delay to ensure screen readers pick it up)
    setTimeout(() => {
      announcer.textContent = message
    }, 50)

    // Remove after the specified delay
    setTimeout(() => {
      if (document.body.contains(announcer)) {
        document.body.removeChild(announcer)
      }
    }, delay + 100)
  }
}

/**
 * Announces a status message (polite)
 *
 * Use for non-critical updates that don't require immediate attention
 *
 * @param message - The message to announce
 * @param clearDelay - Optional delay in ms before clearing the message
 */
export function announceStatus(message: string, clearDelay?: number): void {
  // Try to use the global LiveRegionSystem first
  if (typeof window !== 'undefined' && window.LiveRegionSystem) {
    window.LiveRegionSystem.announceStatus(message, clearDelay)
    return
  }

  // Use the ID-based method if elements exist
  const element = document.getElementById('status-live-region')
  if (element) {
    element.textContent = message
    if (clearDelay && clearDelay > 0) {
      setTimeout(() => {
        element.textContent = ''
      }, clearDelay)
    }
    return
  }

  // Fall back to creating a temporary announcer
  createFallbackAnnouncer('polite', 5000)(message, clearDelay)
}

/**
 * Announces an alert message (assertive)
 *
 * Use for important messages that need immediate attention
 *
 * @param message - The message to announce
 * @param clearDelay - Optional delay in ms before clearing the message
 */
export function announceAlert(message: string, clearDelay?: number): void {
  // Try to use the global LiveRegionSystem first
  if (typeof window !== 'undefined' && window.LiveRegionSystem) {
    window.LiveRegionSystem.announceAlert(message, clearDelay)
    return
  }

  // Use the ID-based method if elements exist
  const element = document.getElementById('alert-live-region')
  if (element) {
    element.textContent = message
    if (clearDelay && clearDelay > 0) {
      setTimeout(() => {
        element.textContent = ''
      }, clearDelay)
    }
    return
  }

  // Fall back to creating a temporary announcer
  createFallbackAnnouncer('assertive', 7000)(message, clearDelay)
}

/**
 * Adds a message to the log region (polite, accumulative)
 *
 * Use for sequential information that builds up over time
 *
 * @param message - The message to add to the log
 * @param clear - Whether to clear previous log entries
 */
export function log(message: string, clear = false): void {
  // Try to use the global LiveRegionSystem first
  if (typeof window !== 'undefined' && window.LiveRegionSystem) {
    window.LiveRegionSystem.log(message, clear)
    return
  }

  // Use the ID-based method if elements exist
  const element = document.getElementById('log-live-region')
  if (element) {
    if (clear) {
      element.textContent = message
    } else if (element.textContent) {
      element.textContent += '\n' + message
    } else {
      element.textContent = message
    }
    return
  }

  // For log messages, just use a regular polite announcer
  // Since we can't easily track state without the proper regions
  createFallbackAnnouncer('polite', 7000)(message)
}

/**
 * Announces a progress update (polite)
 *
 * Use for progress bars, loading indicators, etc.
 *
 * @param value - Current value
 * @param max - Maximum value
 * @param label - Description of what's progressing
 */
export function announceProgress(
  value: number | string,
  max: number | string,
  label: string,
): void {
  // Format the announcement
  const percent = Math.round((Number(value) / Number(max)) * 100)
  const message = `${label}: ${percent}% (${value} of ${max})`

  // Try to use the global LiveRegionSystem first
  if (typeof window !== 'undefined' && window.LiveRegionSystem) {
    window.LiveRegionSystem.announceProgress(value, max, label)
    return
  }

  // Use the ID-based method if elements exist
  const element = document.getElementById('progress-live-region')
  if (element) {
    element.textContent = message
    return
  }

  // Fall back to creating a temporary announcer
  createFallbackAnnouncer('polite', 3000)(message)
}

// Type definitions for the global LiveRegionSystem
declare global {
  interface Window {
    LiveRegionSystem?: {
      announceStatus: (message: string, clearDelay?: number) => void
      announceAlert: (message: string, clearDelay?: number) => void
      log: (message: string, clear?: boolean) => void
      announceProgress: (
        value: number | string,
        max: number | string,
        label: string,
      ) => void
    }
  }
}

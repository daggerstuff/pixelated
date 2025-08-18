import type { ReactNode } from 'react'
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react'

// Define the context interface
interface LiveRegionContextType {
  announceStatus: (message: string, clearDelay?: number) => void
  announceAlert: (message: string, clearDelay?: number) => void
  log: (message: string, clear?: boolean) => void
  announceProgress: (
    value: number | string,
    max: number | string,
    label: string,
  ) => void
}

// Create the context with default values
const LiveRegionContext = createContext<LiveRegionContextType>({
  announceStatus: () => {},
  announceAlert: () => {},
  log: () => {},
  announceProgress: () => {},
})

// Provider props
interface LiveRegionProviderProps {
  children: ReactNode
}

/**
 * LiveRegionProvider - Provides context for screen reader announcements
 *
 * This provider creates hidden live regions for screen reader announcements
 * and provides methods to announce messages with different politeness levels.
 */
export function LiveRegionProvider({ children }: LiveRegionProviderProps) {
  // State for each region (primarily for React to re-render)
  const [statusMessage, setStatusMessage] = useState('')
  const [alertMessage, setAlertMessage] = useState('')
  const [logMessages, setLogMessages] = useState<string[]>([])
  const [progressMessage, setProgressMessage] = useState('')
  const [progressData, setProgressData] = useState<{
    value: number | string
    max: number | string
    label: string
  } | null>(null)

  // Methods for announcing to different regions
  const announceStatus = useCallback((message: string, clearDelay = 5000) => {
    setStatusMessage(message)
    if (clearDelay > 0) {
      setTimeout(() => {
        setStatusMessage('')
      }, clearDelay)
    }
  }, [])

  const announceAlert = useCallback((message: string, clearDelay = 7000) => {
    setAlertMessage(message)
    if (clearDelay > 0) {
      setTimeout(() => {
        setAlertMessage('')
      }, clearDelay)
    }
  }, [])

  const log = useCallback((message: string, clear = false) => {
    if (clear) {
      setLogMessages([message])
    } else {
      setLogMessages((prev) => [...prev, message])
    }
  }, [])

  const announceProgress = useCallback(
    (value: number | string, max: number | string, label: string) => {
      const percent = Math.round((Number(value) / Number(max)) * 100)
      setProgressMessage(`${label}: ${percent}% (${value} of ${max})`)
      setProgressData({ value, max, label })
    },
    [],
  )

  // Attempt to use global LiveRegionSystem if available (created by LiveRegionSystem.astro)
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.LiveRegionSystem &&
      statusMessage
    ) {
      window.LiveRegionSystem.announceStatus(statusMessage)
    }
  }, [statusMessage])

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.LiveRegionSystem &&
      alertMessage
    ) {
      window.LiveRegionSystem.announceAlert(alertMessage)
    }
  }, [alertMessage])

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.LiveRegionSystem &&
      logMessages.length > 0
    ) {
      const latestMessage = logMessages[logMessages.length - 1]
      if (latestMessage) {
        window.LiveRegionSystem.log(latestMessage)
      }
    }
  }, [logMessages])

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.LiveRegionSystem &&
      progressData
    ) {
      window.LiveRegionSystem.announceProgress(
        progressData.value,
        progressData.max,
        progressData.label,
      )
    }
  }, [progressData])

  // Context value
  const contextValue = {
    announceStatus,
    announceAlert,
    log,
    announceProgress,
  }

  return (
    <LiveRegionContext.Provider value={contextValue}>
      {/* Fallback live regions in case LiveRegionSystem.astro isn't in the page */}
      <div className="live-region-system" aria-hidden="false">
        {/* Status announcements (polite) */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          role="status"
        >
          {statusMessage}
        </div>

        {/* Alert announcements (assertive) */}
        <div
          aria-live="assertive"
          aria-atomic="true"
          className="sr-only"
          role="alert"
        >
          {alertMessage}
        </div>

        {/* Log announcements (polite, not atomic) */}
        <div aria-live="polite" aria-atomic="false" className="sr-only">
          {logMessages.map((msg, index) => (
            <div key={`log-${index}-${msg.slice(0, 10)}`}>{msg}</div>
          ))}
        </div>

        {/* Progress announcements (polite) */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {progressMessage}
        </div>
      </div>

      {children}
    </LiveRegionContext.Provider>
  )
}

/**
 * Hook to use the live region context for screen reader announcements
 */
export function useLiveRegion() {
  return useContext(LiveRegionContext)
}

// Expose individual hooks for specific announcement types
export function useStatusAnnouncer() {
  const { announceStatus } = useContext(LiveRegionContext)
  return announceStatus
}

export function useAlertAnnouncer() {
  const { announceAlert } = useContext(LiveRegionContext)
  return announceAlert
}

export function useLogAnnouncer() {
  const { log } = useContext(LiveRegionContext)
  return log
}

export function useProgressAnnouncer() {
  const { announceProgress } = useContext(LiveRegionContext)
  return announceProgress
}

// Add TypeScript declarations for the global LiveRegionSystem
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

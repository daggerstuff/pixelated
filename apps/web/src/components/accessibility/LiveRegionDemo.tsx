import { useState } from 'react'

import {
  LiveRegionProvider,
  useLiveRegion,
  useStatusAnnouncer,
} from './LiveRegionContext'

// Demo component that shows using the individual hooks
function StatusButton() {
  const announceStatus = useStatusAnnouncer()
  const [count, setCount] = useState(0)

  const handleClick = () => {
    const newCount = count + 1
    setCount(newCount)
    announceStatus(
      `Button clicked ${newCount} ${newCount === 1 ? 'time' : 'times'}`,
    )
  }

  return (
    <button
      onClick={handleClick}
      className="hover:bg-primary/90 mr-3 rounded-none bg-primary px-4 py-2 text-primary-foreground"
    >
      Status Hook: Click Me ({count})
    </button>
  )
}

// Demo component that shows using the combined hook
function AlertButton() {
  const { announceAlert } = useLiveRegion()
  const [severity, setSeverity] = useState('low')

  const handleClick = () => {
    // Rotate through severity levels
    const nextSeverity =
      severity === 'low' ? 'medium' : severity === 'medium' ? 'high' : 'low'
    setSeverity(nextSeverity)
    announceAlert(`Alert severity changed to ${nextSeverity}`)
  }

  return (
    <button
      onClick={handleClick}
      className="rounded-none border border-ring bg-secondary px-4 py-2 text-foreground hover:bg-accent"
    >
      Alert Hook: Severity ({severity})
    </button>
  )
}

// Main demo wrapper
export function LiveRegionDemoReact() {
  return (
    <LiveRegionProvider>
      <div className="rounded-none border border-border bg-secondary p-4">
        <h3 className="mb-4 text-lg font-medium">React Live Region Hooks</h3>
        <p className="mb-4 text-sm">
          These buttons use React hooks to access the live region system.
        </p>
        <div className="flex flex-wrap gap-4">
          <StatusButton />
          <AlertButton />
        </div>
      </div>
    </LiveRegionProvider>
  )
}

export default LiveRegionDemoReact

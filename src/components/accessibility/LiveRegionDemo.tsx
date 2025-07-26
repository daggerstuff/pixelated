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
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md mr-3"
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
      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
    >
      Alert Hook: Severity ({severity})
    </button>
  )
}

// Main demo wrapper
export function LiveRegionDemoReact() {
  return (
    <LiveRegionProvider>
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
        <h3 className="text-lg font-medium mb-4">React Live Region Hooks</h3>
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

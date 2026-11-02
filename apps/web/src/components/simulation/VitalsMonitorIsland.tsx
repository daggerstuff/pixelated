import { useCallback } from 'react'

import { VitalsMonitor } from '@/components/simulation/VitalsMonitor'
import { useScenarioEvents } from '@/hooks/useScenarioEvents'

interface VitalsMonitorIslandProps {
  sessionId: string
}

export function VitalsMonitorIsland({ sessionId }: VitalsMonitorIslandProps) {
  const { status, latestEvent, reconnect } = useScenarioEvents({
    sessionId,
  })

  const handleReconnect = useCallback(() => reconnect(), [reconnect])

  return (
    <VitalsMonitor
      event={latestEvent}
      status={status}
      onReconnect={handleReconnect}
    />
  )
}

export default VitalsMonitorIsland

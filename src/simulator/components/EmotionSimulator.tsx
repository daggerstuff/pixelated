import React, { useCallback, useEffect, useState } from 'react'
import { useRealTimeAnalysis } from '../hooks/useRealTimeAnalysis'
import { EmotionDisplay } from './EmotionDisplay'
import { SpeechPatternDisplay } from './SpeechPatternDisplay'
import { TechniqueDisplay } from './TechniqueDisplay'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Alert } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('EmotionSimulator')

interface ConnectionStatusProps {
  isConnected: boolean
  className?: string
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  className,
}) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <div
      className={`w-2 h-2 rounded-full ${
        isConnected ? 'bg-green-500' : 'bg-red-500'
      }`}
      aria-hidden="true"
    />

    <span className="text-sm text-muted-foreground">
      {isConnected ? 'Connected' : 'Disconnected'}
    </span>
  </div>
)

export const EmotionSimulator: React.FC = () => {
  const [hasConsent, setHasConsent] = useState(false)
  const {
    isConnected,
    isProcessing,
    lastError,
    startAnalysis,
    stopAnalysis,
    resetAnalysis,
    updateConsent,
  } = useRealTimeAnalysis()

  // Handle connection status changes
  useEffect(() => {
    if (!isConnected) {
      logger.warn('Connection lost to analysis service')
    }
  }, [isConnected])

  const handleConsentChange = useCallback(
    (checked: boolean) => {
      try {
        setHasConsent(checked)
        updateConsent(checked)
      } catch (error: unknown) {
        logger.error('Error updating consent status:', error)
      }
    },
    [updateConsent],
  )

  const handleStart = useCallback(() => {
    if (!hasConsent) {
      logger.warn('Attempted to start analysis without consent')
      return
    }

    try {
      startAnalysis()
    } catch (error: unknown) {
      logger.error('Error starting analysis:', error)
    }
  }, [hasConsent, startAnalysis])

  const handleStop = useCallback(() => {
    try {
      stopAnalysis()
    } catch (error: unknown) {
      logger.error('Error stopping analysis:', error)
    }
  }, [stopAnalysis])

  const handleReset = useCallback(() => {
    try {
      resetAnalysis()
    } catch (error: unknown) {
      logger.error('Error resetting analysis:', error)
    }
  }, [resetAnalysis])

  return (
    <div
      className="p-4 space-y-6"
      role="region"
      aria-label="Emotion Analysis Simulator"
    >
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="consent-switch"
            checked={hasConsent}
            onCheckedChange={handleConsentChange}
            aria-label="Audio analysis consent"
          />

          <label htmlFor="consent-switch" className="text-sm">
            Allow audio analysis
          </label>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleStart}
            disabled={!hasConsent || isProcessing || !isConnected}
            variant="default"
            aria-label="Start emotion analysis"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Start Analysis'
            )}
          </Button>
          <Button
            onClick={handleStop}
            disabled={!isProcessing}
            variant="secondary"
            aria-label="Stop emotion analysis"
          >
            Stop Analysis
          </Button>
          <Button
            onClick={handleReset}
            disabled={isProcessing}
            variant="outline"
            aria-label="Reset analysis data"
          >
            Reset
          </Button>
        </div>
      </div>

      {lastError && (
        <Alert variant="error" title="Error" description={lastError} />
      )}

      {!isConnected && (
        <Alert
          variant="warning"
          title="Connection Lost"
          description="Unable to connect to the analysis service. Please check your connection and try again."
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <EmotionDisplay />
        <SpeechPatternDisplay />
        <TechniqueDisplay />
      </div>

      <ConnectionStatus isConnected={isConnected} className="mt-4" />
    </div>
  )
}

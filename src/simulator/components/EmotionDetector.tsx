import type React from 'react'
import { useEffect } from 'react'
import { useSimulatorContext } from '../context/SimulatorContext'
import { useEmotionDetection } from '../hooks/useEmotionDetection'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('EmotionDetector')

interface EmotionDetectorProps {
  text: string
  onAnalysisComplete?: (success: boolean) => void
}

export const EmotionDetector: React.FC<EmotionDetectorProps> = ({
  text,
  onAnalysisComplete,
}) => {
  const { isRunning, isProcessing } = useSimulatorContext()
  const { detectEmotions } = useEmotionDetection()

  useEffect(() => {
    const analyzeEmotions = async () => {
      if (isProcessing || !text.trim()) {
        return
      }

      try {
        const analysis = await detectEmotions(text)
        onAnalysisComplete?.(!!analysis)
      } catch (error) {
        logger.error('Error in emotion analysis:', error)
        onAnalysisComplete?.(false)
      }
    }

    analyzeEmotions()
  }, [text, isRunning, isProcessing, detectEmotions, onAnalysisComplete])

  // This is a utility component that doesn't render anything
  return null
}

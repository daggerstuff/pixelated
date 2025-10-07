import React from 'react'
import { EmotionDetector } from './EmotionDetector'
import { EmotionDisplay } from './EmotionDisplay'
import { useSimulatorContext } from '../context/SimulatorContext'

interface EmotionAnalysisProps {
  text: string
}

export const EmotionAnalysis: React.FC<EmotionAnalysisProps> = ({ text }) => {
  const { dispatch } = useSimulatorContext()

  const handleAnalysisComplete = (result: boolean) => {
    if (result) {
      // Properly dispatch the payload if the condition meets
      dispatch({
        type: 'UPDATE_EMOTION_STATE',
        payload: { valence: 0, energy: 0, dominance: 0 }, // Defaulting payload structure
      })
    }
  }

  return (
    <div className="space-y-4">
      <EmotionDetector
        text={text}
        onAnalysisComplete={handleAnalysisComplete}
      />

      <EmotionDisplay />
    </div>
  )
}

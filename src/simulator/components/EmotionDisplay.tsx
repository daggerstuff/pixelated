import React from 'react'
import { useSimulatorContext } from '../context/SimulatorContext'

interface ProgressBarProps {
  label: string
  value: number
  color: string
}

const ProgressBar = ({ label, value, color }: ProgressBarProps) => {
  const percentage = Math.round(value * 100)

  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-medium text-gray-700">{percentage}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          data-testid="emotion-progress-bar"
          className={`h-2.5 rounded-full ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export const EmotionDisplay = () => {
  const { state } = useSimulatorContext()
  const { emotionState } = state

  if (!emotionState) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-gray-500 text-center">No emotion data available</p>
      </div>
    )
  }

  const { valence, energy, dominance } = emotionState

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Emotion Analysis Results</h3>

      <ProgressBar
        label="Valence (Positive/Negative)"
        value={valence}
        color="bg-blue-600"
      />

      <ProgressBar
        label="Energy (Active/Passive)"
        value={energy}
        color="bg-green-600"
      />

      <ProgressBar
        label="Dominance (Strong/Weak)"
        value={dominance}
        color="bg-purple-600"
      />
    </div>
  )
}

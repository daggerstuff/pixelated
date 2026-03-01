import { useSimulatorContext } from '../context/SimulatorContext'

interface ProgressBarProps {
  label: string
  value: number
  color: string
}

const ProgressBar = ({ label, value, color }: ProgressBarProps) => {
  const percentage = Math.round(value * 100)

  return (
    <div className='mb-4'>
      <div className='mb-1 flex justify-between'>
        <span className='text-gray-700 text-sm font-medium'>{label}</span>
        <span className='text-gray-700 text-sm font-medium'>{percentage}%</span>
      </div>
      <div className='bg-gray-200 h-2.5 w-full rounded-full'>
        <div
          data-testid='emotion-progress-bar'
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
      <div className='bg-gray-50 rounded-lg p-4'>
        <p className='text-gray-500 text-center'>No emotion data available</p>
      </div>
    )
  }

  const { valence, energy, dominance } = emotionState

  return (
    <div className='bg-white rounded-lg p-4 shadow'>
      <h3 className='mb-4 text-lg font-semibold'>Emotion Analysis Results</h3>

      <ProgressBar
        label='Valence (Positive/Negative)'
        value={valence}
        color='bg-blue-600'
      />

      <ProgressBar
        label='Energy (Active/Passive)'
        value={energy}
        color='bg-green-600'
      />

      <ProgressBar
        label='Dominance (Strong/Weak)'
        value={dominance}
        color='bg-purple-600'
      />
    </div>
  )
}

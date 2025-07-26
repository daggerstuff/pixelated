import React from 'react'
import { useSimulator } from '../context/SimulatorContext'

export const SpeechPatternDisplay: React.FC = () => {
  const { speechPatterns } = useSimulator()

  if (!speechPatterns || speechPatterns.length === 0) {
    return (
      <div className="p-4 border rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Speech Patterns</h2>
        <p className="text-muted-foreground">
          No speech patterns detected yet.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-lg font-semibold mb-4">Speech Patterns</h2>
      <div className="space-y-3">
        {speechPatterns.map((pattern) => (
          <div key={pattern.type} className="flex justify-between items-center">
            <span className="text-sm">{pattern.type}</span>
            <span className="text-sm font-medium">
              {(pattern.confidence * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

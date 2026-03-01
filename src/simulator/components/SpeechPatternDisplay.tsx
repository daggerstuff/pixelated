import React from 'react'

import { useSimulator } from '../context/SimulatorContext'
import type { SpeechPattern } from '../types'

export const SpeechPatternDisplay: React.FC = () => {
  const { state } = useSimulator()
  const speechPatterns: SpeechPattern[] =
    (state as { speechPatterns?: SpeechPattern[] })?.speechPatterns ?? []

  if (!speechPatterns || speechPatterns.length === 0) {
    return (
      <div className='rounded-lg border p-4'>
        <h2 className='mb-2 text-lg font-semibold'>Speech Patterns</h2>
        <p className='text-muted-foreground'>
          No speech patterns detected yet.
        </p>
      </div>
    )
  }

  return (
    <div className='rounded-lg border p-4'>
      <h2 className='mb-4 text-lg font-semibold'>Speech Patterns</h2>
      <div className='space-y-3'>
        {speechPatterns.map((pattern: SpeechPattern) => (
          <div
            key={pattern.pattern}
            className='flex items-center justify-between'
          >
            <span className='text-sm'>{pattern.pattern}</span>
            <span className='text-sm font-medium'>
              {(pattern.confidence * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
